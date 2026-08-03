import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import worker, { type Env } from '../src/index.js';
import { WORKER_VERSION } from '../src/version.js';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const TOKEN = 'a-long-random-bearer-token-for-tests';
const env: Env = {
  COMPANIES_HOUSE_API_KEY: 'test-companies-house-key',
  MCP_BEARER_TOKEN: TOKEN,
};

function request(path: string, init: RequestInit & { token?: string } = {}): Request {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request(`https://companies-house-mcp.example.workers.dev${path}`, {
    ...rest,
    headers,
  });
}

/** A minimal, valid initialize call for the legacy protocol era. */
function initializeBody(): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    },
  });
}

describe('worker version', () => {
  it('matches the package manifest, since a Worker cannot read it at runtime', () => {
    expect(WORKER_VERSION).toBe(manifest.version);
  });
});

describe('routing', () => {
  it('answers /health without a token', async () => {
    const response = await worker.fetch(request('/health'), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'companies-house-mcp',
    });
  });

  it('rejects a non-GET health check', async () => {
    const response = await worker.fetch(request('/health', { method: 'POST' }), env);
    expect(response.status).toBe(405);
  });

  it('returns 404 for any other path, and points at the right one', async () => {
    const response = await worker.fetch(request('/'), env);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'not_found' });
  });

  it('never reveals whether the secrets are set from /health', async () => {
    const response = await worker.fetch(request('/health'), {});
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain('MCP_BEARER_TOKEN');
    expect(body).not.toContain('COMPANIES_HOUSE_API_KEY');
  });
});

describe('authentication', () => {
  it('refuses a request with no Authorization header', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody() }),
      env
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  it('refuses a wrong token', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody(), token: 'wrong-token' }),
      env
    );
    expect(response.status).toBe(401);
  });

  it('refuses a token that is a prefix of the real one', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody(), token: TOKEN.slice(0, -1) }),
      env
    );
    expect(response.status).toBe(401);
  });

  it('answers 401 rather than a 200 carrying a tool error', async () => {
    // Clients key their credential prompt off the transport status. A 200 with
    // an in-band error would read as an ordinary tool failure.
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody() }),
      env
    );
    expect(response.status).not.toBe(200);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_token' });
  });

  it('never echoes the expected token in a refusal', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody(), token: 'wrong' }),
      env
    );
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('reports a missing secret as a server error, naming it without its value', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody(), token: TOKEN }),
      { COMPANIES_HOUSE_API_KEY: 'key' }
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'server_misconfigured' });
    expect(JSON.stringify(body)).toContain('MCP_BEARER_TOKEN');
    expect(JSON.stringify(body)).not.toContain('key');
  });

  it('refuses before treating a blank token as valid', async () => {
    const response = await worker.fetch(
      request('/mcp', { method: 'POST', body: initializeBody(), token: TOKEN }),
      { COMPANIES_HOUSE_API_KEY: 'key', MCP_BEARER_TOKEN: '   ' }
    );
    expect(response.status).toBe(500);
  });
});

describe('serving MCP', () => {
  let originalFetch: typeof globalThis.fetch;

  /** Route the official client's requests into the Worker handler. */
  function workerFetch(workerEnv: Env = env) {
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      worker.fetch(new Request(input as RequestInfo, init), workerEnv)) as typeof fetch;
  }

  async function connect(token: string, workerEnv: Env = env): Promise<Client> {
    const client = new Client({ name: 'worker-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('https://worker.test/mcp'), {
        fetch: workerFetch(workerEnv),
        authProvider: { token: async () => token },
      })
    );
    return client;
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Nothing here should reach Companies House: tools/list is answered
    // entirely from the registry.
    globalThis.fetch = vi.fn(async () => {
      throw new Error('no upstream request expected');
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('serves an authenticated client through the official SDK transport', async () => {
    const client = await connect(TOKEN);
    try {
      expect(client.getServerVersion()).toEqual({
        name: 'companies-house',
        version: WORKER_VERSION,
      });

      const names = (await client.listTools()).tools.map(tool => tool.name);
      expect(names).toContain('search_companies');
      expect(names).toContain('due_diligence_check');
      expect(names).toHaveLength(18);
    } finally {
      await client.close();
    }
  });

  it('advertises complete input schemas to the client', async () => {
    const client = await connect(TOKEN);
    try {
      for (const tool of (await client.listTools()).tools) {
        expect(tool.description, `${tool.name} has no description`).toBeTruthy();
        expect(tool.inputSchema, `${tool.name} has no input schema`).toBeTruthy();
      }
    } finally {
      await client.close();
    }
  });

  it('refuses a client presenting the wrong token', async () => {
    await expect(connect('not-the-token')).rejects.toThrow();
  });
});
