const DmarcReport = require('../models/DmarcReport');

const getDmarcReports = async (req, res) => {
  try {
    const reports = await DmarcReport.find().sort({ createdAt: -1 }).limit(50);
    return res.json({ reports });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to retrieve DMARC reports', error: error.message });
  }
};

const getDmarcSummary = async (req, res) => {
  try {
    const total = await DmarcReport.countDocuments();
    const passRate = await DmarcReport.aggregate([
      { $unwind: '$records' },
      { $group: {
        _id: null,
        total: { $sum: '$records.count' },
        passed: { $sum: { $cond: [{ $eq: ['$records.disposition', 'none'] }, '$records.count', 0] } },
        failed: { $sum: { $cond: [{ $ne: ['$records.disposition', 'none'] }, '$records.count', 0] } }
      }}
    ]);
    return res.json({ total, stats: passRate[0] || { total: 0, passed: 0, failed: 0 } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to get DMARC summary', error: error.message });
  }
};

module.exports = { getDmarcReports, getDmarcSummary };
