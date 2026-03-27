/**
 * Token bucket rate limiter. Queues requests when exhausted — never throws.
 * Companies House allows 600 requests per 5 minutes.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefillTime: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxTokens = 600, windowMs = 5 * 60 * 1000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillIntervalMs = windowMs / maxTokens;
    this.lastRefillTime = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    // Queue and wait
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
      setTimeout(() => this.processQueue(), this.refillIntervalMs);
    });
  }

  private processQueue(): void {
    this.refill();
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      const next = this.queue.shift();
      next?.();
    }
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.refillIntervalMs);
    }
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }

  get queueLength(): number {
    return this.queue.length;
  }
}
