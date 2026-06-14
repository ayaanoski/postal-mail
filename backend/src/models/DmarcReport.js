const mongoose = require('mongoose');

const dmarcReportSchema = new mongoose.Schema({
  sourceIp: { type: String, default: '' },
  orgName: { type: String, default: '' },
  email: { type: String, default: '' },
  reportId: { type: String, default: '' },
  policyDomain: { type: String, default: '' },
  policyAdkim: { type: String, default: '' },
  policyAspf: { type: String, default: '' },
  policyP: { type: String, default: '' },
  policySp: { type: String, default: '' },
  policyPct: { type: Number, default: 100 },
  records: [{
    sourceIp: String,
    count: Number,
    disposition: String,
    dkimResult: String,
    spfResult: String,
    envelopeTo: String,
    headerFrom: String
  }],
  rawXml: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DmarcReport', dmarcReportSchema);
