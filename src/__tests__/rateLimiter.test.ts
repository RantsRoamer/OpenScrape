/**
 * Tests for RateLimiter
 */

import { RateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  test('should limit request rate', async () => {
    const limiter = new RateLimiter({ maxRequestsPerSecond: 2 });
    const startTime = Date.now();
    const calls: number[] = [];

    // Execute 4 calls (should take at least 2 seconds at 2 req/sec)
    await Promise.all([
      limiter.execute(async () => { calls.push(Date.now()); return 1; }),
      limiter.execute(async () => { calls.push(Date.now()); return 2; }),
      limiter.execute(async () => { calls.push(Date.now()); return 3; }),
      limiter.execute(async () => { calls.push(Date.now()); return 4; }),
    ]);

    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(1500); // At least 1.5 seconds
    expect(calls.length).toBe(4);
  });

  test('should respect concurrency limit', async () => {
    const limiter = new RateLimiter({ maxConcurrency: 2 });
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 5 }, (_, i) =>
      limiter.execute(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrent--;
        return i;
      })
    );

    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('should handle backoff', async () => {
    const limiter = new RateLimiter();
    const startTime = Date.now();

    await limiter.handleBackoff(0, 10000, 100);
    await limiter.handleBackoff(1, 10000, 100);
    await limiter.handleBackoff(2, 10000, 100);

    const duration = Date.now() - startTime;
    // Should have waited: 100ms + 200ms + 400ms = 700ms
    expect(duration).toBeGreaterThanOrEqual(600);
  });
});
