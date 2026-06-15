const express = require('express');
const {
  register,
  login,
  getMe,
  getPendingUsers,
  approveUser,
  rejectUser,
  getEmployees,
  getEmployeeById,
  getEmployeeCampaigns,
  deleteUser,
  protect,
  adminOnly
} = require('../controllers/authController');
const {
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
} = require('../controllers/domainController');
const {
  getSeeds,
  addSeed,
  deleteSeed,
  toggleSeed,
  bulkImportSeeds
} = require('../controllers/seedRecipientController');
const {
  getSmtpConfig,
  createSmtpConfig,
  updateSmtpConfig,
  deleteSmtpConfig,
  testSmtpConnection
} = require('../controllers/smtpConfigController');
const {
  getWarmupStatus,
  updateWarmupConfig,
  getGlobalLimits
} = require('../controllers/warmupController');
const {
  createCampaign,
  getCampaigns,
  launchCampaign,
  deleteCampaign
} = require('../controllers/campaignController');
const {
  getCampaignStats,
  getOverviewStats,
  deleteTrackingEvent
} = require('../controllers/statsController');
const {
  getEventStream,
  clearMailQueue,
  flushMailQueue,
  exportFailedEvents,
  getEventStats,
  clearAllEvents,
  deleteEvent
} = require('../controllers/eventController');

const relayPool = require('../config/relays');

const router = express.Router();

// Public config endpoint — exposes non-sensitive server settings to the frontend
router.get('/config', (req, res) => {
  const relayPool = require('../config/relays');
  res.json({
    transportMode: relayPool.providers.length > 0 ? 'multi-provider' : 'none',
    availableProviders: ['azure', 'brevo', 'sparkpost', 'custom'],
    activeGlobalProviders: relayPool.getProviderNames()
  });
});

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);

router.get('/users/pending', protect, adminOnly, getPendingUsers);
router.post('/users/approve/:id', protect, adminOnly, approveUser);
router.post('/users/reject/:id', protect, adminOnly, rejectUser);
router.get('/users/employees', protect, adminOnly, getEmployees);
router.get('/users/employees/:id', protect, adminOnly, getEmployeeById);
router.get('/users/employees/:id/campaigns', protect, adminOnly, getEmployeeCampaigns);
router.delete('/users/:id', protect, adminOnly, deleteUser);

router.post('/domains', protect, addDomain);
router.post('/domains/import-brevo', protect, importBrevoDomains);
router.post('/domains/import-sparkpost', protect, importSparkpostDomains);
router.post('/domains/import-azure', protect, importAzureDomains);
router.get('/domains', protect, getDomains);
router.get('/domains/:id', protect, getDomain);
router.put('/domains/:id', protect, updateDomain);
router.delete('/domains/:id', protect, deleteDomain);
router.post('/domains/:id/verify', protect, verifyDomainEndpoint);
router.post('/domains/:id/dkim/generate', protect, generateDkim);
router.post('/domains/:id/test-send', protect, sendTestEmail);

router.post('/campaigns', protect, createCampaign);
router.get('/campaigns', protect, getCampaigns);
router.post('/campaigns/:id/launch', protect, launchCampaign);
router.delete('/campaigns/:id', protect, deleteCampaign);

// Delivery events (Postfix log stream)
router.get('/events/stream', protect, getEventStream);
router.get('/events/stats', protect, getEventStats);
router.get('/events/export-failed', protect, exportFailedEvents);
router.post('/events/clear-queue', protect, adminOnly, clearMailQueue);
router.post('/events/flush-queue', protect, adminOnly, flushMailQueue);
router.delete('/events', protect, clearAllEvents);
router.delete('/events/:id', protect, deleteEvent);

// Email validation (MX check)
router.post('/validate-emails', protect, async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) return res.status(400).json({ message: 'emails array required' });
    const { hasMxRecord } = require('../utils/emailVerifier');
    const results = [];
    for (const raw of emails) {
      const email = String(raw).trim().toLowerCase();
      const parts = email.split('@');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        results.push({ email, valid: false, reason: 'invalid_format' });
        continue;
      }
      const mxExists = await hasMxRecord(parts[1]);
      results.push({ email, valid: true, mxExists, reason: mxExists ? 'ok' : 'no_mx' });
    }
    return res.json({ results });
  } catch (error) {
    return res.status(500).json({ message: 'Validation failed', error: error.message });
  }
});

// Seed recipient routes (warmup accelerator)
router.get('/seeds', protect, getSeeds);
router.post('/seeds', protect, adminOnly, addSeed);
router.post('/seeds/bulk-import', protect, adminOnly, bulkImportSeeds);
router.delete('/seeds/:id', protect, adminOnly, deleteSeed);
router.post('/seeds/:id/toggle', protect, adminOnly, toggleSeed);

// DMARC report monitoring
const { getDmarcReports, getDmarcSummary } = require('../controllers/monitoringController');
router.get('/dmarc-reports', protect, getDmarcReports);
router.get('/dmarc-reports/summary', protect, getDmarcSummary);

// Warmup schedule routes
router.get('/warmup', protect, getWarmupStatus);
router.put('/warmup', protect, adminOnly, updateWarmupConfig);
router.get('/warmup/limits', protect, getGlobalLimits);

// Tracking analytics routes
router.get('/campaigns/:id/stats', protect, getCampaignStats);
router.get('/stats/overview', protect, getOverviewStats);
router.delete('/tracking/:id', protect, adminOnly, deleteTrackingEvent);

// Per-user SMTP configuration (Brevo / custom SMTP)
router.get('/smtp-config', protect, getSmtpConfig);
router.post('/smtp-config', protect, createSmtpConfig);
router.put('/smtp-config/:id', protect, updateSmtpConfig);
router.delete('/smtp-config/:id', protect, deleteSmtpConfig);
router.post('/smtp-config/test', protect, testSmtpConnection);

// Suppression list
router.get('/suppressions', protect, async (req, res) => {
  try {
    const Suppression = require('../models/Suppression');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Suppression.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Suppression.countDocuments()
    ]);
    return res.json({ suppressions: items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch suppressions', error: error.message });
  }
});

router.delete('/suppressions/:id', protect, adminOnly, async (req, res) => {
  try {
    const Suppression = require('../models/Suppression');
    await Suppression.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Suppression removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove suppression', error: error.message });
  }
});

module.exports = router;

