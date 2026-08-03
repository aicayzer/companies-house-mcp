import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APIClient,
  CompaniesHouseAPIError,
  CompaniesHouseNetworkError,
} from '../../../src/api/client.js';

describe('APIClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct auth header', async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ test: true }), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'test-key', cache_enabled: false });
    await client.get('/test');

    expect(capturedHeaders?.get('Authorization')).toBe(
      'Basic ' + Buffer.from('test-key:').toString('base64')
    );
  });

  it('wraps authenticated fetch failures as typed network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = new APIClient({ api_key: 'test-key', cache_enabled: false });

    await expect(
      client.fetchWithAuth('https://api.company-information.service.gov.uk/test', {}, '/test')
    ).rejects.toMatchObject({
      name: 'CompaniesHouseNetworkError',
      endpoint: '/test',
    } satisfies Partial<CompaniesHouseNetworkError>);
  });

  it('returns parsed JSON on success', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ company_name: 'TEST LTD' }), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: false });
    const result = await client.get<{ company_name: string }>('/company/12345678');
    expect(result.company_name).toBe('TEST LTD');
  });

  it('throws CompaniesHouseAPIError on 404', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: false });
    await expect(client.get('/company/99999999')).rejects.toThrow(CompaniesHouseAPIError);
  });

  it('throws CompaniesHouseAPIError on 401', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Unauthorized', { status: 401 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'bad-key', cache_enabled: false });
    await expect(client.get('/test')).rejects.toThrow('rejected the API key');
  });

  it('uses cache when enabled', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return new Response(JSON.stringify({ count: callCount }), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: true });
    const r1 = await client.get<{ count: number }>('/cached', undefined, 60000);
    const r2 = await client.get<{ count: number }>('/cached', undefined, 60000);

    expect(r1.count).toBe(1);
    expect(r2.count).toBe(1); // Should be cached
    expect(callCount).toBe(1);
  });

  it('retries on 500 errors', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        return new Response('Server error', { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: false });
    const result = await client.get<{ ok: boolean }>('/flaky');
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it('builds URL with query params', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: false });
    await client.get('/search/companies', { q: 'test', items_per_page: 10 });

    expect(capturedUrl).toContain('q=test');
    expect(capturedUrl).toContain('items_per_page=10');
  });

  it('skips undefined params', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    const client = new APIClient({ api_key: 'key', cache_enabled: false });
    await client.get('/search', { q: 'test', category: undefined });

    expect(capturedUrl).toContain('q=test');
    expect(capturedUrl).not.toContain('category');
  });
});

describe('CompaniesHouseAPIError', () => {
  it('creates from response status', () => {
    const error = CompaniesHouseAPIError.fromResponse(404, '/company/test');
    expect(error.statusCode).toBe(404);
    expect(error.endpoint).toBe('/company/test');
    expect(error.message).toContain('no such record');
  });

  it('keeps the upstream body only where it explains something', () => {
    // A 404 body is a timestamp and a request id; a 400 body says what was
    // wrong with the request.
    const notFound = CompaniesHouseAPIError.fromResponse(404, '/x', '{"timestamp":"...","message":"..."}');
    expect(notFound.message).not.toContain('timestamp');

    const badRequest = CompaniesHouseAPIError.fromResponse(400, '/x', '{"error":"invalid start_index"}');
    expect(badRequest.message).toContain('invalid start_index');
  });

  it('describes upstream rate limits without claiming the request is queued', () => {
    const error = CompaniesHouseAPIError.fromResponse(429, '/company/test');

    expect(error.message).toContain('rate limit reached');
    expect(error.message).not.toContain('queued');
  });

  it('reports the wait Companies House signalled', () => {
    const error = CompaniesHouseAPIError.fromResponse(429, '/company/test', undefined, 12);

    expect(error.retryAfterSeconds).toBe(12);
    expect(error.message).toContain('Retry in about 12 second(s)');
  });

  it('includes the response body for a malformed request', () => {
    const error = CompaniesHouseAPIError.fromResponse(400, '/test', '{"error":"bad"}');
    expect(error.message).toContain('bad');
  });

  it('never lets a large upstream body dominate the message', () => {
    const error = CompaniesHouseAPIError.fromResponse(500, '/test', 'x'.repeat(5000));
    expect(error.message.length).toBeLessThan(400);
  });
});
