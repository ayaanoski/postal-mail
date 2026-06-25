const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Tracking = require('../models/Tracking');
const DeliveryEvent = require('../models/DeliveryEvent');
const { getParser } = require('./postfixLogParser');

// Configurable simulation rates
const BOUNCE_RATE = parseFloat(process.env.SIMULATED_BOUNCE_RATE || '0.02'); // 2%
const OPEN_RATE = parseFloat(process.env.SIMULATED_OPEN_RATE || '0.35');     // 35%
const CLICK_RATE = parseFloat(process.env.SIMULATED_CLICK_RATE || '0.15');   // 15% of opens

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

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomDelay = (minSec, maxSec) => Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;

const extractOriginalLinks = (html) => {
  const links = [];
  const regex = /href=["'](?:https?:\/\/[^"']+?\/track\/click\/[^"']+?\?url=)?([^"'\s&]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        links.push(decoded);
      }
    } catch (_) {}
  }
  // Fallback: check standard links
  const stdRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  while ((match = stdRegex.exec(html)) !== null) {
    if (!match[1].includes('/track/click/')) {
      links.push(match[1]);
    }
  }
  return [...new Set(links)];
};

/**
 * Runs simulation logic for a completed email job.
 * Handles simulated bounces, opens, and link clicks with natural-looking random delays.
 */
const runSimulation = async (campaignId, recipientId, recipientEmail, htmlContent, sendingDomain, relayUsed) => {
  const parser = getParser();
  const bounceRoll = Math.random();

  if (bounceRoll < BOUNCE_RATE) {
    // --- Simulate Bounce ---
    console.log(`[Simulation] Simulating BOUNCE for ${recipientEmail}`);

    try {
      // 1. Update recipient status in Campaign
      await Campaign.updateOne(
        { _id: campaignId, 'recipients._id': recipientId },
        { $set: { 'recipients.$.status': 'bounced' } }
      );

      // 2. Inject bounce event into the stream/db
      const diagnostic = '550 5.1.1 User unknown / mailbox unavailable or disabled';
      parser.injectEvent({
        status: 'bounced',
        recipient: recipientEmail,
        domain: sendingDomain.domainName,
        campaignId,
        recipientId,
        dsn: '5.1.1',
        diagnostic,
        relay: relayUsed,
        sender: sendingDomain.senderEmail
      });


    } catch (err) {
      console.error('[Simulation] Error recording simulated bounce:', err.message);
    }
    return;
  }

  // --- No bounce: mark as Sent ---
  parser.injectEvent({
    status: 'sent',
    recipient: recipientEmail,
    domain: sendingDomain.domainName,
    campaignId,
    recipientId,
    relay: relayUsed,
    sender: sendingDomain.senderEmail
  });

  // Roll for Open
  const openRoll = Math.random();
  if (openRoll < OPEN_RATE) {
    const openDelay = getRandomDelay(10, 120); // 10s to 2m delay
    console.log(`[Simulation] Scheduled OPEN for ${recipientEmail} in ${openDelay / 1000}s`);

    setTimeout(async () => {
      try {
        const ip = getRandomItem(IPS);
        const userAgent = getRandomItem(USER_AGENTS);

        // 1. Create open tracking log
        const exists = await Tracking.findOne({ campaignId, recipientId, type: 'open' });
        if (!exists) {
          await Tracking.create({
            campaignId,
            recipientId,
            type: 'open',
            metadata: { ip, userAgent }
          });
          console.log(`[Simulation] Registered simulated OPEN event for ${recipientEmail}`);
        }

        // Roll for Click (only if opened)
        const clickRoll = Math.random();
        if (clickRoll < CLICK_RATE) {
          const links = extractOriginalLinks(htmlContent);
          if (links.length > 0) {
            const targetUrl = getRandomItem(links);
            const clickDelay = getRandomDelay(10, 90); // 10s to 1.5m after open
            console.log(`[Simulation] Scheduled CLICK for ${recipientEmail} to ${targetUrl} in ${clickDelay / 1000}s`);

            setTimeout(async () => {
              try {
                // 2. Create click tracking log
                await Tracking.create({
                  campaignId,
                  recipientId,
                  type: 'click',
                  url: targetUrl,
                  metadata: { ip, userAgent }
                });
                console.log(`[Simulation] Registered simulated CLICK event for ${recipientEmail} -> ${targetUrl}`);
              } catch (clickErr) {
                console.error('[Simulation] Error registering simulated click:', clickErr.message);
              }
            }, clickDelay);
          }
        }
      } catch (openErr) {
        console.error('[Simulation] Error registering simulated open:', openErr.message);
      }
    }, openDelay);
  }
};

module.exports = {
  runSimulation
};
