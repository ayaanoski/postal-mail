const { execFile } = require('child_process');
const { getParser } = require('../utils/postfixLogParser');
const Tracking = require('../models/Tracking');
const DeliveryEvent = require('../models/DeliveryEvent');

/**
 * SSE endpoint — streams real-time Postfix delivery events.
 *
 * GET /api/events/stream?token=<jwt>
 */
const getEventStream = (req, res) => {
  const parser = getParser();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial batch of buffered events
  const buffered = parser.getBuffer();
  const stats = parser.getStats();

  res.write(
    `event: init\ndata: ${JSON.stringify({ events: buffered, stats })}\n\n`
  );

  // Stream new events as they arrive
  const onEvent = (event) => {
    const currentStats = parser.getStats();
    res.write(
      `event: delivery\ndata: ${JSON.stringify({ event, stats: currentStats })}\n\n`
    );
  };

  // Stream deleted event events to the client
  const onDeleteEvent = (deletedId) => {
    const currentStats = parser.getStats();
    res.write(
      `event: delete\ndata: ${JSON.stringify({ id: deletedId, stats: currentStats })}\n\n`
    );
  };

  parser.on('event', onEvent);
  parser.on('event_deleted', onDeleteEvent);

  // Send keepalive every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    parser.removeListener('event', onEvent);
    parser.removeListener('event_deleted', onDeleteEvent);
    clearInterval(keepAlive);
  });
};

/**
 * Clear the Postfix deferred mail queue.
 *
 * POST /api/events/clear-queue
 */
const clearMailQueue = (req, res) => {
  const mode = req.body?.mode || 'deferred'; // 'deferred' or 'all'
  const args =
    mode === 'all'
      ? ['exec', 'mailer-postfix-relay', 'postsuper', '-d', 'ALL']
      : ['exec', 'mailer-postfix-relay', 'postsuper', '-d', 'ALL', 'deferred'];

  execFile('docker', args, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('[clearMailQueue] Error:', error.message);
      return res.status(500).json({
        message: 'Failed to clear mail queue',
        error: error.message
      });
    }

    return res.json({
      message: `Mail queue cleared (${mode})`,
      output: (stdout || '').trim() + (stderr || '').trim()
    });
  });
};

/**
 * Flush (force retry) deferred messages immediately.
 *
 * POST /api/events/flush-queue
 */
const flushMailQueue = (req, res) => {
  execFile(
    'docker',
    ['exec', 'mailer-postfix-relay', 'postqueue', '-f'],
    { timeout: 15000 },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[flushMailQueue] Error:', error.message);
        return res.status(500).json({
          message: 'Failed to flush mail queue',
          error: error.message
        });
      }

      return res.json({
        message: 'Queue flushed — deferred messages will be retried now',
        output: (stdout || '').trim() + (stderr || '').trim()
      });
    }
  );
};

/**
 * Export failed/deferred events as a CSV download.
 *
 * GET /api/events/export-failed?since=ISO_DATE
 */
const exportFailedEvents = (req, res) => {
  const parser = getParser();
  const since = req.query.since || null;
  const events = parser.getFailedEvents(since);

  // Build CSV
  const header = 'Timestamp,Recipient,Status,DSN,Relay,Delay (s),Diagnostic';
  const rows = events.map((e) => {
    const escapeCsv = (val) => {
      const str = String(val || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      e.timestamp,
      e.recipient,
      e.status,
      e.dsn,
      escapeCsv(e.relay),
      e.delay,
      escapeCsv(e.diagnostic)
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="failed-emails-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(csv);
};

/**
 * Get current stats and queue info snapshot.
 *
 * GET /api/events/stats
 */
const getEventStats = (req, res) => {
  const parser = getParser();
  const stats = parser.getStats();
  const buffer = parser.getBuffer();

  // Count unique deferred recipients currently in buffer
  const deferredRecipients = new Set(
    buffer.filter((e) => e.status === 'deferred').map((e) => e.recipient)
  );

  return res.json({
    stats,
    totalEvents: buffer.length,
    uniqueDeferredRecipients: deferredRecipients.size
  });
};

/**
 * Delete all tracking events from the DB and clear the parser buffer.
 *
 * DELETE /api/events
 */
const clearAllEvents = async (req, res) => {
  try {
    // Delete all tracking events from database
    await Tracking.deleteMany({});

    // Delete all delivery events from database
    await DeliveryEvent.deleteMany({});

    // Reset postfix log parser in-memory buffer and stats
    const parser = getParser();
    parser.buffer = [];
    parser.stats = { sent: 0, deferred: 0, bounced: 0, failed: 0 };

    return res.json({
      message: 'All tracking and delivery events have been deleted.'
    });
  } catch (error) {
    console.error('[clearAllEvents] Error:', error.message);
    return res.status(500).json({
      message: 'Failed to delete events',
      error: error.message
    });
  }
};

/**
 * Delete a single delivery event from the parser buffer.
 *
 * DELETE /api/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete from DB
    const removedDoc = await DeliveryEvent.findByIdAndDelete(id);
    if (!removedDoc) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const parser = getParser();
    const index = parser.buffer.findIndex((e) => e.id === id);
    let status = removedDoc.status;
    if (index !== -1) {
      const [removedEvent] = parser.buffer.splice(index, 1);
      status = removedEvent.status;
    }

    // Decrement cumulative stats to keep them consistent with the remaining buffer
    if (status === 'sent' && parser.stats.sent > 0) parser.stats.sent--;
    else if (status === 'deferred' && parser.stats.deferred > 0) parser.stats.deferred--;
    else if (status === 'bounced' && parser.stats.bounced > 0) parser.stats.bounced--;
    else if (status === 'expired' && parser.stats.failed > 0) parser.stats.failed--;

    parser.emit('event_deleted', id);

    return res.json({ message: 'Event deleted successfully', id });
  } catch (error) {
    console.error('[deleteEvent] Error:', error.message);
    return res.status(500).json({
      message: 'Failed to delete event',
      error: error.message
    });
  }
};

module.exports = {
  getEventStream,
  clearMailQueue,
  flushMailQueue,
  exportFailedEvents,
  getEventStats,
  clearAllEvents,
  deleteEvent
};
