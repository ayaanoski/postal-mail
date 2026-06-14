const { spawn } = require('child_process');
const EventEmitter = require('events');
const DeliveryEvent = require('../models/DeliveryEvent');

/**
 * PostfixLogParser
 *
 * Spawns `docker logs mailer-postfix-relay --tail 500 -f` as a child process,
 * parses each log line for delivery events, and emits structured events via
 * Node EventEmitter. Maintains a rolling in-memory buffer for initial page loads.
 */
class PostfixLogParser extends EventEmitter {
  constructor(options = {}) {
    super();
    this.containerName = options.containerName || 'mailer-postfix-relay';
    this.maxBuffer = options.maxBuffer || 1000;
    this.buffer = [];
    this.process = null;
    this.reconnectTimer = null;
    this.isShuttingDown = false;
    this.stats = { sent: 0, deferred: 0, bounced: 0, failed: 0 };
    this.queueIdToMessageId = new Map();
    this.maxMapSize = options.maxMapSize || 5000;
  }

  /**
   * Parse a single Postfix log line into a structured event object.
   * Returns null if the line doesn't contain a delivery status.
   */
  parseLine(line) {
    // Match cleanup message-id lines:
    // Jun 06 15:15:46 mail postfix/cleanup[167]: B2B0D842B6: message-id=<98464357-c74e-4593-89ae-eae02414f7a1@tfntocha.com>
    const messageIdRegex =
      /postfix\/cleanup\[\d+\]:\s+([A-F0-9]+):\s+message-id=<([^>]+)>/;
    const msgIdMatch = line.match(messageIdRegex);
    if (msgIdMatch) {
      const queueId = msgIdMatch[1];
      const messageId = msgIdMatch[2];
      this.queueIdToMessageId.set(queueId, messageId);

      if (this.queueIdToMessageId.size > this.maxMapSize) {
        const firstKey = this.queueIdToMessageId.keys().next().value;
        this.queueIdToMessageId.delete(firstKey);
      }
      return null;
    }

    // Match delivery status lines:
    // Jun 05 11:06:01 mail postfix/smtp[233]: B5706842C6: to=<test@ajaygoel.org>, relay=smtp.google.com[192.178.211.27]:25, delay=1.9, delays=0.05/0.01/1/0.83, dsn=2.0.0, status=sent (250 ...)
    const deliveryRegex =
      /^(\w+\s+\d+\s+[\d:]+)\s+\S+\s+postfix\/(\w+)\[(\d+)\]:\s+([A-F0-9]+):\s+to=<([^>]+)>.*?relay=([^,]+).*?delay=([^,]+).*?dsn=([^,]+).*?status=(\w+)\s*(.*)$/;

    const match = line.match(deliveryRegex);
    if (!match) {
      // Also match connection timeout / deferred lines from postfix/error
      const errorRegex =
        /^(\w+\s+\d+\s+[\d:]+)\s+\S+\s+postfix\/(\w+)\[(\d+)\]:\s+([A-F0-9]+):\s+to=<([^>]+)>.*?relay=(\S+).*?delay=([^,]+).*?dsn=([^,]+).*?status=(\w+)\s*(.*)$/;
      const errorMatch = line.match(errorRegex);
      if (!errorMatch) return null;
      return this._buildEvent(errorMatch);
    }

    return this._buildEvent(match);
  }

  _buildEvent(match) {
    const [, timestamp, component, pid, queueId, recipient, relay, delay, dsn, status, diagnostic] = match;

    // Parse the Postfix timestamp and attach the current year
    const year = new Date().getFullYear();
    const parsedDate = new Date(`${timestamp} ${year} UTC`);
    const isoTimestamp = !isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString();

    // Clean up diagnostic: remove surrounding parentheses
    let cleanDiagnostic = (diagnostic || '').trim();
    if (cleanDiagnostic.startsWith('(') && cleanDiagnostic.endsWith(')')) {
      cleanDiagnostic = cleanDiagnostic.slice(1, -1).trim();
    }

    const event = {
      id: `${queueId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: isoTimestamp,
      rawTimestamp: timestamp,
      component,
      queueId,
      recipient,
      relay: relay.trim(),
      delay: parseFloat(delay) || 0,
      dsn,
      status: status.toLowerCase(),
      diagnostic: cleanDiagnostic
    };

    // Look up correlated message ID
    const messageId = this.queueIdToMessageId.get(queueId);
    if (messageId) {
      // Parse campaignId, recipientId, uuid, and domain from format: <campaignId.recipientId.uuid@domain>
      const metaMatch = messageId.match(/^<?([0-9a-fA-F]{24})\.([0-9a-fA-F]{24})\.([0-9a-fA-F\-]+)@(.+?)>?$/);
      if (metaMatch) {
        event.campaignId = metaMatch[1];
        event.recipientId = metaMatch[2];
        event.uuid = metaMatch[3];
        event.domain = metaMatch[4];
      }

      // If the status is final (sent, bounced, or expired), we can remove the mapping to free memory
      const finalStatus = event.status === 'sent' || event.status === 'bounced' || event.status === 'expired';
      if (finalStatus) {
        this.queueIdToMessageId.delete(queueId);
      }
    }

    return event;
  }

  /**
   * Start tailing the Postfix container logs.
   */
  start() {
    if (this.process) return;
    this.isShuttingDown = false;

    console.log(`[PostfixLogParser] Starting log tail for container: ${this.containerName}`);

    this.process = spawn('docker', [
      'logs', this.containerName, '--tail', '500', '-f'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const handleData = async (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = this.parseLine(line);
        if (event) {
          await this._addToBuffer(event);
          this._updateStats(event);
          this.emit('event', event);
        }
      }
    };

    this.process.stdout.on('data', handleData);
    this.process.stderr.on('data', handleData);

    this.process.on('close', (code) => {
      console.log(`[PostfixLogParser] Docker logs process exited with code ${code}`);
      this.process = null;
      if (!this.isShuttingDown) {
        this._scheduleReconnect();
      }
    });

    this.process.on('error', (err) => {
      console.error(`[PostfixLogParser] Process error:`, err.message);
      this.process = null;
      if (!this.isShuttingDown) {
        this._scheduleReconnect();
      }
    });
  }

  /**
   * Stop tailing and clean up.
   */
  stop() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    console.log('[PostfixLogParser] Reconnecting in 5 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, 5000);
  }

  async _addToBuffer(event) {
    // Save event to MongoDB first
    try {
      const doc = await DeliveryEvent.create({
        timestamp: event.timestamp,
        queueId: event.queueId || 'manual',
        recipient: event.recipient,
        status: event.status,
        relay: event.relay,
        delay: event.delay,
        dsn: event.dsn,
        diagnostic: event.diagnostic,
        campaignId: event.campaignId || null,
        recipientId: event.recipientId || null,
        sender: event.sender || ''
      });
      // Override event.id with the database document _id
      event.id = doc._id.toString();
    } catch (error) {
      console.error('[PostfixLogParser] Error saving event to MongoDB:', error.message);
    }

    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  _updateStats(event) {
    if (event.status === 'sent') this.stats.sent++;
    else if (event.status === 'deferred') this.stats.deferred++;
    else if (event.status === 'bounced') this.stats.bounced++;
    else if (event.status === 'expired') this.stats.failed++;
  }

  /**
   * Initialize parser stats and buffer from MongoDB.
   */
  async initFromDb() {
    try {
      // Calculate cumulative stats
      const counts = await DeliveryEvent.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      this.stats = { sent: 0, deferred: 0, bounced: 0, failed: 0 };
      for (const group of counts) {
        if (group._id === 'sent') this.stats.sent = group.count;
        else if (group._id === 'deferred') this.stats.deferred = group.count;
        else if (group._id === 'bounced') this.stats.bounced = group.count;
        else if (group._id === 'expired') this.stats.failed = group.count;
      }

      // Load latest events in chronological order (oldest first)
      const latestDocs = await DeliveryEvent.find()
        .sort({ timestamp: -1 })
        .limit(this.maxBuffer);

      this.buffer = latestDocs.reverse().map((doc) => ({
        id: doc._id.toString(),
        timestamp: doc.timestamp.toISOString(),
        queueId: doc.queueId,
        recipient: doc.recipient,
        status: doc.status,
        relay: doc.relay,
        delay: doc.delay,
        dsn: doc.dsn,
        diagnostic: doc.diagnostic,
        campaignId: doc.campaignId ? doc.campaignId.toString() : null,
        recipientId: doc.recipientId ? doc.recipientId.toString() : null,
        sender: doc.sender || ''
      }));

      console.log(`[PostfixLogParser] Initialized ${this.buffer.length} events and stats from MongoDB.`);
    } catch (err) {
      console.error('[PostfixLogParser] Failed to initialize stats from MongoDB:', err.message);
    }
  }

  /**
   * Get the current buffered events.
   */
  getBuffer() {
    return [...this.buffer];
  }

  /**
   * Get delivery statistics.
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get only failed/deferred events from the buffer.
   */
  getFailedEvents(since) {
    let events = this.buffer.filter(
      (e) => e.status === 'deferred' || e.status === 'bounced' || e.status === 'expired'
    );

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        events = events.filter((e) => new Date(e.timestamp) >= sinceDate);
      }
    }

    return events;
  }

  /**
   * Manually inject an event into the parser (for SES or local tracking).
   */
  async injectEvent(data) {
    const { status, recipient, domain, campaignId, recipientId, dsn, diagnostic, relay, sender } = data;
    const diagStr = (diagnostic || '').toLowerCase();
    const isNetworkOrSenderError = diagStr.includes('econnreset') || 
                                   diagStr.includes('connreset') || 
                                   diagStr.includes('etimedout') || 
                                   diagStr.includes('timeout') ||
                                   diagStr.includes('econnrefused') || 
                                   diagStr.includes('enotfound') ||
                                   diagStr.includes('socket') || 
                                   diagStr.includes('read') || 
                                   diagStr.includes('write') || 
                                   diagStr.includes('dns') ||
                                   diagStr.includes('network') || 
                                   diagStr.includes('connect') ||
                                   diagStr.includes('not yet activated') || 
                                   diagStr.includes('sendinblue.com') || 
                                   diagStr.includes('activation') ||
                                   diagStr.includes('authentication failed') ||
                                   diagStr.includes('auth failed') ||
                                   diagStr.includes('username and password not accepted') ||
                                   diagStr.includes('bad credentials') ||
                                   diagStr.includes('unauthorized') ||
                                   diagStr.includes('credentials') ||
                                   diagStr.includes('smtp account') ||
                                   diagStr.includes('authenticated') ||
                                   diagStr.includes('daily sending limit') ||
                                   diagStr.includes('sending quota') ||
                                   diagStr.includes('relay access denied');

    const event = {
      id: `${campaignId || 'manual'}-${recipientId || 'test'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      recipient,
      relay: relay || 'SMTP',
      delay: 0,
      dsn: dsn || (status === 'sent' ? '2.0.0' : (isNetworkOrSenderError ? '4.0.0' : '5.0.0')),
      status: status.toLowerCase(),
      diagnostic: diagnostic || '',
      campaignId,
      recipientId,
      domain,
      sender: sender || ''
    };

    await this._addToBuffer(event);
    this._updateStats(event);
    this.emit('event', event);
  }
}

// Singleton instance
let parserInstance = null;

const getParser = () => {
  if (!parserInstance) {
    parserInstance = new PostfixLogParser();
  }
  return parserInstance;
};

module.exports = { PostfixLogParser, getParser };
