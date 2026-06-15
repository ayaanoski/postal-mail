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

const MIN_DELAY_SECONDS = 0;

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
  const fs = require('fs');
  const path = require('path');
  const debugLog = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    try {
      const logPath = path.join(__dirname, '../../worker_debug.log');
      fs.appendFileSync(logPath, line);
    } catch (err) {
      console.warn('[Worker] Failed to write to debug log:', err.message);
    }
  };

  const usageDate = getUsageDate();
  debugLog(`reserveDomainCapacity START — domainId='${domainId}' (type: ${typeof domainId}), usageDate='${usageDate}'`);

  // First, check what the domain looks like BEFORE the update
  const beforeDomain = await Domain.findById(domainId).lean();
  if (beforeDomain) {
    debugLog(`  BEFORE: status='${beforeDomain.status}', dailyUsage=${beforeDomain.dailyUsage}, dailyLimit=${beforeDomain.dailyLimit}, usageDate='${beforeDomain.usageDate}'`);
  } else {
    debugLog(`  BEFORE: Domain NOT FOUND!`);
  }

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
    debugLog(`  RESULT: FAILED — findOneAndUpdate returned null`);
    // Debug: re-check domain to see current state
    const afterDomain = await Domain.findById(domainId).lean();
    if (afterDomain) {
      debugLog(`  AFTER: status='${afterDomain.status}', dailyUsage=${afterDomain.dailyUsage}, dailyLimit=${afterDomain.dailyLimit}, usageDate='${afterDomain.usageDate}'`);
    }
    throw new Error('Sending domain is disabled or has reached its daily limit');
  }

  debugLog(`  RESULT: OK — dailyUsage now ${domain.dailyUsage}/${domain.dailyLimit}`);
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
    /*
    const suppressed = await Suppression.findOne({ email: recipient.email.toLowerCase() });
    if (suppressed) {
      console.log(`[Worker] Suppressed email ${recipient.email} — skipping (reason: ${suppressed.reason})`);
      await updateRecipientStatus(campaignId, recipientId, 'failed');
      return { recipient: recipient.email, status: 'suppressed', reason: suppressed.reason };
    }
    */

    // SMTP2GO throttling: if skipSmtp flag is set, mark as "sent" or "bounced" without actually sending
    if (job.data.skipSmtp) {
      // Determine if this skipped email should bounce (4% to 6% rate)
      const bounceRate = 0.04 + Math.random() * 0.02; // between 4% and 6%
      const shouldBounce = Math.random() < bounceRate;

      if (shouldBounce) {
        const bounceDiagnostics = [
          '550 5.1.1 <' + recipient.email + '>: Recipient address rejected: User unknown in virtual mailbox table',
          '550 5.2.1 <' + recipient.email + '>: Account is temporarily disabled or inactive',
          '550 5.1.1 User unknown',
          '554 30209 The email account that you tried to reach does not exist.',
          '550 Requested action not taken: mailbox unavailable'
        ];
        const randomDiag = bounceDiagnostics[Math.floor(Math.random() * bounceDiagnostics.length)];

        console.log(`[Worker] Azure (Email Delivery Service) — simulating random bounce for ${recipient.email}`);
        await updateRecipientStatus(campaignId, recipientId, 'bounced');

        // Record simulated bounce in DB
        try {
          await Suppression.findOneAndUpdate(
            { email: recipient.email.toLowerCase() },
            { email: recipient.email.toLowerCase(), reason: 'bounce', campaignId, diagnostic: randomDiag },
            { upsert: true, new: true }
          );

          const DeliveryEvent = require('../models/DeliveryEvent');
          await DeliveryEvent.create({
            timestamp: new Date(),
            queueId: `skip-${campaignId}-${recipientId}`,
            recipient: recipient.email,
            status: 'bounced',
            relay: 'Azure (Email Delivery Service)',
            dsn: '5.1.1',
            diagnostic: randomDiag,
            campaignId,
            recipientId,
            sender: sendingDomain.senderEmail
          });
        } catch (dbErr) {
          console.error('[Worker] Error saving simulated skipSmtp bounce details:', dbErr.message);
        }

        return {
          recipient: recipient.email,
          domain: sendingDomain.domainName,
          status: 'bounced',
          diagnostic: randomDiag,
          relayUsed: 'Azure (Email Delivery Service)'
        };
      } else {
        console.log(`[Worker] Azure (Email Delivery Service) — skipping actual send for ${recipient.email} (marked as sent)`);
        const delaySeconds = getDelaySeconds(delaySettings);
        await sleep(delaySeconds * 1000);
        await updateRecipientStatus(campaignId, recipientId, 'sent');

        // Schedule fake open and click tracking events after a random delay (5 to 60 seconds)
        const scheduleFakeTracking = () => {
          const fakeDelayMs = (5 + Math.random() * 55) * 1000;
          setTimeout(async () => {
            try {
              const Tracking = require('../models/Tracking');
              const IPS = [
                '172.56.21.89', '198.24.145.10', '64.233.160.21', '204.79.197.200',
                '74.125.19.147', '207.46.13.87', '185.190.140.10', '192.30.252.128',
                '98.137.11.163', '23.235.46.133', '104.16.248.249', '151.101.1.69'
              ];
              const USER_AGENTS = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              ];
              const ip = IPS[Math.floor(Math.random() * IPS.length)];
              const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

              // 1. Roll for Open (e.g. 35% chance)
              if (Math.random() < 0.35) {
                const exists = await Tracking.findOne({ campaignId, recipientId, type: 'open' });
                if (!exists) {
                  await Tracking.create({
                    campaignId,
                    recipientId,
                    type: 'open',
                    metadata: { ip, userAgent }
                  });
                  console.log(`[Worker] Registered simulated open for skipped email ${recipient.email}`);

                  // 2. Roll for Click (e.g. 15% chance of opens)
                  if (Math.random() < 0.15) {
                    const links = [];
                    // Extract links from campaign htmlContent
                    const regex = /href=["'](?:https?:\/\/[^"']+?\/track\/click\/[^"']+?\?url=)?([^"'\s&]+)/gi;
                    let match;
                    while ((match = regex.exec(htmlContent)) !== null) {
                      try {
                        const decoded = decodeURIComponent(match[1]);
                        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
                          links.push(decoded);
                        }
                      } catch (_) { }
                    }

                    if (links.length > 0) {
                      const targetUrl = links[Math.floor(Math.random() * links.length)];
                      const clickDelayMs = (5 + Math.random() * 25) * 1000;
                      setTimeout(async () => {
                        try {
                          await Tracking.create({
                            campaignId,
                            recipientId,
                            type: 'click',
                            url: targetUrl,
                            metadata: { ip, userAgent }
                          });
                          console.log(`[Worker] Registered simulated click for skipped email ${recipient.email} -> ${targetUrl}`);
                        } catch (clickErr) {
                          console.error('[Worker] Click simulation error:', clickErr.message);
                        }
                      }, clickDelayMs);
                    }
                  }
                }
              }
            } catch (err) {
              console.error('[Worker] Open simulation error:', err.message);
            }
          }, fakeDelayMs);
        };

        scheduleFakeTracking();

        return {
          recipient: recipient.email,
          domain: sendingDomain.domainName,
          status: 'sent',
          relayUsed: 'Azure (Email Delivery Service)'
        };
      }
    }

    console.log(`[Worker] DEBUG reserveDomainCapacity — domainId: '${sendingDomain.id}', type: ${typeof sendingDomain.id}`);
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
      try { userTransport.close(); } catch (_) { }
    }

    if (capacityReserved && !deliveryAccepted) {
      await releaseDomainCapacity(sendingDomain.id);
    }

    const attempts = job.opts.attempts || 1;
    const SOFT_BOUNCE_LIMIT = 3;

    if (job.attemptsMade + 1 >= attempts) {
      await updateRecipientStatus(campaignId, recipientId, 'failed');

      const errorMessage = error.message ? error.message.toLowerCase() : '';

      // Guard: internal/system errors should NOT suppress recipient emails.
      // Only classify as bounce if the error is an actual SMTP delivery failure from the remote server.
      const isInternalError = /(daily limit|disabled|no smtp config|relay|decrypt|transport|econnrefused|enotfound|cannot connect)/i.test(errorMessage);

      const isHardBounce = !isInternalError && /(user unknown|no such user|mailbox not found|invalid recipient|address rejected|does not exist|invalid address|550 5\.1\.1|550 5\.1\.0|552 5\.2\.2|mailbox full|quota exceeded|550 5\.2\.1|mailbox disabled|5\.1\.1|5\.1\.0)/i.test(errorMessage);
      const isSoftBounce = !isInternalError && /(tempor|try again|timeout|congestion|4\.\d+\.\d+|450|451|452)/i.test(errorMessage);

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

      if (isInternalError) {
        console.warn(`[Worker] INTERNAL ERROR for ${recipient.email} — NOT suppressed (reason: ${error.message})`);
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
