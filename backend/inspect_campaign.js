const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mailer');
  console.log('Connected to MongoDB');

  const Campaign = require('./src/models/Campaign');
  const campaign = await Campaign.findById('6a2a99ea5c325d949b3b4f57');
  console.log('\n--- CAMPAIGN ---');
  console.log({
    id: campaign._id,
    name: campaign.name,
    userId: campaign.userId,
    status: campaign.status,
    recipientsCount: campaign.recipients.length
  });

  console.log('\n--- RECIPIENTS STATUSES ---');
  campaign.recipients.forEach(r => {
    console.log({
      id: r._id,
      email: r.email,
      status: r.status
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
