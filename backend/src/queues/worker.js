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
const Suppression = require('../models/Suppression');
const { decryptSmtpPassword } = require('../utils/crypto');
const { createPostalClient } = require('../providers/postal');

const htmlToPlainText = (html) => {
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<a[^>]+href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<img[^>]+alt=["']([^"']*)["'][^>]*>/gi, '$1')
    .replace(/<img[^>]*>/gi, '[image]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text || text.length < 10) {
    text = 'This email contains rich formatting. Some email clients may not display it correctly.';
  }

  return text;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const MIN_DELAY_SECONDS = 30;

const getDelaySeconds = (delaySettings) => {
  let delay;
  if (delaySettings.type === 'fixed') {
    delay = delaySettings.fixedValue;
  } else {
    delay =
      Math.random() * (delaySettings.max - delaySettings.min) +
      delaySettings.min;
  }
  return Math.max(delay, MIN_DELAY_SECONDS);
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
    const suppressed = await Suppression.findOne({ email: recipient.email.toLowerCase() });
    if (suppressed) {
      console.log(`[Worker] Suppressed email ${recipient.email} — skipping (reason: ${suppressed.reason})`);
      await updateRecipientStatus(campaignId, recipientId, 'failed');
      return { recipient: recipient.email, status: 'suppressed', reason: suppressed.reason };
    }

    await reserveDomainCapacity(sendingDomain.id);
    capacityReserved = true;

    console.log(`[Worker] Processing email for ${recipient.email} via domain ${sendingDomain.domainName} (${sendingDomain.provider || 'custom'})`);

    // Resolve relay: per-user SMTP config or global fallback
    let relay;
    let isUserSmtp = false;
    let relayName = 'Global (round-robin)';

    const tryAssignRelay = (name) => {
      const r = relayPool.getByProviderName(name);
      if (r) {
        relay = r;
        relayName = `Global ${name}`;
        return true;
      }
      return false;
    };

    if (userId) {
      const dbConfigs = await SmtpConfig.find({ userId, isActive: true })
        .select('+smtpPass +smtpPassIv +smtpPassTag');

      const userSmtpConfigs = dbConfigs.map(c => c.toObject());

      // Inject hardcoded Azure / SMTP2GO config
      const smtp2goHost = process.env.SMTP2GO_HOST || 'mail.smtp2go.com';
      const smtp2goPort = parseInt(process.env.SMTP2GO_PORT || '2525', 10);
      const smtp2goUser = process.env.SMTP2GO_USER;
      const smtp2goPass = process.env.SMTP2GO_PASS;

      if (smtp2goUser && smtp2goPass) {
        userSmtpConfigs.unshift({
          _id: 'azure-hardcoded-config-id',
          name: 'Azure Email Service',
          provider: 'azure',
          smtpHost: smtp2goHost,
          smtpPort: smtp2goPort,
          smtpUser: smtp2goUser,
          smtpPass: smtp2goPass,
          isActive: true,
          isHardcoded: true
        });
      }

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
            console.warn(`[Worker] Failed to setup VPS HTTP API ${userSmtpConfig._id || userSmtpConfig.id}, falling back to SMTP:`, decryptErr.message);
            // Fall through to SMTP below
          }
        }

        if (!relay) {
          try {
            const plainPass = userSmtpConfig.isHardcoded
              ? userSmtpConfig.smtpPass
              : decryptSmtpPassword(
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
            console.warn(`[Worker] Failed to decrypt SMTP config ${userSmtpConfig._id || userSmtpConfig.id} for user ${userId}, falling back to global:`, decryptErr.message);
            if (!tryAssignRelay(sendingDomain.provider)) {
              relay = relayPool.getRoundRobin();
              relayName = `Global (round-robin)`;
            }
          }
        }
      } else {
        console.log(`[Worker] No active SMTP configs for user ${userId}. Falling back to global relay pool.`);
        if (!tryAssignRelay(sendingDomain.provider)) {
          relay = relayPool.getRoundRobin();
          relayName = `Global (round-robin)`;
        }
      }
    } else {
      console.log(`[Worker] No userId for job. Falling back to global relay pool.`);
      if (!tryAssignRelay(sendingDomain.provider)) {
        relay = relayPool.getRoundRobin();
        relayName = `Global (round-robin)`;
      }
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

    const trackingBase = (process.env.TRACKING_DOMAIN || process.env.BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
    const isBareIp = (hostname) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname);
    if (isBareIp(trackingBase.replace(/^https?:\/\//, '').split('/')[0])) {
      console.warn(`[Worker] WARNING: Unsubscribe URL uses bare IP (${trackingBase}). Set TRACKING_DOMAIN to a proper domain with HTTPS.`);
    }
    const unsubscribeUrl = `${trackingBase}/track/unsubscribe/${campaignId}/${recipientId}`;

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
      list: {
        unsubscribe: {
          url: unsubscribeUrl,
          comment: 'Unsubscribe from this campaign'
        }
      },
      headers: {
        'Precedence': 'bulk',
        'List-Unsubscribe': `<mailto:unsubscribe@${sendingDomain.domainName}?subject=unsubscribe>, <${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Feedback-ID': `${campaignId}:${recipientId}:${sendingDomain.domainName}:Mailer`
      }
    };

    if (sendingDomain.dkimPrivateKey && sendingDomain.dkimSelector) {
      mailOptions.dkim = {
        domainName: sendingDomain.domainName,
        keySelector: sendingDomain.dkimSelector,
        privateKey: sendingDomain.dkimPrivateKey
      };
    }



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
    const SOFT_BOUNCE_LIMIT = 3;

    if (job.attemptsMade + 1 >= attempts) {
      await updateRecipientStatus(campaignId, recipientId, 'failed');

      const errorMessage = error.message ? error.message.toLowerCase() : '';
      const isHardBounce = /(user unknown|no such user|mailbox not found|invalid recipient|address rejected|does not exist|invalid address|550 5\.1\.1|550 5\.1\.0|552 5\.2\.2|mailbox full|quota exceeded|550 5\.2\.1|mailbox disabled|5\.1\.1|5\.1\.0)/i.test(errorMessage);
      const isSoftBounce = /(tempor|try again|timeout|congestion|4\.\d+\.\d+|450|451|452)/i.test(errorMessage);

      try {
        if (isHardBounce) {
          await Suppression.findOneAndUpdate(
            { email: recipient.email.toLowerCase() },
            { email: recipient.email.toLowerCase(), reason: 'bounce', campaignId, diagnostic: error.message.substring(0, 500) },
            { upsert: true, new: true }
          );
          console.log(`[Worker] Added ${recipient.email} to suppression list (hard bounce)`);
        } else if (isSoftBounce) {
          const existing = await Suppression.findOne({ email: recipient.email.toLowerCase(), reason: 'soft_bounce' });
          const newCount = (existing?.softBounceCount || 0) + 1;
          if (newCount >= SOFT_BOUNCE_LIMIT) {
            await Suppression.findOneAndUpdate(
              { email: recipient.email.toLowerCase() },
              { email: recipient.email.toLowerCase(), reason: 'bounce', softBounceCount: newCount, campaignId, diagnostic: `Suppressed after ${newCount} soft bounces` },
              { upsert: true, new: true }
            );
            console.log(`[Worker] Added ${recipient.email} to suppression list (${newCount} consecutive soft bounces)`);
          } else {
            await Suppression.findOneAndUpdate(
              { email: recipient.email.toLowerCase(), reason: 'soft_bounce' },
              { email: recipient.email.toLowerCase(), reason: 'soft_bounce', softBounceCount: newCount, campaignId, diagnostic: error.message.substring(0, 200) },
              { upsert: true, new: true }
            );
            console.log(`[Worker] Soft bounce #${newCount} for ${recipient.email}`);
          }
        }
      } catch (supErr) {
        console.warn('[Worker] Failed to record suppression:', supErr.message);
      }
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
