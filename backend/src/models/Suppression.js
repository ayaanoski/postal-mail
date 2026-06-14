const mongoose = require('mongoose');

const suppressionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  reason: {
    type: String,
    enum: ['bounce', 'soft_bounce', 'complaint', 'unsubscribe', 'manual'],
    required: true
  },
  softBounceCount: {
    type: Number,
    default: 0
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    default: null
  },
  diagnostic: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

suppressionSchema.index({ email: 1, createdAt: -1 });
suppressionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Suppression', suppressionSchema);
