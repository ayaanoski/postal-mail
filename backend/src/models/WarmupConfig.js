const mongoose = require('mongoose');

const PHASES = [
  { maxDay: 3, maxEmails: 50, label: 'Initial' },
  { maxDay: 7, maxEmails: 100, label: 'Early' },
  { maxDay: 14, maxEmails: 200, label: 'Building' },
  { maxDay: 21, maxEmails: 500, label: 'Growing' },
  { maxDay: 28, maxEmails: 2000, label: 'Ramping' },
  { maxDay: 42, maxEmails: 5000, label: 'Scaling' },
  { maxDay: 56, maxEmails: 15000, label: 'Maturing' },
  { maxDay: Infinity, maxEmails: 50000, label: 'Warmed' }
];

const warmupConfigSchema = new mongoose.Schema({
  singleton: {
    type: String,
    default: 'global',
    unique: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  manualDailyLimit: {
    type: Number,
    default: null
  },
  dailySent: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

warmupConfigSchema.methods.getDayNumber = function () {
  const start = new Date(this.startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

warmupConfigSchema.methods.getPhase = function () {
  const day = this.getDayNumber();
  for (const phase of PHASES) {
    if (day <= phase.maxDay) return phase;
  }
  return PHASES[PHASES.length - 1];
};

warmupConfigSchema.methods.getMaxDailyEmails = function () {
  if (this.manualDailyLimit !== null && this.manualDailyLimit > 0) {
    return this.manualDailyLimit;
  }
  if (!this.enabled) return Infinity;
  return this.getPhase().maxEmails;
};

warmupConfigSchema.methods.getPhaseLabel = function () {
  if (!this.enabled) return 'Manual';
  return this.getPhase().label;
};

warmupConfigSchema.statics.reserveSlot = async function () {
  const today = new Date().toISOString().slice(0, 10);
  const config = await this.findOne({ singleton: 'global' });
  if (!config) return true;

  if (config.lastResetDate !== today) {
    config.dailySent = 0;
    config.lastResetDate = today;
    await config.save();
  }

  const maxDaily = config.getMaxDailyEmails();
  if (config.dailySent >= maxDaily) return false;

  config.dailySent += 1;
  await config.save();
  return true;
};

warmupConfigSchema.statics.releaseSlot = async function () {
  const today = new Date().toISOString().slice(0, 10);
  const config = await this.findOne({ singleton: 'global' });
  if (!config) return;
  if (config.lastResetDate !== today) return;
  if (config.dailySent > 0) {
    config.dailySent -= 1;
    await config.save();
  }
};

module.exports = mongoose.model('WarmupConfig', warmupConfigSchema);
