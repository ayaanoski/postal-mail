const mongoose = require('mongoose');

const deliveryEventSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    queueId: {
      type: String,
      default: 'manual'
    },
    recipient: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      index: true
    },
    sender: {
      type: String,
      default: ''
    },
    relay: {
      type: String,
      default: ''
    },
    delay: {
      type: Number,
      default: 0
    },
    dsn: {
      type: String,
      default: ''
    },
    diagnostic: {
      type: String,
      default: ''
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      index: true
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DeliveryEvent', deliveryEventSchema);
