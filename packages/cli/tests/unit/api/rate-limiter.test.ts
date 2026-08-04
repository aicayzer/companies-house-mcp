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

  /**
   * A window that starts whenever the process did has its boundary somewhere
   * inside the server's, so a burst straddling it spends two local allowances
   * inside one server window — the very thing a fixed window prevents.
   */
  it('aligns its window to the reset time the server reports', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    const limiter = new RateLimiter(10, 10_000);

    for (let index = 0; index < 10; index++) await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    // The server says its window ends 8 seconds from now, not where the local
    // one thinks. Realigning must not hand out a fresh allowance early.
    const serverReset = Math.floor(Date.now() / 1000) + 8;
    limiter.observeServerWindow(serverReset, 0);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(limiter.availableTokens).toBe(0);

    await vi.advanceTimersByTimeAsync(5_100);
    expect(limiter.availableTokens).toBe(10);
  });

  it('defers to the server count when it is lower than its own', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    const limiter = new RateLimiter(10, 10_000);

    await limiter.acquire();
    // Another client on the same key has spent most of the window.
    limiter.observeServerWindow(Math.floor(Date.now() / 1000) + 10, 2);
    expect(limiter.availableTokens).toBe(2);
  });

  it('ignores a reset time that could not belong to the current window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    const limiter = new RateLimiter(10, 10_000);

    await limiter.acquire();
    limiter.observeServerWindow(Math.floor(Date.now() / 1000) + 999_999, 0);
    expect(limiter.availableTokens).toBe(9);
  });

  it('serves waiting callers before new arrivals', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 10_000);
    await limiter.acquire();

    const order: string[] = [];
    const first = limiter.acquire().then(() => order.push('queued'));
    const second = limiter.acquire().then(() => order.push('arrived-later'));

    // One request per window, so each waiter needs its own window.
    await vi.advanceTimersByTimeAsync(10_100);
    expect(order).toEqual(['queued']);

    await vi.advanceTimersByTimeAsync(10_100);
    await Promise.all([first, second]);
    expect(order).toEqual(['queued', 'arrived-later']);
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
