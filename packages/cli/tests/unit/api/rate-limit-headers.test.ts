import { describe, it, expect } from 'vitest';
import {
  readRateLimitHeaders,
  retryDelaySeconds,
  MAX_RATE_LIMIT_WAIT_SECONDS,
} from '../../../src/api/client.js';

const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);

describe('readRateLimitHeaders', () => {
  it('reads the main API spelling', () => {
    const headers = new Headers({
      'X-Ratelimit-Limit': '600',
      'X-Ratelimit-Remain': '598',
      'X-Ratelimit-Reset': '1785797272',
    });

    expect(readRateLimitHeaders(headers, NOW)).toEqual({
      limit: 600,
      remaining: 598,
      resetAt: 1785797272,
      observedAt: NOW,
    });
  });

  it('reads the document API spelling', () => {
    // Companies House returns "Remaining" on the document API and "Remain" on
    // the main API, and has acknowledged the inconsistency.
    const headers = new Headers({ 'X-Ratelimit-Remaining': '42' });
    expect(readRateLimitHeaders(headers, NOW).remaining).toBe(42);
  });

  it('leaves fields undefined when the API sends nothing', () => {
    const snapshot = readRateLimitHeaders(new Headers(), NOW);
    expect(snapshot.limit).toBeUndefined();
    expect(snapshot.remaining).toBeUndefined();
    expect(snapshot.resetAt).toBeUndefined();
  });
});

describe('retryDelaySeconds', () => {
  it('prefers Retry-After when present', () => {
    expect(retryDelaySeconds(new Headers({ 'Retry-After': '7' }), NOW)).toBe(7);
  });

  it('derives the wait from the reset timestamp', () => {
    const resetAt = Math.floor(NOW / 1000) + 20;
    expect(retryDelaySeconds(new Headers({ 'X-Ratelimit-Reset': String(resetAt) }), NOW)).toBe(20);
  });

  it('reports the true wait rather than a clamped one', () => {
    // Telling a caller "retry in about 30 seconds" when the window resets in
    // over a minute would simply be false. Clamping belongs to the decision
    // about how long to sleep, not to the number reported.
    const resetAt = Math.floor(NOW / 1000) + 100_000;
    const reported = retryDelaySeconds(new Headers({ 'X-Ratelimit-Reset': String(resetAt) }), NOW);

    expect(reported).toBe(100_000);
    expect(reported!).toBeGreaterThan(MAX_RATE_LIMIT_WAIT_SECONDS);
  });

  it('treats a past reset as no wait at all', () => {
    const resetAt = Math.floor(NOW / 1000) - 60;
    expect(retryDelaySeconds(new Headers({ 'X-Ratelimit-Reset': String(resetAt) }), NOW)).toBe(0);
  });

  it('returns undefined when the API gave no timing signal', () => {
    expect(retryDelaySeconds(new Headers(), NOW)).toBeUndefined();
  });
});
