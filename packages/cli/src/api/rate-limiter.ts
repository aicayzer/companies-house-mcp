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

  /**
   * Align the local window to the server's, using the reset time Companies
   * House reports.
   *
   * Without this the local window starts whenever the process did, so its
   * boundary sits somewhere inside the server's — and a burst straddling the
   * local boundary spends two local allowances inside one server window,
   * which is the very thing a fixed window is meant to prevent.
   *
   * @param resetAtSeconds unix epoch seconds from `X-Ratelimit-Reset`
   * @param remaining      requests the server says are left in this window
   */
  observeServerWindow(resetAtSeconds: number | undefined, remaining: number | undefined): void {
    if (resetAtSeconds === undefined || !Number.isFinite(resetAtSeconds)) return;

    const serverWindowStart = resetAtSeconds * 1000 - this.windowMs;
    const now = Date.now();
    // Ignore a reset far outside the window we could plausibly be in; a stale
    // or malformed header must not be able to stall every later request.
    if (Math.abs(serverWindowStart - now) > this.windowMs * 2) return;

    if (serverWindowStart !== this.windowStart) {
      this.windowStart = serverWindowStart;
      this.used = 0;
    }
    // The server's own count is more authoritative than ours: it sees every
    // client using this key, not just this process.
    if (remaining !== undefined && Number.isFinite(remaining)) {
      this.used = Math.max(this.used, this.maxRequests - Math.max(0, remaining));
    }
  }

  /** Milliseconds until the current window resets. */
  private msUntilReset(now: number): number {
    return Math.max(0, this.windowStart + this.windowMs - now);
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.rollWindow(now);

    // Never overtake a caller already waiting, even when the window has just
    // rolled and there is room.
    if (this.waiting.length === 0 && this.used < this.maxRequests) {
      this.used++;
      return;
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
      // Drain now when the window already has room, otherwise at the reset.
      const now = Date.now();
      this.rollWindow(now);
      this.scheduleDrain(this.used < this.maxRequests ? 0 : this.msUntilReset(now));
    });
  }

  private scheduleDrain(delayMs: number): void {
    if (this.timer !== undefined) return;
    // Deliberately not unref'd. A caller is awaiting this timer; letting the
    // process exit before it fires would end a CLI run silently with exit 0
    // and no output, which is worse than waiting.
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.drain();
      },
      Math.max(delayMs, 1)
    );
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
