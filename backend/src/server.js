require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');
const { emailSendingQueue, connection } = require('./config/queue');
const { QueueEvents } = require('bullmq');
const apiRoutes = require('./routes/api');
const { getParser } = require('./utils/postfixLogParser');
const { categorizeBounce } = require('./utils/emailVerifier');

const app = express();

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

app.use('/track', require('./routes/tracking'));
app.use('/api', apiRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      message: 'Request body contains invalid JSON'
    });
  }

  console.error('Unhandled server error:', error);

  return res.status(500).json({
    message: 'Internal server error'
  });
});

const startServer = async () => {
  await connectDB();

  // One-time repair for incorrect hard bounces caused by unactivated Brevo SMTP accounts
  try {
    const DeliveryEvent = require('./models/DeliveryEvent');
    const Campaign = require('./models/Campaign');

    const eventsToFix = await DeliveryEvent.find({
      status: 'bounced',
      diagnostic: /not yet activated|sendinblue\.com/i
    });

    if (eventsToFix.length > 0) {
      console.log(`[Repair] Found ${eventsToFix.length} incorrect hard bounce events from unactivated Brevo SMTP. Repairing...`);

      // Update the delivery events to status 'failed' and DSN '4.0.0'
      await DeliveryEvent.updateMany(
        {
          _id: { $in: eventsToFix.map(e => e._id) }
        },
        {
          $set: { status: 'failed', dsn: '4.0.0' }
        }
      );

      // Fix recipient status in campaigns
      for (const event of eventsToFix) {
        if (event.campaignId && event.recipientId) {
          await Campaign.updateOne(
            {
              _id: event.campaignId,
              'recipients._id': event.recipientId
            },
            {
              $set: { 'recipients.$.status': 'failed' }
            }
          );
        }
      }
      console.log(`[Repair] Completed repairing incorrect bounces.`);
    }
  } catch (repairErr) {
    console.error('[Repair] Error running bounce repair:', repairErr.message);
  }

  const parser = getParser();
  await parser.initFromDb();

  const port = Number.parseInt(process.env.PORT || '5000', 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const server = app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });

  console.log('[Server] Postfix log parser disabled (Brevo mode active)');

  // Pipe QueueEvents (SES mode / worker results) to parser to feed real-time SSE stream
  const queueEvents = new QueueEvents('emailSendingQueue', { connection });

  queueEvents.on('completed', async ({ jobId }) => {
    try {
      const parts = jobId.split('-');
      if (parts.length >= 2) {
        const campaignId = parts[0];
        const recipientId = parts[1];

        const job = await emailSendingQueue.getJob(jobId);
        if (job && job.data) {
          const { recipient: jobRecipient, sendingDomain } = job.data;
          const relayUsed = (job.data && job.data.relayUsed) || (job.returnvalue && job.returnvalue.relayUsed) || 
                            (sendingDomain.provider ? sendingDomain.provider.toUpperCase() : 'SMTP Relay');
          parser.injectEvent({
            status: 'sent',
            recipient: jobRecipient.email,
            domain: sendingDomain.domainName,
            campaignId,
            recipientId,
            relay: relayUsed,
            sender: sendingDomain.senderEmail
          });
        }
      }
    } catch (err) {
      console.error('[QueueEvents] Error processing completed job:', err.message);
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    try {
      const parts = jobId.split('-');
      if (parts.length >= 2) {
        const campaignId = parts[0];
        const recipientId = parts[1];

        const job = await emailSendingQueue.getJob(jobId);
        if (job && job.data) {
          const { recipient: jobRecipient, sendingDomain } = job.data;
          const relayUsed = (job.data && job.data.relayUsed) || 
                            (sendingDomain.provider ? sendingDomain.provider.toUpperCase() : 'SMTP Relay');
          parser.injectEvent({
            status: 'bounced',
            recipient: jobRecipient.email,
            domain: sendingDomain.domainName,
            campaignId,
            recipientId,
            diagnostic: failedReason,
            relay: relayUsed,
            sender: sendingDomain.senderEmail
          });
        }
      }
    } catch (err) {
      console.error('[QueueEvents] Error processing failed job:', err.message);
    }
  });

  // Track suppressed emails in-memory (persisted clearance via /events/clear)
  const suppressedEmails = new Set();

  parser.on('event', async (event) => {
    const isBounce = event.status === 'bounced' || event.status === 'expired';
    if (isBounce && event.campaignId && event.recipientId) {
      try {
        const Campaign = require('./models/Campaign');
        const Domain = require('./models/Domain');

        const bounceType = categorizeBounce(event.dsn, event.diagnostic);
        const recipientEmail = event.recipient || '';
        console.log(`[BounceHandler] ${bounceType.toUpperCase()} bounce: ${recipientEmail} (DSN: ${event.dsn})`);

        if (bounceType === 'hard') {
          suppressedEmails.add(recipientEmail.toLowerCase());
        }

        // Update campaign recipient status
        const updatedCampaign = await Campaign.findOneAndUpdate(
          {
            _id: event.campaignId,
            'recipients._id': event.recipientId,
            'recipients.status': { $ne: 'failed' }
          },
          {
            $set: { 'recipients.$.status': bounceType === 'hard' ? 'bounced' : 'failed' }
          },
          { new: true }
        );

        if (updatedCampaign) {
          console.log(`[BounceHandler] Updated campaign ${event.campaignId} recipient ${event.recipientId} (${bounceType})`);

          if (event.domain) {
            const domain = await Domain.findOne({ domainName: new RegExp(`^${event.domain}$`, 'i') });
            if (domain) {
              const today = new Date().toISOString().slice(0, 10);
              await Domain.updateOne(
                {
                  _id: domain._id,
                  usageDate: today,
                  dailyUsage: { $gt: 0 }
                },
                {
                  $inc: { dailyUsage: -1 }
                }
              );
            }
          }
        }
      } catch (err) {
        console.error('[BounceHandler] Error:', err.message);
      }
    }
  });

  // Expose suppressed set to eventController for clearance on flush/clear
  parser.suppressedEmails = suppressedEmails;

  const shutdown = async () => {
    parser.stop();
    server.close(async () => {
      await queueEvents.close();
      await emailSendingQueue.close();
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer().catch((error) => {
  console.error('Unable to start API server:', error.message);
  process.exit(1);
});
// Trigger restart after log cleanup
