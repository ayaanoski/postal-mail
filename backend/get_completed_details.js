const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

async function run() {
  const redisUrl = `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;
  const redis = new Redis(redisUrl);

  const keys = await redis.keys('*6a2a9bf67c38e87dac677481*');
  console.log('Found keys count:', keys.length);

  for (const key of keys) {
    const type = await redis.type(key);
    if (type === 'hash') {
      const data = await redis.hgetall(key);
      if (!data.failedReason) {
        // completed job
        try {
          const parsed = JSON.parse(data.data);
          console.log({
            id: key.split(':').pop(),
            recipient: parsed.recipient?.email,
            sender: parsed.sendingDomain?.senderEmail,
            relayUsed: parsed.relayUsed,
            attemptsMade: data.attemptsMade,
            processedOn: data.processedOn ? new Date(parseInt(data.processedOn)).toLocaleString() : null,
            finishedOn: data.finishedOn ? new Date(parseInt(data.finishedOn)).toLocaleString() : null
          });
        } catch (e) {
          console.log('Parse error for key:', key);
        }
      }
    }
  }

  await redis.quit();
}

run().catch(console.error);
