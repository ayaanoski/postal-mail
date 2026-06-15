const nodemailer = require('nodemailer');
const SmtpConfig = require('../models/SmtpConfig');
const { encryptSmtpPassword, decryptSmtpPassword } = require('../utils/crypto');

/**
 * GET /api/smtp-config
 * Returns all of the current user's SMTP configs.
 */
const getSmtpConfig = async (req, res) => {
  try {
    const configs = await SmtpConfig.find({ userId: req.user.id })
      .select('+smtpPass +smtpPassIv +smtpPassTag');

    const formattedConfigs = configs.map(config => {
      let plainPass = '••••••••';
      try {
        plainPass = decryptSmtpPassword(config.smtpPass, config.smtpPassIv, config.smtpPassTag);
      } catch (decErr) {
        console.warn('Failed to decrypt password for config:', config._id, decErr.message);
      }
      return {
        id: config._id,
        name: config.name || config.smtpUser || `${config.provider} (${config.smtpHost})`,
        provider: config.provider,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: plainPass,
        vpsApiUrl: config.vpsApiUrl || null,
        isActive: config.isActive,
        lastTestedAt: config.lastTestedAt,
        lastTestResult: config.lastTestResult,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      };
    });

    // Inject hardcoded Azure / SMTP2GO configuration
    const smtp2goHost = process.env.SMTP2GO_HOST || 'mail.smtp2go.com';
    const smtp2goPort = parseInt(process.env.SMTP2GO_PORT || '2525', 10);
    const smtp2goUser = process.env.SMTP2GO_USER || 'azure-default-user';

    formattedConfigs.unshift({
      id: 'azure-hardcoded-config-id',
      name: 'Azure Email Service',
      provider: 'azure',
      smtpHost: smtp2goHost,
      smtpPort: smtp2goPort,
      smtpUser: smtp2goUser,
      smtpPass: '••••••••',
      vpsApiUrl: null,
      isActive: true,
      isHardcoded: true,
      lastTestedAt: new Date(),
      lastTestResult: 'success',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return res.json({
      configs: formattedConfigs,
      usingGlobal: false
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch SMTP configurations',
      error: error.message
    });
  }
};

/**
 * POST /api/smtp-config
 * Create a new SMTP config.
 */
const createSmtpConfig = async (req, res) => {
  try {
    const { name, provider, smtpHost, smtpPort, smtpUser, smtpPass, isActive, vpsApiUrl } = req.body;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({ message: 'smtpHost, smtpUser, and smtpPass are required' });
    }

    const { encrypted, iv, tag } = encryptSmtpPassword(smtpPass);

    const config = await SmtpConfig.create({
      userId: req.user.id,
      name: name || `${provider || 'custom'} (${smtpHost})`,
      provider: provider || 'custom',
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpUser,
      smtpPass: encrypted,
      smtpPassIv: iv,
      smtpPassTag: tag,
      vpsApiUrl: provider === 'vps' ? (vpsApiUrl || null) : null,
      isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res.status(201).json({
      message: 'SMTP configuration created',
      config: {
        id: config._id,
        name: config.name,
        provider: config.provider,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: smtpPass,
        vpsApiUrl: config.vpsApiUrl,
        isActive: config.isActive
      }
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Unable to create SMTP configuration',
      error: error.message
    });
  }
};

/**
 * PUT /api/smtp-config/:id
 * Update an existing SMTP config.
 */
const updateSmtpConfig = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'azure-hardcoded-config-id') {
      return res.status(403).json({ message: 'Cannot modify system-hardcoded configuration' });
    }
    const { name, provider, smtpHost, smtpPort, smtpUser, smtpPass, isActive, vpsApiUrl } = req.body;

    const existing = await SmtpConfig.findOne({ _id: id, userId: req.user.id });

    if (!existing) {
      return res.status(404).json({ message: 'SMTP configuration not found' });
    }

    if (name !== undefined) existing.name = name;
    if (provider !== undefined) existing.provider = provider;
    if (smtpHost !== undefined) existing.smtpHost = smtpHost;
    if (smtpPort !== undefined) existing.smtpPort = smtpPort;
    if (smtpUser !== undefined) existing.smtpUser = smtpUser;
    if (typeof isActive === 'boolean') existing.isActive = isActive;
    if (vpsApiUrl !== undefined) existing.vpsApiUrl = vpsApiUrl;

    const needsPasswordUpdate = !!smtpPass && smtpPass !== '••••••••';
    if (needsPasswordUpdate) {
      const { encrypted, iv, tag } = encryptSmtpPassword(smtpPass);
      existing.smtpPass = encrypted;
      existing.smtpPassIv = iv;
      existing.smtpPassTag = tag;
    }

    await existing.save();

    let plainPass = '••••••••';
    try {
      plainPass = decryptSmtpPassword(existing.smtpPass, existing.smtpPassIv, existing.smtpPassTag);
    } catch (decErr) {
      console.warn('Failed to decrypt password for config on update:', existing._id, decErr.message);
    }

    return res.json({
      message: 'SMTP configuration updated',
      config: {
        id: existing._id,
        name: existing.name,
        provider: existing.provider,
        smtpHost: existing.smtpHost,
        smtpPort: existing.smtpPort,
        smtpUser: existing.smtpUser,
        smtpPass: plainPass,
        vpsApiUrl: existing.vpsApiUrl || null,
        isActive: existing.isActive,
        lastTestedAt: existing.lastTestedAt,
        lastTestResult: existing.lastTestResult
      }
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Unable to update SMTP configuration',
      error: error.message
    });
  }
};

/**
 * DELETE /api/smtp-config/:id
 * Remove a specific SMTP config.
 */
const deleteSmtpConfig = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'azure-hardcoded-config-id') {
      return res.status(403).json({ message: 'Cannot delete system-hardcoded configuration' });
    }
    const result = await SmtpConfig.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!result) {
      return res.status(404).json({ message: 'SMTP configuration not found' });
    }

    return res.json({ message: 'SMTP configuration removed successfully.' });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to remove SMTP configuration',
      error: error.message
    });
  }
};

/**
 * POST /api/smtp-config/test
 * Test SMTP connection with provided (or saved) credentials.
 */
const testSmtpConnection = async (req, res) => {
  try {
    let { id, smtpHost, smtpPort, smtpUser, smtpPass, provider, vpsApiUrl } = req.body;

    if (id === 'azure-hardcoded-config-id') {
      smtpHost = process.env.SMTP2GO_HOST || 'mail.smtp2go.com';
      smtpPort = parseInt(process.env.SMTP2GO_PORT || '2525', 10);
      smtpUser = process.env.SMTP2GO_USER;
      smtpPass = process.env.SMTP2GO_PASS;
      provider = 'azure';
      if (!smtpUser || !smtpPass) {
        return res.status(400).json({ message: 'Azure Email Service credentials are not set in backend .env' });
      }
    } else if (id && (!smtpPass || smtpPass === '••••••••')) {
      const stored = await SmtpConfig.findOne({ _id: id, userId: req.user.id })
        .select('+smtpPass +smtpPassIv +smtpPassTag');

      if (!stored) {
        return res.status(404).json({ message: 'SMTP configuration not found' });
      }

      smtpPass = decryptSmtpPassword(stored.smtpPass, stored.smtpPassIv, stored.smtpPassTag);
      if (!smtpHost) smtpHost = stored.smtpHost;
      if (!smtpPort) smtpPort = stored.smtpPort;
      if (!smtpUser) smtpUser = stored.smtpUser;
      if (!provider) provider = stored.provider;
      if (!vpsApiUrl) vpsApiUrl = stored.vpsApiUrl;
    } else if (!smtpPass || smtpPass === '••••••••') {
      return res.status(400).json({ message: 'Password is required' });
    }

    // For VPS provider with HTTP API URL, test the API endpoint instead of SMTP
    if (provider === 'vps' && vpsApiUrl) {
      try {
        // Temporarily disable TLS verification for self-signed certificates
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        const response = await fetch(`${vpsApiUrl.replace(/\/+$/, '')}/api/v1/send/raw`, {
          method: 'POST',
          headers: {
            'X-Server-API-Key': smtpPass,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000)
        });

        const data = await response.json();
        
        if (data.status === 'error' && data.data && data.data.code === 'InvalidServerAPIKey') {
          throw new Error('Invalid Postal API Key');
        }

        if (!response.ok && response.status >= 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (id) {
          await SmtpConfig.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { lastTestedAt: new Date(), lastTestResult: 'success' }
          );
        }

        return res.json({ message: 'VPS Postal HTTP API connection successful', result: 'success' });
      } catch (apiErr) {
        if (id) {
          await SmtpConfig.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { lastTestedAt: new Date(), lastTestResult: 'failed' }
          ).catch(() => {});
        }
        return res.status(400).json({
          message: `VPS HTTP API connection failed: ${apiErr.message}`,
          error: apiErr.message,
          result: 'failed'
        });
      }
    }

    // Standard SMTP test
    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({ message: 'smtpHost, smtpUser, and smtpPass are required' });
    }

    const port = Number(smtpPort) || 587;

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    await transport.verify();
    transport.close();

    if (id && id !== 'azure-hardcoded-config-id') {
      await SmtpConfig.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { lastTestedAt: new Date(), lastTestResult: 'success' }
      );
    }

    return res.json({ message: 'SMTP connection successful', result: 'success' });
  } catch (error) {
    if (req.body.id && req.body.id !== 'azure-hardcoded-config-id') {
      await SmtpConfig.findOneAndUpdate(
        { _id: req.body.id, userId: req.user.id },
        { lastTestedAt: new Date(), lastTestResult: 'failed' }
      ).catch(() => {});
    }

    return res.status(400).json({
      message: 'SMTP connection failed',
      error: error.message,
      result: 'failed'
    });
  }
};

module.exports = {
  getSmtpConfig,
  createSmtpConfig,
  updateSmtpConfig,
  deleteSmtpConfig,
  testSmtpConnection
};
