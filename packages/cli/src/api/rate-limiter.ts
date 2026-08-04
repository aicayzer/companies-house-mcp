/**
 * Fixed-window rate limiter matching how Companies House actually meters.
 *
 * The API allows 600 requests per five-minute window and reports the window's
 * reset time in `X-Ratelimit-Reset`. A token bucket refilling continuously
 * across that window would permit up to twice the real allowance inside one
 * window — the full bucket at the start plus everything refilled during it —
 * and reliably earn a 429. So this counts requests within a window and holds
 * callers until the window rolls over.
 *
 * It queues rather than throwing: a tool call that has to wait is better than
 * one that fails.
 */
export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private windowStart: number;
  private used = 0;
  private readonly waiting: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(maxRequests = 600, windowMs = 5 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.windowStart = Date.now();
  }

  private rollWindow(now: number): void {
    if (now - this.windowStart >= this.windowMs) {
      // Advance by whole windows so a long idle period does not leave the
      // window boundary in the distant past.
      const elapsedWindows = Math.floor((now - this.windowStart) / this.windowMs);
      this.windowStart += elapsedWindows * this.windowMs;
      this.used = 0;
    }
  }

  /** Milliseconds until the current window resets. */
  private msUntilReset(now: number): number {
    return Math.max(0, this.windowStart + this.windowMs - now);
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.rollWindow(now);

    if (this.used < this.maxRequests) {
      this.used++;
      return;
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
      this.scheduleDrain(this.msUntilReset(Date.now()));
    });
  }

  private scheduleDrain(delayMs: number): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.drain();
      },
      Math.max(delayMs, 1)
    );
    // Never hold a Node process open just to service the queue. Workers has no
    // unref, hence the guard rather than a direct call.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private drain(): void {
    const now = Date.now();
    this.rollWindow(now);

    while (this.used < this.maxRequests && this.waiting.length > 0) {
      this.used++;
      this.waiting.shift()?.();
    }

    if (this.waiting.length > 0) {
      this.scheduleDrain(this.msUntilReset(Date.now()));
    }
  }

  /** Requests still permitted in the current window. */
  get availableTokens(): number {
    this.rollWindow(Date.now());
    return Math.max(0, this.maxRequests - this.used);
  }

  get queueLength(): number {
    return this.waiting.length;
  }
}
