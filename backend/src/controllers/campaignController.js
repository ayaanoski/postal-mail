const Campaign = require('../models/Campaign');
const Domain = require('../models/Domain');
const Suppression = require('../models/Suppression');
const { isRoleBasedEmail, isHoneypotEmail, isHoneypotDomain, isCatchAllDomain } = require('../utils/emailVerifier');
const { emailSendingQueue } = require('../config/queue');

const getTrackingBaseUrl = () => {
  const base = process.env.TRACKING_DOMAIN || process.env.BASE_URL || 'http://localhost:4000';
  if (isBareIp(base.replace(/^https?:\/\//, '').split('/')[0])) {
    console.warn('[Tracking] WARNING: TRACKING_DOMAIN points to a bare IP. Set TRACKING_DOMAIN to a proper domain for better deliverability.');
  }
  return base.replace(/\/+$/, '');
};

const injectTrackingPixel = (htmlContent, campaignId, baseUrl) => {
  let processedHtml = htmlContent
    .replace(/\{\{campaignId\}\}/g, campaignId)
    .replace(/\{\{baseUrl\}\}/g, baseUrl);

  const trackingBase = getTrackingBaseUrl();
  const pixelUrl = `${trackingBase}/track/open/${campaignId}/{{recipientId}}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" />`;
  const bodyCloseIndex = processedHtml.toLowerCase().lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return processedHtml.slice(0, bodyCloseIndex) + pixel + processedHtml.slice(bodyCloseIndex);
  }
  return processedHtml + pixel;
};

const isBareIp = (hostname) => {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname);
};

const wrapLinksForTracking = (htmlContent, campaignId, baseUrl) => {
  const trackingBase = getTrackingBaseUrl();
  return htmlContent.replace(
    /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
    (match, quote, url) => {
      const decodedUrl = url.replace(/&amp;/g, '&');
      if (
        decodedUrl.startsWith(baseUrl + '/track/') ||
        decodedUrl.startsWith(trackingBase + '/track/') ||
        decodedUrl.startsWith('{{baseUrl}}/track/')
      ) {
        return match;
      }
      if (decodedUrl.startsWith('mailto:') || decodedUrl.startsWith('#')) return match;
      const encoded = encodeURIComponent(decodedUrl);
      const trackUrl = `${trackingBase}/track/click/${campaignId}/{{recipientId}}?url=${encoded}`;
      return match.replace(`href=${quote}${url}${quote}`, `href=${quote}${trackUrl}${quote}`);
    }
  );
};

const createCampaign = async (req, res) => {
  try {
    const {
      name,
      subject,
      htmlContent,
      recipients,
      recipientsRaw,
      senderRotationMode,
      selectedDomains,
      delaySettings,
      attachments
    } = req.body;

    const suppressedEmails = await Suppression.find().distinct('email');

    let parsedRecipients;
    if (Array.isArray(recipients)) {
      parsedRecipients = recipients;
    } else {
      parsedRecipients = (recipientsRaw || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(',').map((part) => part.trim());
          const email = parts.length === 1 ? parts[0] : parts.at(-1);
          const name = parts.length === 1 ? '' : parts.slice(0, -1).join(' ');
          return { name, email: email.toLowerCase(), status: 'pending' };
        })
        .filter((r) => r.email && r.email.includes('@'));
    }

    const roleBasedEmails = [];
    const suppressedFromList = [];
    const honeypotEmails = [];
    const catchAllDomains = [];

    const checkedDomains = new Set();
    const catchAllCache = new Map();

    for (const r of parsedRecipients) {
      const domain = r.email.split('@')[1];
      if (!checkedDomains.has(domain)) {
        checkedDomains.add(domain);
        if (!catchAllCache.has(domain)) {
          try {
            const isCatchAll = await isCatchAllDomain(domain);
            catchAllCache.set(domain, isCatchAll);
          } catch {
            catchAllCache.set(domain, false);
          }
        }
      }
    }

    parsedRecipients = parsedRecipients.filter((r) => {
      if (suppressedEmails.includes(r.email.toLowerCase())) {
        suppressedFromList.push(r.email);
        return false;
      }
      if (isHoneypotEmail(r.email) || isHoneypotDomain(r.email.split('@')[1])) {
        honeypotEmails.push(r.email);
        return false;
      }
      if (isRoleBasedEmail(r.email)) {
        roleBasedEmails.push(r.email);
        return false;
      }
      const domain = r.email.split('@')[1];
      if (catchAllCache.get(domain)) {
        catchAllDomains.push(r.email);
        return false;
      }
      return true;
    });

    const filteredCounts = [];
    if (roleBasedEmails.length > 0) filteredCounts.push(`${roleBasedEmails.length} role-based`);
    if (suppressedFromList.length > 0) filteredCounts.push(`${suppressedFromList.length} suppressed`);
    if (honeypotEmails.length > 0) filteredCounts.push(`${honeypotEmails.length} honeypot`);
    if (catchAllDomains.length > 0) filteredCounts.push(`${catchAllDomains.length} catch-all domain`);
    if (filteredCounts.length > 0) {
      console.log(`[Campaign] Filtered: ${filteredCounts.join(', ')}`);
    }

    if (parsedRecipients.length === 0) {
      return res.status(400).json({
        message: 'All recipients were filtered out (role-based, suppressed, or invalid emails). No campaign created.'
      });
    }

    // Create Campaign first to get the _id for tracking links/pixel
    const campaign = await Campaign.create({
      name,
      subject,
      htmlContent: 'temp',
      recipients: parsedRecipients,
      senderRotationMode,
      selectedDomains,
      delaySettings,
      attachments: attachments || [],
      status: 'Draft',
      userId: req.user.id
    });

    const baseUrl = process.env.TRACKING_DOMAIN || process.env.BASE_URL || 'http://localhost:4000';
    const processedHtml = wrapLinksForTracking(
      injectTrackingPixel(htmlContent, campaign._id.toString(), baseUrl),
      campaign._id.toString(),
      baseUrl
    );

    campaign.htmlContent = processedHtml;
    await campaign.save();

    return res.status(201).json({
      campaign
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Unable to create campaign',
      error: error.message
    });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'Admin') {
      filter.userId = req.user.id;
    }
    if (req.query.userId && req.user.role === 'Admin') {
      filter.userId = req.query.userId;
    }

    const campaigns = await Campaign.find(filter)
      .populate(
        'selectedDomains',
        'domainName senderEmail senderName status'
      )
      .sort({ createdAt: -1 });

    return res.json({
      campaigns
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve campaigns',
      error: error.message
    });
  }
};

const chooseDomain = (mode, domains, roundRobinState) => {
  if (mode === 'Fixed') {
    return domains[0];
  }

  if (mode === 'Random') {
    return domains[Math.floor(Math.random() * domains.length)];
  }

  const domain = domains[roundRobinState.index];
  roundRobinState.index = (roundRobinState.index + 1) % domains.length;
  return domain;
};

const launchCampaign = async (req, res) => {
  let campaign;
  let originalRoundRobinIndex;

  try {
    campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        message: 'Campaign not found'
      });
    }

    if (req.user.role !== 'Admin' && campaign.userId?.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'You do not have permission to launch this campaign'
      });
    }

    if (campaign.status !== 'Draft') {
      return res.status(409).json({
        message: `Campaign cannot be launched while its status is ${campaign.status}`
      });
    }

    const activeDomains = await Domain.find({
      _id: {
        $in: campaign.selectedDomains
      },
      status: 'Active'
    });

    const domainsById = new Map(
      activeDomains.map((domain) => [domain._id.toString(), domain])
    );
    const domains = campaign.selectedDomains
      .map((domainId) => domainsById.get(domainId.toString()))
      .filter(Boolean);

    if (domains.length === 0) {
      return res.status(400).json({
        message: 'Campaign requires at least one selected Active domain'
      });
    }

    const pendingRecipients = campaign.recipients.filter(
      (recipient) => recipient.status === 'pending'
    );

    if (pendingRecipients.length === 0) {
      campaign.status = 'Completed';
      await campaign.save();

      return res.json({
        message: 'Campaign has no pending recipients and is now Completed',
        queuedJobs: 0,
        campaign
      });
    }

    originalRoundRobinIndex = campaign.currentRoundRobinIndex;
    const roundRobinState = {
      index: originalRoundRobinIndex % domains.length
    };

      const campaignAttachments = (campaign.attachments || []).map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }));

      const jobs = pendingRecipients.map((recipient) => {
        const domain = chooseDomain(
          campaign.senderRotationMode,
          domains,
          roundRobinState
        );

        return {
          name: 'send-email',
          data: {
            campaignId: campaign._id.toString(),
            recipientId: recipient._id.toString(),
            userId: (campaign.userId || req.user.id).toString(),
            recipient: {
              name: recipient.name,
              email: recipient.email
            },
            subject: campaign.subject,
            htmlContent: campaign.htmlContent,
            sendingDomain: {
              id: domain._id.toString(),
              domainName: domain.domainName,
              senderEmail: domain.senderEmail,
              senderName: domain.senderName,
              dkimSelector: domain.dkimSelector,
              dkimPrivateKey: domain.dkimPrivateKey,
              provider: domain.provider || 'custom'
            },
            delaySettings: campaign.delaySettings.toObject(),
            attachments: campaignAttachments.length > 0 ? campaignAttachments : undefined
          },
        opts: {
          jobId: `${campaign._id.toString()}-${recipient._id.toString()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      };
    });

    const updatedCampaign = await Campaign.findOneAndUpdate(
      {
        _id: campaign._id,
        status: 'Draft'
      },
      {
        $set: {
          status: 'Running',
          currentRoundRobinIndex: roundRobinState.index
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedCampaign) {
      return res.status(409).json({
        message: 'Campaign has already been launched'
      });
    }

    await emailSendingQueue.addBulk(jobs);

    return res.json({
      message: 'Campaign launched successfully',
      queuedJobs: jobs.length,
      campaign: updatedCampaign
    });
  } catch (error) {
    if (campaign && originalRoundRobinIndex !== undefined) {
      await Campaign.updateOne(
        {
          _id: campaign._id,
          status: 'Running'
        },
        {
          $set: {
            status: 'Draft',
            currentRoundRobinIndex: originalRoundRobinIndex
          }
        }
      ).catch(() => {});
    }

    return res.status(500).json({
      message: 'Unable to launch campaign',
      error: error.message
    });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const Tracking = require('../models/Tracking');
    const DeliveryEvent = require('../models/DeliveryEvent');

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (req.user.role !== 'Admin' && campaign.userId?.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'You do not have permission to delete this campaign'
      });
    }

    await Campaign.findByIdAndDelete(campaignId);
    await Tracking.deleteMany({ campaignId });
    await DeliveryEvent.deleteMany({ campaignId });

    return res.json({ message: 'Campaign deleted successfully', id: campaignId });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete campaign',
      error: error.message
    });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  launchCampaign,
  deleteCampaign
};
