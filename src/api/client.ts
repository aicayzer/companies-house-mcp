import type { ClientConfig } from '../types/index.js';
import { RateLimiter } from './rate-limiter.js';
import { Cache } from './cache.js';

const DEFAULT_BASE_URL = 'https://api.company-information.service.gov.uk';

export class CompaniesHouseAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'CompaniesHouseAPIError';
  }

  static fromResponse(status: number, endpoint: string, body?: string): CompaniesHouseAPIError {
    const messages: Record<number, string> = {
      400: 'Bad request — check your parameters.',
      401: 'Invalid API key. Check your COMPANIES_HOUSE_API_KEY.',
      403: 'Access forbidden. Your API key may not have access to this endpoint.',
      404: 'Not found. Check the company number or officer ID.',
      429: 'Rate limit exceeded. Request has been queued.',
      500: 'Companies House API internal error. Try again later.',
      502: 'Companies House API is temporarily unavailable.',
      503: 'Companies House API is temporarily unavailable.',
    };
    const msg = messages[status] ?? `API returned status ${status}`;
    const detail = body ? ` Response: ${body.slice(0, 200)}` : '';
    return new CompaniesHouseAPIError(`${msg}${detail}`, status, endpoint);
  }
}

/** TTL values per endpoint category (milliseconds) */
export const CACHE_TTLS = {
  profile: 30 * 60 * 1000,     // 30 min
  search: 5 * 60 * 1000,       // 5 min
  officers: 15 * 60 * 1000,    // 15 min
  filings: 5 * 60 * 1000,      // 5 min
  charges: 30 * 60 * 1000,     // 30 min
  psc: 15 * 60 * 1000,         // 15 min
  insolvency: 30 * 60 * 1000,  // 30 min
  registers: 30 * 60 * 1000,   // 30 min
} as const;

export class APIClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: Cache;
  private readonly cacheEnabled: boolean;

  constructor(config: ClientConfig) {
    this.baseUrl = config.base_url ?? DEFAULT_BASE_URL;
    this.authHeader = 'Basic ' + Buffer.from(config.api_key + ':').toString('base64');
    this.rateLimiter = new RateLimiter(
      config.rate_limit_max ?? 600,
      config.rate_limit_window_ms ?? 5 * 60 * 1000
    );
    this.cache = new Cache(1000);
    this.cacheEnabled = config.cache_enabled !== false;
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

    // Rate limit
    await this.rateLimiter.acquire();

    // Fetch with retry
    const result = await this.fetchWithRetry<T>(url, path);

    // Cache result
    if (this.cacheEnabled && cacheTtl) {
      this.cache.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  private async fetchWithRetry<T>(url: URL, path: string, attempts = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: this.authHeader,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const error = CompaniesHouseAPIError.fromResponse(response.status, path, body);
          // Only retry on 5xx or network errors
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
        lastError = err as Error;
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
