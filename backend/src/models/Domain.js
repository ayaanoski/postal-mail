const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema(
  {
    domainName: {
      type: String,
      required: true,
      trim: true
    },
    senderEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    dailyLimit: {
      type: Number,
      required: true,
      min: 1
    },
    dailyUsage: {
      type: Number,
      default: 0,
      min: 0
    },
    usageDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10)
    },
    totalEmailsSent: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['Active', 'Disabled', 'Pending Verification'],
      default: 'Pending Verification'
    },
    provider: {
      type: String,
      enum: ['azure', 'brevo', 'sparkpost', 'custom'],
      default: 'custom'
    },
    verified: {
      type: Boolean,
      default: false
    },
    lastVerifiedAt: {
      type: Date,
      default: null
    },
    verificationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    dkimSelector: {
      type: String,
      default: 'default'
    },
    dkimPrivateKey: {
      type: String,
      default: null
    },
    dkimPublicKey: {
      type: String,
      default: null
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

domainSchema.pre('validate', function requireMatchingDomain(next) {
  const emailDomain = this.senderEmail.split('@')[1];
  if (emailDomain && emailDomain.toLowerCase() !== this.domainName.toLowerCase()) {
    this.invalidate(
      'senderEmail',
      `Sender email domain "${emailDomain}" must match the sending domain "${this.domainName}". DKIM requires both to be the same domain.`
    );
  }
  next();
});

module.exports = mongoose.model('Domain', domainSchema);
