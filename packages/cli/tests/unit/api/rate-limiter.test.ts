import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter } from '../../../src/api/rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimiter', () => {
  it('allows requests inside the window', async () => {
    const limiter = new RateLimiter(10, 60_000);
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(9);
  });

  it('tracks how much of the window has been used', async () => {
    const limiter = new RateLimiter(5, 60_000);
    expect(limiter.availableTokens).toBe(5);
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(2);
  });

  /**
   * The property that matters: Companies House meters a fixed window, so the
   * limiter must never let more than the allowance through inside one. A
   * continuously refilling bucket would permit close to double and reliably
   * earn a 429.
   */
  it('never permits more than the allowance within a single window', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(10, 10_000);

    let granted = 0;
    const pending: Array<Promise<void>> = [];
    for (let index = 0; index < 25; index++) {
      pending.push(
        limiter.acquire().then(() => {
          granted++;
        })
      );
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(granted).toBe(10);

    // Halfway through the window nothing more may be granted.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(granted).toBe(10);

    // The window rolls; the next allowance is released.
    await vi.advanceTimersByTimeAsync(5_100);
    expect(granted).toBe(20);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(granted).toBe(25);
    await Promise.all(pending);
  });

  it('queues rather than throwing when the window is spent', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 10_000);

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    let resolved = false;
    const queued = limiter.acquire().then(() => {
      resolved = true;
    });
    expect(limiter.queueLength).toBe(1);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(10_100);
    await queued;
    expect(resolved).toBe(true);
    expect(limiter.queueLength).toBe(0);
  });

  it('resets the allowance after an idle period rather than accumulating it', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(5, 10_000);

    for (let index = 0; index < 5; index++) await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    // Idle for several windows: the allowance resets to the cap, it does not
    // build up.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(limiter.availableTokens).toBe(5);
  });
});
