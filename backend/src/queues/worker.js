require('dotenv').config();

const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const crypto = require('crypto');
const connectDB = require('../config/db');
const { connection } = require('../config/queue');
const relayPool = require('../config/relays');
const Campaign = require('../models/Campaign');
const Domain = require('../models/Domain');
const SmtpConfig = require('../models/SmtpConfig');
const { decryptSmtpPassword } = require('../utils/crypto');
const { createPostalClient } = require('../providers/postal');

const htmlToPlainText = (html) => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<a[^>]+href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getDelaySeconds = (delaySettings) => {
  if (delaySettings.type === 'fixed') {
    return delaySettings.fixedValue;
  }

  return (
    Math.random() * (delaySettings.max - delaySettings.min) +
    delaySettings.min
  );
};

const completeCampaignIfFinished = async (campaignId) => {
  await Campaign.updateOne(
    {
      _id: campaignId,
      recipients: {
        $not: {
          $elemMatch: {
            status: 'pending'
          }
        }
      }
    },
    {
      $set: {
        status: 'Completed'
      }
    }
  );
};

const updateRecipientStatus = async (campaignId, recipientId, status) => {
  await Campaign.updateOne(
    {
      _id: campaignId,
      'recipients._id': recipientId
    },
    {
      $set: {
        'recipients.$.status': status
      }
    }
  );

  await completeCampaignIfFinished(campaignId);
};

const getUsageDate = () => new Date().toISOString().slice(0, 10);

const reserveDomainCapacity = async (domainId) => {
  const usageDate = getUsageDate();
  const domain = await Domain.findOneAndUpdate(
    {
      _id: domainId,
      status: 'Active',
      $or: [
        {
          usageDate: {
            $ne: usageDate
          }
        },
        {
          $expr: {
            $lt: [
              {
                $ifNull: ['$dailyUsage', 0]
              },
              '$dailyLimit'
            ]
          }
        }
      ]
    },
    [
      {
        $set: {
          usageDate,
          dailyUsage: {
            $cond: [
              {
                $eq: ['$usageDate', usageDate]
              },
              {
                $add: [
                  {
                    $ifNull: ['$dailyUsage', 0]
                  },
                  1
                ]
              },
              1
            ]
          }
        }
      }
    ],
    {
      new: true
    }
  );

  if (!domain) {
    throw new Error('Sending domain is disabled or has reached its daily limit');
  }
};

const releaseDomainCapacity = async (domainId) => {
  await Domain.updateOne(
    {
      _id: domainId,
      usageDate: getUsageDate(),
      dailyUsage: {
        $gt: 0
      }
    },
    {
      $inc: {
        dailyUsage: -1
      }
    }
  );
};

const recordDomainDelivery = async (domainId) => {
  await Domain.updateOne(
    {
      _id: domainId
    },
    {
      $inc: {
        totalEmailsSent: 1
      }
    }
  );
};


const processEmailJob = async (job) => {
  const {
    campaignId,
    recipientId,
    userId,
    recipient,
    subject,
    htmlContent,
    sendingDomain,
    delaySettings,
    attachments
  } = job.data;

  let capacityReserved = false;
  let deliveryAccepted = false;
  let userTransport = null;

  try {
    await reserveDomainCapacity(sendingDomain.id);
    capacityReserved = true;

    console.log(`[Worker] Processing email for ${recipient.email} via domain ${sendingDomain.domainName} (${sendingDomain.provider || 'custom'})`);

    // Resolve relay: per-user SMTP config or global fallback
    let relay;
    let isUserSmtp = false;
    let relayName = 'Global Brevo';

    if (userId) {
      const userSmtpConfigs = await SmtpConfig.find({ userId, isActive: true })
        .select('+smtpPass +smtpPassIv +smtpPassTag');

      if (userSmtpConfigs && userSmtpConfigs.length > 0) {
        // Filter SMTP configs that match the sending domain's provider (brevo, sparkpost, custom)
        const domainProvider = sendingDomain.provider || 'custom';
        let matchedConfigs = userSmtpConfigs.filter(c => c.provider === domainProvider);

        if (matchedConfigs.length === 0) {
          console.log(`[Worker] No SMTP configs match domain provider '${domainProvider}'. Falling back to all active SMTP configs.`);
          matchedConfigs = userSmtpConfigs;
        }

        // Pick one at random to rotate through matched active SMTPs
        const userSmtpConfig = matchedConfigs[Math.floor(Math.random() * matchedConfigs.length)];
        console.log(`[Worker] Domain provider: '${domainProvider}'. Active user configs: ${userSmtpConfigs.length}. Matched configs: ${matchedConfigs.length}. Selected SMTP: '${userSmtpConfig.name}' (${userSmtpConfig.provider})`);

        // If provider is 'vps' with a configured HTTP API URL, use Postal HTTP API
        if (userSmtpConfig.provider === 'vps' && userSmtpConfig.vpsApiUrl) {
          try {
            const plainPass = decryptSmtpPassword(
              userSmtpConfig.smtpPass,
              userSmtpConfig.smtpPassIv,
              userSmtpConfig.smtpPassTag
            );
            relayName = `VPS HTTP API (${userSmtpConfig.name || userSmtpConfig.vpsApiUrl})`;
            const postalClient = createPostalClient({
              serverUrl: userSmtpConfig.vpsApiUrl,
              apiKey: plainPass
            });
            relay = {
              sendMail: (mailOptions) => postalClient.sendMail(mailOptions)
            };
            isUserSmtp = true;
            console.log(`[Worker] Using VPS Postal HTTP API: ${userSmtpConfig.vpsApiUrl}`);
          } catch (decryptErr) {
            console.warn(`[Worker] Failed to setup VPS HTTP API ${userSmtpConfig._id}, falling back to SMTP:`, decryptErr.message);
            // Fall through to SMTP below
          }
        }

        if (!relay) {
          try {
            const plainPass = decryptSmtpPassword(
              userSmtpConfig.smtpPass,
              userSmtpConfig.smtpPassIv,
              userSmtpConfig.smtpPassTag
            );
            relayName = `${userSmtpConfig.provider.toUpperCase()} (${userSmtpConfig.name || userSmtpConfig.smtpHost})`;
            userTransport = relayPool.createTransportForUser({
              smtpHost: userSmtpConfig.smtpHost,
              smtpPort: userSmtpConfig.smtpPort,
              smtpUser: userSmtpConfig.smtpUser,
              smtpPass: plainPass
            });
            relay = userTransport;
            isUserSmtp = true;
          } catch (decryptErr) {
            console.warn(`[Worker] Failed to decrypt SMTP config ${userSmtpConfig._id} for user ${userId}, falling back to global:`, decryptErr.message);
            relay = relayPool.getRoundRobin();
            relayName = 'Global Brevo';
          }
        }
      } else {
        console.log(`[Worker] No active SMTP configs for user ${userId}. Falling back to global relay pool.`);
        relay = relayPool.getRoundRobin();
        relayName = 'Global Brevo';
      }
    } else {
      console.log(`[Worker] No userId for job. Falling back to global relay pool.`);
      relay = relayPool.getRoundRobin();
      relayName = 'Global Brevo';
    }

    // Persist chosen SMTP name on the job data so it is visible in the queue event handlers (even if it fails)
    try {
      const updatedData = { ...job.data, relayUsed: relayName };
      await job.updateData(updatedData);
      job.data = updatedData;
    } catch (updateErr) {
      console.warn('[Worker] Failed to update job data with relay info:', updateErr.message);
    }

    // Substitute {{recipientId}} placeholder with the actual recipient ID
    const finalHtml = htmlContent.replace(/\{\{recipientId\}\}/g, recipientId.toString());

    // Generate plain text from HTML
    const plainText = htmlToPlainText(finalHtml);

    const mailOptions = {
      from: {
        name: sendingDomain.senderName,
        address: sendingDomain.senderEmail
      },
      to: {
        name: recipient.name,
        address: recipient.email
      },
      subject,
      html: finalHtml,
      text: plainText,
      messageId: `<${campaignId}.${recipientId}.${crypto.randomUUID()}@${sendingDomain.domainName}>`,
      headers: {
        // commented out for staging demo to land in Primary Inbox instead of Promotions
        // 'Precedence': 'bulk',
        'X-Mailer': 'Mailer/1.0',
        // 'List-Unsubscribe': `<mailto:unsubscribe@${sendingDomain.domainName}?subject=unsubscribe>, <${process.env.BASE_URL || 'http://localhost:4000'}/track/unsubscribe/${campaignId}/${recipientId}>`,
        // 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        // 'Feedback-ID': `${campaignId}:${recipientId}:${sendingDomain.domainName}:Mailer`
      }
    };



    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64',
        contentType: att.contentType
      }));
    }

    await relay.sendMail(mailOptions);
    deliveryAccepted = true;

    // Close user transport to avoid connection leaks
    if (userTransport) {
      userTransport.close();
    }

    await recordDomainDelivery(sendingDomain.id);
    const delaySeconds = getDelaySeconds(delaySettings);
    await sleep(delaySeconds * 1000);
    await updateRecipientStatus(campaignId, recipientId, 'sent');

    return {
      recipient: recipient.email,
      domain: sendingDomain.domainName,
      status: 'sent',
      relayUsed: relayName
    };
  } catch (error) {
    // Close user transport on error too
    if (userTransport) {
      try { userTransport.close(); } catch (_) {}
    }

    if (capacityReserved && !deliveryAccepted) {
      await releaseDomainCapacity(sendingDomain.id);
    }

    const attempts = job.opts.attempts || 1;

    if (job.attemptsMade + 1 >= attempts) {
      await updateRecipientStatus(campaignId, recipientId, 'failed');
    }

    throw error;
  }
};

const startWorker = async () => {
  await connectDB();

  for (let i = 0; i < relayPool.size; i++) {
    const relay = relayPool.getByIndex(i);
    try {
      await relay.verify();
      console.log(`Relay [${i}] verified successfully`);
    } catch (err) {
      console.warn(`Relay [${i}] unreachable: ${err.message}. It will be retried on job attempts.`);
    }
  }

  const worker = new Worker('emailSendingQueue', processEmailJob, {
    connection,
    concurrency: 1
  });

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Email job ${job ? job.id : 'unknown'} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('Email worker error:', error.message);
  });

  const shutdown = async () => {
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Email worker started with ${relayPool.size} relay(s) — IP rotation active`);
};

startWorker().catch((error) => {
  console.error('Unable to start email worker:', error.message);
  process.exit(1);
});
