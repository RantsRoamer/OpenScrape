/**
 * Rate limiting and concurrency control
 */

import PQueue from 'p-queue';
import { RateLimitConfig } from './types';

export class RateLimiter {
  private queue: PQueue;
  private lastRequestTime: number = 0;
  private minDelay: number;

  constructor(config: RateLimitConfig = {}) {
    const maxRequestsPerSecond = config.maxRequestsPerSecond ?? 5;
    const maxConcurrency = config.maxConcurrency ?? 3;
    this.minDelay = 1000 / maxRequestsPerSecond;

    this.queue = new PQueue({
      concurrency: maxConcurrency,
      interval: 1000,
      intervalCap: maxRequestsPerSecond,
    });
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minDelay) {
        await this.sleep(this.minDelay - timeSinceLastRequest);
      }
      
      this.lastRequestTime = Date.now();
      return await fn();
    }) as Promise<T>;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle exponential backoff on 429 responses
   */
  async handleBackoff(
    attempt: number,
    maxBackoff: number = 60000,
    baseDelay: number = 1000
  ): Promise<void> {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxBackoff);
    await this.sleep(delay);
  }
}
