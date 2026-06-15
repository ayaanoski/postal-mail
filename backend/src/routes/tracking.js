const express = require('express');
const mongoose = require('mongoose');
const Tracking = require('../models/Tracking');
const Suppression = require('../models/Suppression');

const router = express.Router();

// 1x1 transparent GIF buffer (43 bytes)
const pixelGif = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /track/open/:campaignId/:recipientId
 * Logs an email open event and returns a transparent 1x1 GIF.
 */
router.get('/open/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(pixelGif);

  // Run database logging asynchronously to avoid slowing down mail clients
  try {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return;
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // Check if open event already exists to prevent double-counting overview metrics
    const exists = await Tracking.findOne({
      campaignId,
      recipientId,
      type: 'open'
    });

    if (!exists) {
      await Tracking.create({
        campaignId,
        recipientId,
        type: 'open',
        metadata: { ip, userAgent }
      });
      console.log(`[Tracking] Registered open event: Campaign ${campaignId}, Recipient ${recipientId}`);
    }
  } catch (error) {
    console.error('[Tracking] Error logging open event:', error.message);
  }
});

/**
 * GET /track/click/:campaignId/:recipientId
 * Logs a link click event and redirects to the target destination.
 */
router.get('/click/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Bad Request: Missing redirection URL');
  }

  // Redirect immediately to keep user experience responsive
  res.redirect(302, targetUrl);

  try {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return;
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // Log the click event (clicks are always logged, even duplicate clicks)
    await Tracking.create({
      campaignId,
      recipientId,
      type: 'click',
      url: targetUrl,
      metadata: { ip, userAgent }
    });
    console.log(`[Tracking] Registered click event: Campaign ${campaignId}, Recipient ${recipientId}, URL ${targetUrl}`);
  } catch (error) {
    console.error('[Tracking] Error logging click event:', error.message);
  }
});

/**
 * GET & POST /track/unsubscribe/:campaignId/:recipientId
 * Handles web unsubscribe link clicks and RFC 8058 One-Click unsubscribe POST requests.
 */
router.all('/unsubscribe/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;

  try {
    if (mongoose.Types.ObjectId.isValid(campaignId) && mongoose.Types.ObjectId.isValid(recipientId)) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;

      // Log the unsubscribe event if not already tracked
      const exists = await Tracking.findOne({
        campaignId,
        recipientId,
        type: 'unsubscribe'
      });

      if (!exists) {
        await Tracking.create({
          campaignId,
          recipientId,
          type: 'unsubscribe',
          metadata: { ip, userAgent }
        });
        console.log(`[Tracking] Registered unsubscribe event: Campaign ${campaignId}, Recipient ${recipientId}`);
      }
    }
  } catch (error) {
    console.error('[Tracking] Error logging unsubscribe event:', error.message);
  }

  // Record suppression for unsubscribe
  if (mongoose.Types.ObjectId.isValid(campaignId) && mongoose.Types.ObjectId.isValid(recipientId)) {
    try {
      const Campaign = mongoose.model('Campaign');
      const campaign = await Campaign.findById(campaignId);
      const recipient = campaign?.recipients?.id(recipientId);
      if (recipient?.email) {
        await Suppression.findOneAndUpdate(
          { email: recipient.email.toLowerCase() },
          { email: recipient.email.toLowerCase(), reason: 'unsubscribe', campaignId },
          { upsert: true, new: true }
        );
      }
    } catch (_) {}
  }

  // If one-click unsubscribe request (POST), respond with 200 OK per RFC 8058 spec
  if (req.method === 'POST') {
    return res.status(200).send('Unsubscribed successfully');
  }

  // Otherwise, render a clean, visually polished unsubscribe success page
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribe Confirmation</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #131416;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background-color: #1e1f22;
          border: 1px solid #2d2e33;
          border-radius: 24px;
          padding: 40px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        .logo-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: #2d2e33;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          color: #c4f772;
        }
        h1 {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 12px;
          color: #ffffff;
          letter-spacing: -0.5px;
        }
        p {
          font-size: 13px;
          color: #9b9c9f;
          line-height: 1.6;
          margin: 0 0 28px;
          font-weight: 500;
        }
        .success-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(196, 247, 114, 0.1);
          color: #c4f772;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h1>Successfully Unsubscribed</h1>
        <p>Your email has been removed from this mailing list. You will no longer receive campaigns from this sender.</p>
        <span class="success-badge">Preferences Updated</span>
      </div>
    </body>
    </html>
  `);
});

/**
 * POST /track/fbl
 * Feedback Loop (ARF) endpoint for abuse complaints from providers.
 * Accepts multipart/form-data or application/x-www-form-urlencoded reports.
 */
router.post('/fbl', express.urlencoded({ extended: true, limit: '10mb' }), async (req, res) => {
  try {
    const rawBody = req.body;
    let complaintEmail = null;

    if (rawBody && typeof rawBody === 'object') {
      const bodyStr = JSON.stringify(rawBody);

      const emailMatch = bodyStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        complaintEmail = emailMatch[0].toLowerCase();
      }
    }

    if (complaintEmail) {
      await Suppression.findOneAndUpdate(
        { email: complaintEmail },
        { email: complaintEmail, reason: 'complaint', diagnostic: `FBL: ${JSON.stringify(rawBody).substring(0, 500)}` },
        { upsert: true, new: true }
      );
      console.log(`[FBL] Recorded abuse complaint for ${complaintEmail}`);
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[FBL] Error processing feedback:', error.message);
    return res.status(200).send('OK');
  }
});

/**
 * POST /track/bounce
 * Async bounce notification endpoint for SMTP providers (SES SNS, SendGrid Event Webhook, Brevo Webhook).
 * Accepts JSON or form-encoded payloads from various providers.
 */
router.post('/bounce', express.json({ limit: '5mb' }), express.urlencoded({ extended: true, limit: '5mb' }), async (req, res) => {
  try {
    const body = req.body;
    let bouncedEmails = [];
    let bounceType = 'hard';

    // AWS SES SNS notification format
    if (body.bounce || body.Bounce) {
      const bounce = body.bounce || body.Bounce;
      bounceType = (bounce.bounceType || bounce.bounceType || '').toLowerCase() === 'permanent' ? 'hard' : 'soft';
      if (bounce.bouncedRecipients) {
        bouncedEmails = bounce.bouncedRecipients.map((r) => r.emailAddress || r.emailAddress || r.recipient).filter(Boolean);
      }
    }

    // SendGrid Event Webhook format
    if (Array.isArray(body)) {
      for (const event of body) {
        if (event.event === 'bounce' || event.event === 'blocked') {
          bounceType = event.event === 'bounce' ? 'hard' : 'soft';
          if (event.email) bouncedEmails.push(event.email);
        }
        if (event.event === 'spamreport' || event.event === 'abuse') {
          if (event.email) {
            await Suppression.findOneAndUpdate(
              { email: event.email.toLowerCase() },
              { email: event.email.toLowerCase(), reason: 'complaint', diagnostic: `Provider webhook: ${event.event}` },
              { upsert: true, new: true }
            );
          }
        }
      }
    }

    // Brevo webhook format
    if (body.event && body.email) {
      if (body.event === 'hard_bounce' || body.event === 'blocked') {
        bouncedEmails.push(body.email);
      } else if (body.event === 'soft_bounce') {
        bouncedEmails.push(body.email);
        bounceType = 'soft';
      } else if (body.event === 'spam' || body.event === 'unsubscribed') {
        await Suppression.findOneAndUpdate(
          { email: body.email.toLowerCase() },
          { email: body.email.toLowerCase(), reason: 'complaint', diagnostic: `Brevo webhook: ${body.event}` },
          { upsert: true, new: true }
        );
      }
    }

    // Mailgun webhook format
    if (body['event-data']) {
      const eventData = body['event-data'];
      const email = eventData.recipient;
      const eventType = eventData.event;
      if (email && (eventType === 'failed' || eventType === 'bounced')) {
        const severity = (eventData.severity || '').toLowerCase();
        bouncedEmails.push(email);
        bounceType = (severity === 'temporary') ? 'soft' : 'hard';
      }
    }

    for (const email of bouncedEmails) {
      const normalizedEmail = email.toLowerCase().trim();
      if (bounceType === 'hard') {
        await Suppression.findOneAndUpdate(
          { email: normalizedEmail },
          { email: normalizedEmail, reason: 'bounce', diagnostic: `Async webhook bounce` },
          { upsert: true, new: true }
        );
        console.log(`[BounceWebhook] Hard bounce recorded: ${normalizedEmail}`);
      } else {
        const existing = await Suppression.findOne({ email: normalizedEmail, reason: 'soft_bounce' });
        const newCount = (existing?.softBounceCount || 0) + 1;
        if (newCount >= 3) {
          await Suppression.findOneAndUpdate(
            { email: normalizedEmail },
            { email: normalizedEmail, reason: 'bounce', softBounceCount: newCount, diagnostic: 'Suppressed after 3 async soft bounces' },
            { upsert: true, new: true }
          );
          console.log(`[BounceWebhook] Suppressed ${normalizedEmail} after ${newCount} async soft bounces`);
        } else {
          await Suppression.findOneAndUpdate(
            { email: normalizedEmail, reason: 'soft_bounce' },
            { email: normalizedEmail, reason: 'soft_bounce', softBounceCount: newCount, diagnostic: 'Async webhook soft bounce' },
            { upsert: true, new: true }
          );
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[BounceWebhook] Error:', error.message);
    return res.status(200).send('OK');
  }
});

module.exports = router;
