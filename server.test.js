const test = require('node:test');
const assert = require('node:assert/strict');

const { createDatabaseLimiter } = require('./server');

test('database limiter queues work instead of dropping requests when the pool is saturated', async () => {
  const limiter = createDatabaseLimiter({ poolSize: 2 });
  let inFlight = 0;
  let maxInFlight = 0;

  const tasks = Array.from({ length: 4 }, async (_, index) => {
    await limiter.acquire();
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise(resolve => setTimeout(resolve, 10));
      return index;
    } finally {
      inFlight -= 1;
      limiter.release();
    }
  });

  const results = await Promise.all(tasks);
  assert.deepEqual(results, [0, 1, 2, 3]);
  assert.equal(maxInFlight, 2, 'the limiter should never exceed the configured pool size');
});
