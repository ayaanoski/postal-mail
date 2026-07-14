const mongoose = require('mongoose');

const ipChangerSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  intervalSeconds: {
    type: Number,
    default: 30,
    min: 10,
    max: 300
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ipChangerSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('IpChangerSettings', ipChangerSettingsSchema);
