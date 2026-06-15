const mongoose = require('mongoose');

const smtpConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    provider: {
      type: String,
      enum: ['azure', 'brevo', 'sparkpost', 'custom', 'vps'],
      default: 'custom'
    },
    smtpHost: {
      type: String,
      required: true,
      trim: true
    },
    smtpPort: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
      default: 587
    },
    smtpUser: {
      type: String,
      required: true,
      trim: true
    },
    // Encrypted password fields (AES-256-GCM)
    smtpPass: {
      type: String,
      required: true,
      select: false
    },
    smtpPassIv: {
      type: String,
      required: true,
      select: false
    },
    smtpPassTag: {
      type: String,
      required: true,
      select: false
    },
    // VPS/Postal HTTP API settings (optional — only used when provider is 'vps')
    vpsApiUrl: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastTestedAt: {
      type: Date,
      default: null
    },
    lastTestResult: {
      type: String,
      enum: ['success', 'failed', null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SmtpConfig', smtpConfigSchema);
