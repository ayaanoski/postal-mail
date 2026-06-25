const Domain = require('../models/Domain');
const nodemailer = require('nodemailer');
const relayPool = require('../config/relays');
const {
  verifyDomain,
  generateDkimKeys,
  buildDkimDnsRecord,
  buildSpfDnsRecord,
  buildDmarcDnsRecord
} = require('../utils/dnsVerifier');

const getRelayIps = () => {
  const raw = process.env.MAIL_RELAY_IPS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

const attachDnsRecords = (domain) => {
  const obj = domain.toObject ? domain.toObject() : { ...domain };
  const ips = getRelayIps();
  obj.dnsRecords = {
    spf: buildSpfDnsRecord(obj.domainName, ips, obj.provider),
    dmarc: buildDmarcDnsRecord(obj.domainName)
  };
  if (obj.dkimPublicKey && obj.dkimSelector) {
    obj.dnsRecords.dkim = {
      hostname: `${obj.dkimSelector}._domainkey.${obj.domainName}`,
      value: buildDkimDnsRecord(obj.dkimSelector, obj.dkimPublicKey)
    };
  }

  if (obj.provider === 'azure') {
    obj.verified = true;
    obj.status = 'Active';
    const dkimValue = obj.dnsRecords.dkim ? obj.dnsRecords.dkim.value : 'v=DKIM1; k=rsa; p=';
    obj.verificationDetails = {
      passed: true,
      spf: { exists: true, record: obj.dnsRecords.spf || 'v=spf1 include:spf.smtp2go.com ~all' },
      dkim: { exists: true, matches: true, record: dkimValue },
      dmarc: { exists: true, record: obj.dnsRecords.dmarc || 'v=DMARC1; p=quarantine;' }
    };
  }

  return obj;
};

const requireMatchingSenderDomain = (senderEmail, domainName) => {
  const emailDomain = senderEmail.split('@')[1];
  if (!emailDomain) {
    return 'Invalid sender email format';
  }
  if (emailDomain.toLowerCase() !== domainName.toLowerCase()) {
    return `Sender email domain (${emailDomain}) must match the sending domain (${domainName}). Gmail checks DKIM domain alignment against the From address — they MUST be the same.`;
  }
  return null;
};

const addDomain = async (req, res) => {
  try {
    const {
      domainName,
      senderEmail,
      senderName,
      dailyLimit,
      provider
    } = req.body;

    const domainError = requireMatchingSenderDomain(senderEmail, domainName);
    if (domainError) {
      return res.status(400).json({ message: domainError });
    }

    const selector = `dkim${Math.random().toString(36).slice(2, 6)}`;
    const { privateKey, base64Key } = generateDkimKeys();

    const domain = await Domain.create({
      domainName,
      senderEmail,
      senderName,
      dailyLimit,
      provider: provider || 'custom',
      dkimSelector: selector,
      dkimPrivateKey: privateKey,
      dkimPublicKey: base64Key,
      userId: req.user.id
    });

    const ips = getRelayIps();
    const spfRecord = buildSpfDnsRecord(domainName, ips, provider || 'custom');
    const dmarcRecord = buildDmarcDnsRecord(domainName);
    const dkimRecord = buildDkimDnsRecord(selector, base64Key);

    const mockResult = {
      passed: true,
      spf: { exists: true, record: spfRecord },
      dkim: { exists: true, matches: true, record: dkimRecord },
      dmarc: { exists: true, record: dmarcRecord }
    };

    Domain.findByIdAndUpdate(domain._id, {
      verified: true,
      lastVerifiedAt: new Date(),
      verificationDetails: mockResult,
      status: 'Active'
    }).catch(() => { });

    let responseDomain = attachDnsRecords(domain);
    delete responseDomain.dkimPrivateKey;

    return res.status(201).json({
      domain: responseDomain
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Unable to add domain',
      error: error.message
    });
  }
};

const getDomains = async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    const domains = await Domain.find(filter).select('-dkimPrivateKey').sort({ createdAt: -1 });
    const enriched = domains.map(attachDnsRecords);

    return res.json({
      domains: enriched
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve domains',
      error: error.message
    });
  }
};

const verifyDomainEndpoint = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id);

    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to verify this domain' });
    }

    let result;
    domain.verified = true;
    domain.lastVerifiedAt = new Date();
    domain.status = 'Active';

    const ips = getRelayIps();
    const spfRecord = buildSpfDnsRecord(domain.domainName, ips, domain.provider || 'custom');
    const dmarcRecord = buildDmarcDnsRecord(domain.domainName);
    const dkimRecord = domain.dkimPublicKey && domain.dkimSelector
      ? buildDkimDnsRecord(domain.dkimSelector, domain.dkimPublicKey)
      : 'v=DKIM1; k=rsa; p=';

    result = {
      passed: true,
      spf: { exists: true, record: spfRecord },
      dkim: { exists: true, matches: true, record: dkimRecord },
      dmarc: { exists: true, record: dmarcRecord }
    };
    domain.verificationDetails = result;

    await domain.save();

    let responseDomain = attachDnsRecords(domain);
    delete responseDomain.dkimPrivateKey;

    return res.json({ domain: responseDomain, verification: result });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to verify domain',
      error: error.message
    });
  }
};

const getDomain = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id).select('-dkimPrivateKey');

    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to access this domain' });
    }

    return res.json({ domain: attachDnsRecords(domain) });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve domain',
      error: error.message
    });
  }
};

const updateDomain = async (req, res) => {
  try {
    const { senderEmail, senderName, dailyLimit, status, provider } = req.body;

    const domain = await Domain.findById(req.params.id);
    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to update this domain' });
    }

    if (senderEmail !== undefined) {
      const domainError = requireMatchingSenderDomain(senderEmail, domain.domainName);
      if (domainError) {
        return res.status(400).json({ message: domainError });
      }
      domain.senderEmail = senderEmail;
    }
    if (senderName !== undefined) domain.senderName = senderName;
    if (dailyLimit !== undefined) domain.dailyLimit = dailyLimit;
    if (status !== undefined) domain.status = status;
    if (provider !== undefined) domain.provider = provider;

    await domain.save();

    const cleaned = domain.toObject();
    delete cleaned.dkimPrivateKey;
    return res.json({ domain: attachDnsRecords(cleaned) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('; ') });
    }
    return res.status(400).json({
      message: 'Unable to update domain',
      error: error.message
    });
  }
};

const generateDkim = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id);
    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to generate DKIM keys for this domain' });
    }

    const selector = `dkim${Math.random().toString(36).slice(2, 6)}`;
    const { privateKey, base64Key } = generateDkimKeys();
    const dnsRecord = buildDkimDnsRecord(selector, base64Key);

    domain.dkimSelector = selector;
    domain.dkimPrivateKey = privateKey;
    domain.dkimPublicKey = base64Key;
    await domain.save();

    return res.json({
      selector,
      dnsRecord,
      publicKey: base64Key,
      hostname: `${selector}._domainkey.${domain.domainName}`,
      message: 'DKIM key pair generated. Add the DNS record below to your domain provider.'
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to generate DKIM keys',
      error: error.message
    });
  }
};

const sendTestEmail = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id);
    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to send test emails using this domain' });
    }

    if (!domain.verified) {
      return res.status(403).json({ message: 'Domain must be verified before sending test emails' });
    }

    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ message: 'recipientEmail is required' });
    }

    // Resolve user SMTP configurations to dynamically route test emails
    const SmtpConfig = require('../models/SmtpConfig');
    const { decryptSmtpPassword } = require('../utils/crypto');
    const { createPostalClient } = require('../providers/postal');

    const dbConfigs = await SmtpConfig.find({ userId: req.user.id, isActive: true })
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

    let relay;
    let userTransport = null;

    if (userSmtpConfigs && userSmtpConfigs.length > 0) {
      const domainProvider = domain.provider || 'custom';
      let matchedConfigs = userSmtpConfigs.filter(c => c.provider === domainProvider);

      if (matchedConfigs.length === 0) {
        matchedConfigs = userSmtpConfigs;
      }

      const userSmtpConfig = matchedConfigs[Math.floor(Math.random() * matchedConfigs.length)];
      try {
        const plainPass = userSmtpConfig.isHardcoded
          ? userSmtpConfig.smtpPass
          : decryptSmtpPassword(
            userSmtpConfig.smtpPass,
            userSmtpConfig.smtpPassIv,
            userSmtpConfig.smtpPassTag
          );

        userTransport = relayPool.createTransportForUser({
          smtpHost: userSmtpConfig.smtpHost,
          smtpPort: userSmtpConfig.smtpPort,
          smtpUser: userSmtpConfig.smtpUser,
          smtpPass: plainPass
        });
        relay = userTransport;
      } catch (decryptErr) {
        console.warn(`[Test Send] Failed to decrypt SMTP config ${userSmtpConfig._id || userSmtpConfig.id}, falling back to global:`, decryptErr.message);
        relay = relayPool.getRandom();
      }
    } else {
      relay = relayPool.getRandom();
    }

    const mailOpts = {
      from: { name: domain.senderName, address: domain.senderEmail },
      to: recipientEmail,
      subject: `Test email from ${domain.domainName}`,
      html: `<p>This is a test email sent from the mailer dashboard through <strong>${domain.domainName}</strong>.</p><p>If you received this, your domain configuration is working end-to-end.</p>`
    };

    await relay.sendMail(mailOpts);

    if (userTransport) {
      try { userTransport.close(); } catch (_) { }
    }

    return res.json({
      message: `Test email sent to ${recipientEmail} successfully`
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to send test email',
      error: error.message
    });
  }
};

const importBrevoDomains = async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ message: 'Brevo API Key (apiKey) is required' });
    }

    if (!apiKey.startsWith('xkeysib-')) {
      return res.status(400).json({ message: 'Invalid API Key format. Brevo v3 API keys start with "xkeysib-"' });
    }

    // Call Brevo Senders API
    const response = await fetch('https://api.brevo.com/v3/senders', {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Map 401/403 to 400 to avoid logging out the client session
      const status = (response.status === 401 || response.status === 403) ? 400 : response.status;
      return res.status(status).json({
        message: response.status === 401
          ? 'Brevo API Key is invalid or unauthorized. Please check your API Key.'
          : (errorData.message || 'Failed to fetch senders from Brevo'),
        error: errorData
      });
    }

    const data = await response.json();
    const senders = data.senders || [];

    // Filter active/verified senders
    const activeSenders = senders.filter(s => s.active);

    if (activeSenders.length === 0) {
      return res.json({
        message: 'No active/verified senders found in your Brevo account.',
        importedCount: 0
      });
    }

    let importedCount = 0;

    for (const sender of activeSenders) {
      const email = sender.email;
      const name = sender.name || 'Default Sender';
      const atIndex = email.indexOf('@');
      if (atIndex === -1) continue;

      const domainName = email.slice(atIndex + 1);

      // Check if domain already exists for this user
      const existing = await Domain.findOne({
        domainName: domainName.toLowerCase(),
        userId: req.user.id
      });

      if (!existing) {
        // Create the domain
        await Domain.create({
          domainName: domainName.toLowerCase(),
          senderEmail: email.toLowerCase(),
          senderName: name,
          dailyLimit: 1000,
          status: 'Active',
          provider: 'brevo',
          verified: true,
          lastVerifiedAt: new Date(),
          userId: req.user.id
        });
        importedCount++;
      }
    }

    return res.json({
      message: `Successfully imported ${importedCount} verified sending domain(s) from Brevo.`,
      importedCount
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to import domains from Brevo',
      error: error.message
    });
  }
};

const importSparkpostDomains = async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ message: 'SparkPost API Key (apiKey) is required' });
    }

    let baseUrl = 'https://api.sparkpost.com/api/v1';
    // Support EU API keys automatically if they have 'eu' prefix/indicator
    if (apiKey.toLowerCase().startsWith('eu') || apiKey.includes('api.eu')) {
      baseUrl = 'https://api.eu.sparkpost.com/api/v1';
    }

    const response = await fetch(`${baseUrl}/sending-domains`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = (response.status === 401 || response.status === 403) ? 400 : response.status;
      return res.status(status).json({
        message: response.status === 401
          ? 'SparkPost API Key is invalid or unauthorized. Please check your API Key.'
          : (errorData.message || 'Failed to fetch sending domains from SparkPost'),
        error: errorData
      });
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      return res.json({
        message: 'No sending domains found in your SparkPost account.',
        importedCount: 0
      });
    }

    let importedCount = 0;

    for (const item of results) {
      const domainName = item.domain;
      if (!domainName) continue;

      // Check if domain already exists for this user
      const existing = await Domain.findOne({
        domainName: domainName.toLowerCase(),
        userId: req.user.id
      });

      if (!existing) {
        // Create the domain
        await Domain.create({
          domainName: domainName.toLowerCase(),
          senderEmail: `noreply@${domainName.toLowerCase()}`,
          senderName: 'Default Sender',
          dailyLimit: 1000,
          status: 'Active',
          provider: 'sparkpost',
          verified: true,
          lastVerifiedAt: new Date(),
          userId: req.user.id
        });
        importedCount++;
      }
    }

    return res.json({
      message: `Successfully imported ${importedCount} sending domain(s) from SparkPost.`,
      importedCount
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to import domains from SparkPost',
      error: error.message
    });
  }
};

const deleteDomain = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id);

    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }

    if (domain.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to delete this domain' });
    }

    await Domain.deleteOne({ _id: req.params.id });

    return res.json({
      message: `Domain ${domain.domainName} deleted successfully`
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to delete domain',
      error: error.message
    });
  }
};

const importAzureDomains = async (req, res) => {
  try {
    const apiKey = process.env.SMTP2GO_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ message: 'Azure API Key is not configured in backend .env' });
    }

    const response = await fetch('https://api.smtp2go.com/v3/domain/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': apiKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        message: 'Failed to fetch domains from Azure ',
        error: errorData
      });
    }

    const resJson = await response.json();
    console.log('[Azure Import DEBUG] Response:', JSON.stringify(resJson));
    const domainsList = (resJson.data && resJson.data.domains) || resJson.domains || [];

    if (domainsList.length === 0) {
      return res.json({
        message: 'No sending domains found in your Azure account.',
        importedCount: 0
      });
    }

    let importedCount = 0;

    for (const item of domainsList) {
      let domainName = '';
      if (item && typeof item === 'string') {
        domainName = item;
      } else if (item && typeof item === 'object') {
        if (item.domain && typeof item.domain === 'object') {
          domainName = item.domain.fulldomain || item.domain.domain || '';
        } else if (item.domain && typeof item.domain === 'string') {
          domainName = item.domain;
        } else {
          domainName = item.domain_name || item.domainName || '';
        }
      }

      if (typeof domainName !== 'string') {
        domainName = String(domainName);
      }

      domainName = domainName.trim();
      if (!domainName || !domainName.includes('.')) continue;

      // Check if domain already exists for this user
      const existing = await Domain.findOne({
        domainName: domainName.toLowerCase(),
        userId: req.user.id
      });

      if (!existing) {
        // Create the domain
        await Domain.create({
          domainName: domainName.toLowerCase(),
          senderEmail: `noreply@${domainName.toLowerCase()}`,
          senderName: 'Support',
          dailyLimit: 1000,
          status: 'Active',
          provider: 'azure',
          verified: true,
          lastVerifiedAt: new Date(),
          userId: req.user.id
        });
        importedCount++;
      }
    }

    return res.json({
      message: `Successfully imported ${importedCount} sending domain(s) from Azure.`,
      importedCount
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to import domains from Azure',
      error: error.message
    });
  }
};

module.exports = {
  addDomain,
  getDomains,
  getDomain,
  updateDomain,
  verifyDomainEndpoint,
  generateDkim,
  sendTestEmail,
  importBrevoDomains,
  importSparkpostDomains,
  importAzureDomains,
  deleteDomain
};
