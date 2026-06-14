const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

async function run() {
  const redisUrl = `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;
  console.log('Connecting to Redis:', redisUrl);
  const redis = new Redis(redisUrl);

  // Get keys matching our campaign
  const keys = await redis.keys('*6a2a9bf67c38e87dac677481*');
  console.log('Found keys:', keys);

  for (const key of keys) {
    const type = await redis.type(key);
    console.log(`\nKey: ${key} (${type})`);
    if (type === 'hash') {
      const data = await redis.hgetall(key);
      // parse job data if present
      if (data.data) {
        try {
          const parsed = JSON.parse(data.data);
          console.log('  Recipient:', parsed.recipient?.email);
          console.log('  Sender:', parsed.sendingDomain?.senderEmail);
          console.log('  userId:', parsed.userId);
          console.log('  relayUsed in data:', parsed.relayUsed);
        } catch (e) {
          console.log('  Data parse error:', e.message);
        }
      }
      console.log('  opts:', data.opts);
      console.log('  attemptsMade:', data.attemptsMade);
      console.log('  failedReason:', data.failedReason);
      console.log('  processedOn:', data.processedOn ? new Date(parseInt(data.processedOn)).toLocaleString() : null);
      console.log('  finishedOn:', data.finishedOn ? new Date(parseInt(data.finishedOn)).toLocaleString() : null);
    }
  }

  await redis.quit();
}

run().catch(console.error);
