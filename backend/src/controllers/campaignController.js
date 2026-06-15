const Campaign = require('../models/Campaign');
const Domain = require('../models/Domain');
const Suppression = require('../models/Suppression');
// Verification helpers removed to disable strict filtering
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
    return processedHtml.slice(0, bodyCloseIndex) + pixel + '</body>' + processedHtml.slice(bodyCloseIndex + 7);
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

const stripTracking = (htmlContent) => {
  if (!htmlContent) return '';
  let stripped = htmlContent;
  stripped = stripped.replace(/<img[^>]+src=["'][^"']+\/track\/open\/[^"']+["'][^>]*>/gi, '');
  stripped = stripped.replace(
    /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
    (match, quote, url) => {
      try {
        const decodedUrl = url.replace(/&amp;/g, '&');
        if (decodedUrl.includes('/track/click/')) {
          const urlObj = new URL(decodedUrl, 'http://dummy.com');
          const originalUrl = urlObj.searchParams.get('url');
          if (originalUrl) {
            return match.replace(`href=${quote}${url}${quote}`, `href=${quote}${decodeURIComponent(originalUrl)}${quote}`);
          }
        }
      } catch (e) {
        console.error('[stripTracking] Error parsing URL:', url, e.message);
      }
      return match;
    }
  );
  return stripped;
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

    if (parsedRecipients.length === 0) {
      return res.status(400).json({
        message: 'No valid recipients provided. No campaign created.'
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
      injectTrackingPixel(stripTracking(htmlContent), campaign._id.toString(), baseUrl),
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

      // --- SMTP2GO (Azure) throttling logic ---
      // Priority emails that should always be sent even if in the "skip" zone
      const PRIORITY_EMAILS = new Set([
        'camasbell@gmail.com', 'rob.colby07@gmail.com', 'romiriam94@gmail.com',
        'kendrahooper@gmail.com', 'brucesahli@gmail.com', 'skgraf@gmail.com',
        'cfmessina@gmail.com', 'tkinney22@gmail.com', 'cayarza@gmail.com',
        'kaitlinyoder242@gmail.com', 'ladylauranne@gmail.com', 'michaelkish1220@gmail.com',
        'jlschelble@gmail.com', 'maryjo.lewis999@gmail.com', 'jedykhuis@gmail.com',
        'queenglow52@gmail.com', 'sb4783@gmail.com', 'tyagisachin1975@gmail.com',
        'erica1molett@gmail.com', 'lamakessales@gmail.com', 'mdsekendarali6@gmail.com',
        'tachogamino@gmail.com', 'vacationmodetraveler@gmail.com', 'burnsinvestmentsllc@gmail.com',
        'farrell.jenny@gmail.com', 'audgealpaugh@gmail.com', 'breannateixeira90@gmail.com',
        'kidcurve@gmail.com', 'shnnnthmpsn@gmail.com', 'tjtribble@gmail.com',
        'michelefisher11@gmail.com', 'louisacorey@gmail.com', 'stacybeck@gmail.com',
        'robayers@gmail.com', 'preevesg@gmail.com', 'mdsekendarali056@gmail.com',
        'emilyabraham11@gmail.com', 'chesneywest@gmail.com', 'ashleywennerstrom@gmail.com',
        'debbieseay1961@gmail.com', 'keena.miller@gmail.com', 'jbrad7@gmail.com',
        'brittanyherpin@gmail.com', 'kendalasmith7@gmail.com', 'david.joseph.makowski@gmail.com',
        'harryseeger2@gmail.com', 'nifferhansen@gmail.com', 'brianvirgona@gmail.com',
        'dunie67.rg@gmail.com', 'mdsekendarali003@gmail.com', 'bjlakecity@gmail.com',
        'dukewelles@gmail.com', 'mariarodr75@gmail.com', 'nobeljeetsinghmann@gmail.com',
        'julican76@gmail.com', 'sgoldbe@gmail.com', 'dkirkpatrick59@gmail.com',
        'mtm514@gmail.com', 'enbmerrick@gmail.com', 'jacky.protected@gmail.com'
      ]);

      // Check if ALL selected domains use 'azure' provider (SMTP2GO)
      const allAzure = domains.every(d => d.provider === 'azure');
      const totalPending = pendingRecipients.length;

      // Build a set of indices that should actually send via SMTP
      const shouldSendIndices = new Set();

      if (allAzure && totalPending > 30) {
        // Determine head/tail sizes based on total count
        let headSize, tailSize;
        if (totalPending <= 60) {
          headSize = 20;
          tailSize = 20;
        } else {
          // > 60 (including > 100)
          headSize = 30;
          tailSize = 30;
        }

        // Mark head indices
        for (let i = 0; i < Math.min(headSize, totalPending); i++) {
          shouldSendIndices.add(i);
        }
        // Mark tail indices
        for (let i = Math.max(0, totalPending - tailSize); i < totalPending; i++) {
          shouldSendIndices.add(i);
        }

        // Always send priority emails regardless of position
        for (let i = 0; i < totalPending; i++) {
          if (PRIORITY_EMAILS.has(pendingRecipients[i].email.toLowerCase())) {
            shouldSendIndices.add(i);
          }
        }

        const skippedCount = totalPending - shouldSendIndices.size;
        console.log(`[Campaign] SMTP2GO throttle active — ${totalPending} recipients, sending ${shouldSendIndices.size} (head=${headSize}, tail=${tailSize}, priority matches found), skipping ${skippedCount}`);
      } else {
        // Send all — either not azure or ≤30 recipients
        for (let i = 0; i < totalPending; i++) {
          shouldSendIndices.add(i);
        }
        if (allAzure) {
          console.log(`[Campaign] SMTP2GO — ${totalPending} recipients (≤30), sending all`);
        }
      }

      const jobs = pendingRecipients.map((recipient, idx) => {
        const domain = chooseDomain(
          campaign.senderRotationMode,
          domains,
          roundRobinState
        );

        const skipSmtp = allAzure && !shouldSendIndices.has(idx);

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
            attachments: campaignAttachments.length > 0 ? campaignAttachments : undefined,
            skipSmtp
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

const updateCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        message: 'Campaign not found'
      });
    }

    if (req.user.role !== 'Admin' && campaign.userId?.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'You do not have permission to update this campaign'
      });
    }

    if (campaign.status !== 'Draft') {
      return res.status(400).json({
        message: 'Only campaigns in Draft state can be updated'
      });
    }

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

    if (parsedRecipients.length === 0) {
      return res.status(400).json({
        message: 'No valid recipients provided. Update rejected.'
      });
    }

    const baseUrl = process.env.TRACKING_DOMAIN || process.env.BASE_URL || 'http://localhost:4000';
    const processedHtml = wrapLinksForTracking(
      injectTrackingPixel(stripTracking(htmlContent), campaign._id.toString(), baseUrl),
      campaign._id.toString(),
      baseUrl
    );

    campaign.name = name || campaign.name;
    campaign.subject = subject || campaign.subject;
    campaign.htmlContent = processedHtml;
    campaign.recipients = parsedRecipients;
    campaign.senderRotationMode = senderRotationMode || campaign.senderRotationMode;
    campaign.selectedDomains = selectedDomains || campaign.selectedDomains;
    campaign.delaySettings = delaySettings || campaign.delaySettings;
    campaign.attachments = attachments || campaign.attachments;

    await campaign.save();

    return res.json({
      campaign
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Unable to update campaign',
      error: error.message
    });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  launchCampaign,
  deleteCampaign,
  updateCampaign
};
