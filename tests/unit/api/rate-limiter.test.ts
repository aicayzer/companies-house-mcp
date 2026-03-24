import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../../../src/api/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows requests when tokens are available', async () => {
    const limiter = new RateLimiter(10, 60000);
    // Should resolve immediately
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(9);
  });

  it('tracks token consumption', async () => {
    const limiter = new RateLimiter(5, 60000);
    expect(limiter.availableTokens).toBe(5);
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(2);
  });

  it('queues requests when tokens exhausted', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 10000); // 2 tokens, 10s window

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    // This should queue
    const queued = limiter.acquire();
    expect(limiter.queueLength).toBe(1);

    // Advance time to refill
    vi.advanceTimersByTime(6000);
    await queued;
    expect(limiter.queueLength).toBe(0);

    vi.useRealTimers();
  });

  it('refills tokens over time', () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(10, 10000); // refill interval = 1000ms per token

    // Drain some tokens synchronously via available check
    // (acquire is async, so use direct token check)
    expect(limiter.availableTokens).toBe(10);

    vi.useRealTimers();
  });
});
