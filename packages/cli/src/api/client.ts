import type { ClientConfig } from '../types/index.js';
import { utf8ToBase64 } from './base64.js';
import { RateLimiter } from './rate-limiter.js';
import { Cache } from './cache.js';

const DEFAULT_BASE_URL = 'https://api.company-information.service.gov.uk';

export class CompaniesHouseAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    /** Seconds to wait before retrying, when the API told us. */
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'CompaniesHouseAPIError';
  }

  static fromResponse(
    status: number,
    endpoint: string,
    body?: string,
    retryAfterSeconds?: number
  ): CompaniesHouseAPIError {
    const messages: Record<number, string> = {
      400: 'Bad request — check your parameters.',
      401: 'Invalid API key. Check your COMPANIES_HOUSE_API_KEY.',
      403: 'Access forbidden. Your API key may not have access to this endpoint.',
      404: 'Not found. Check the company number or officer ID.',
      429: 'Companies House rate limit reached.',
      500: 'Companies House API internal error. Try again later.',
      502: 'Companies House API is temporarily unavailable.',
      503: 'Companies House API is temporarily unavailable.',
    };
    let msg = messages[status] ?? `API returned status ${status}`;
    if (status === 429) {
      msg +=
        retryAfterSeconds !== undefined
          ? ` Retry in about ${retryAfterSeconds} second(s).`
          : ' Try again shortly.';
    }
    // Companies House error bodies are small JSON documents. Truncate defensively
    // so a large or unexpected body can never dominate a tool response.
    const detail = body ? ` Response: ${body.slice(0, 200)}` : '';
    return new CompaniesHouseAPIError(`${msg}${detail}`, status, endpoint, retryAfterSeconds);
  }
}

export class CompaniesHouseNetworkError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CompaniesHouseNetworkError';
  }

  static fromError(error: unknown, endpoint: string): CompaniesHouseNetworkError {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
    return new CompaniesHouseNetworkError(
      `Unable to reach Companies House.${detail}`,
      endpoint,
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

/** TTL values per endpoint category (milliseconds) */
export const CACHE_TTLS = {
  profile: 30 * 60 * 1000, // 30 min
  search: 5 * 60 * 1000, // 5 min
  officers: 15 * 60 * 1000, // 15 min
  filings: 5 * 60 * 1000, // 5 min
  charges: 30 * 60 * 1000, // 30 min
  psc: 15 * 60 * 1000, // 15 min
  insolvency: 30 * 60 * 1000, // 30 min
  registers: 30 * 60 * 1000, // 30 min
} as const;

/**
 * What the API last told us about our remaining quota.
 *
 * Companies House documents the 600-per-5-minutes limit but not the headers.
 * The main API returns `X-Ratelimit-Remain` and the document API returns
 * `X-Ratelimit-Remaining`; Companies House has acknowledged the inconsistency,
 * so both spellings are read.
 */
export interface RateLimitSnapshot {
  limit?: number;
  remaining?: number;
  /** Unix epoch seconds at which the window resets. */
  resetAt?: number;
  observedAt: number;
}

/** Never block a single tool call on a rate-limit reset for longer than this. */
export const MAX_RATE_LIMIT_WAIT_SECONDS = 30;

function parseIntHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Read the quota headers Companies House returns, tolerating both spellings. */
export function readRateLimitHeaders(headers: Headers, now = Date.now()): RateLimitSnapshot {
  return {
    limit: parseIntHeader(headers.get('x-ratelimit-limit')),
    remaining:
      parseIntHeader(headers.get('x-ratelimit-remaining')) ??
      parseIntHeader(headers.get('x-ratelimit-remain')),
    resetAt: parseIntHeader(headers.get('x-ratelimit-reset')),
    observedAt: now,
  };
}

/**
 * Seconds to wait after a 429, preferring what the API told us.
 *
 * `Retry-After` is not documented for this API, so `X-Ratelimit-Reset` (unix
 * seconds) is the primary signal. The result is clamped so a stale or absurd
 * reset value cannot stall a tool call indefinitely.
 */
export function retryDelaySeconds(
  headers: Headers,
  now = Date.now(),
  maxSeconds = MAX_RATE_LIMIT_WAIT_SECONDS
): number | undefined {
  const retryAfter = parseIntHeader(headers.get('retry-after'));
  if (retryAfter !== undefined && retryAfter >= 0) return Math.min(retryAfter, maxSeconds);

  const resetAt = parseIntHeader(headers.get('x-ratelimit-reset'));
  if (resetAt === undefined) return undefined;

  const seconds = Math.ceil(resetAt - now / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, maxSeconds);
}

export class APIClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: Cache;
  private readonly cacheEnabled: boolean;
  private rateLimit: RateLimitSnapshot | undefined;

  constructor(config: ClientConfig) {
    this.baseUrl = config.base_url ?? DEFAULT_BASE_URL;
    // Companies House uses HTTP Basic with the API key as the username and an
    // empty password.
    this.authHeader = 'Basic ' + utf8ToBase64(config.api_key + ':');
    this.rateLimiter = new RateLimiter(
      config.rate_limit_max ?? 600,
      config.rate_limit_window_ms ?? 5 * 60 * 1000
    );
    this.cache = new Cache(1000);
    this.cacheEnabled = config.cache_enabled !== false;
  }

  /** The most recent quota reading, for diagnostics. Never includes credentials. */
  get lastRateLimit(): RateLimitSnapshot | undefined {
    return this.rateLimit;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    cacheTtl?: number
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const cacheKey = url.toString();

    // Check cache
    if (this.cacheEnabled && cacheTtl) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    // Fetch with retry
    const result = await this.fetchWithRetry<T>(url, path);

    // Cache result
    if (this.cacheEnabled && cacheTtl) {
      this.cache.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  /**
   * Fetch a Companies House endpoint with this client's credential.
   * Callers must only pass trusted Companies House URLs because the API key
   * is added to the request.
   */
  async fetchWithAuth(
    input: string | URL,
    init: RequestInit = {},
    endpoint = input.toString()
  ): Promise<Response> {
    await this.rateLimiter.acquire();
    const headers = new Headers(init.headers);
    headers.set('Authorization', this.authHeader);

    let response: Response;
    try {
      response = await fetch(input, { ...init, headers });
    } catch (error) {
      throw CompaniesHouseNetworkError.fromError(error, endpoint);
    }

    this.rateLimit = readRateLimitHeaders(response.headers);
    return response;
  }

  private async fetchWithRetry<T>(url: URL, path: string, attempts = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await this.fetchWithAuth(
          url,
          {
            headers: {
              Accept: 'application/json',
            },
          },
          path
        );

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const retryAfter =
            response.status === 429 ? retryDelaySeconds(response.headers) : undefined;
          const error = CompaniesHouseAPIError.fromResponse(
            response.status,
            path,
            body,
            retryAfter
          );

          // Wait out a rate limit once, when the API told us the window is
          // about to reset. Anything longer is reported rather than hidden
          // behind a stalled tool call.
          if (
            response.status === 429 &&
            retryAfter !== undefined &&
            retryAfter <= MAX_RATE_LIMIT_WAIT_SECONDS &&
            i < attempts - 1
          ) {
            lastError = error;
            await this.sleep(retryAfter * 1000 + 250);
            continue;
          }

          // Otherwise only transient server-side failures are worth retrying.
          if (response.status >= 500 && i < attempts - 1) {
            lastError = error;
            await this.sleep(Math.pow(2, i) * 500);
            continue;
          }
          throw error;
        }

        return (await response.json()) as T;
      } catch (err) {
        if (err instanceof CompaniesHouseAPIError) throw err;
        lastError =
          err instanceof CompaniesHouseNetworkError
            ? err
            : CompaniesHouseNetworkError.fromError(err, path);
        if (i < attempts - 1) {
          await this.sleep(Math.pow(2, i) * 500);
        }
      }
    }
    throw lastError ?? new Error(`Failed to fetch ${path} after ${attempts} attempts`);
  }

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): URL {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }
}
