const WarmupConfig = require('../models/WarmupConfig');

const getWarmupStatus = async (req, res) => {
  try {
    let config = await WarmupConfig.findOne({ singleton: 'global' });
    if (!config) {
      config = await WarmupConfig.create({ singleton: 'global' });
    }
    return res.json({
      enabled: config.enabled,
      dayNumber: config.getDayNumber(),
      phase: config.getPhaseLabel(),
      maxDaily: config.getMaxDailyEmails(),
      dailySent: config.dailySent,
      startDate: config.startDate,
      manualDailyLimit: config.manualDailyLimit
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to get warmup status', error: error.message });
  }
};

const updateWarmupConfig = async (req, res) => {
  try {
    const { enabled, manualDailyLimit, resetStartDate } = req.body;
    let config = await WarmupConfig.findOne({ singleton: 'global' });
    if (!config) {
      config = new WarmupConfig({ singleton: 'global' });
    }
    if (enabled !== undefined) config.enabled = enabled;
    if (manualDailyLimit !== undefined) config.manualDailyLimit = manualDailyLimit;
    if (resetStartDate) config.startDate = new Date();
    if (resetStartDate || enabled !== undefined) {
      config.dailySent = 0;
      config.lastResetDate = '';
    }
    await config.save();
    return res.json({
      enabled: config.enabled,
      dayNumber: config.getDayNumber(),
      phase: config.getPhaseLabel(),
      maxDaily: config.getMaxDailyEmails(),
      dailySent: config.dailySent,
      startDate: config.startDate,
      manualDailyLimit: config.manualDailyLimit
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update warmup config', error: error.message });
  }
};

const getGlobalLimits = async (req, res) => {
  try {
    let config = await WarmupConfig.findOne({ singleton: 'global' });
    if (!config) {
      config = await WarmupConfig.create({ singleton: 'global' });
    }
    return res.json({
      maxDaily: config.getMaxDailyEmails(),
      remaining: config.getMaxDailyEmails() - config.dailySent,
      dailySent: config.dailySent
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to get limits', error: error.message });
  }
};

module.exports = { getWarmupStatus, updateWarmupConfig, getGlobalLimits };
