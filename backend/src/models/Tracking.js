const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['open', 'click', 'unsubscribe'],
      required: true,
      index: true
    },
    url: {
      type: String,
      default: null
    },
    metadata: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null }
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast per-campaign aggregation
trackingEventSchema.index({ campaignId: 1, type: 1 });

// TTL index: auto-delete events older than 90 days
trackingEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('Tracking', trackingEventSchema);
