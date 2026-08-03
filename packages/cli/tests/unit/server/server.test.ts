import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
  type VersionNegotiationOptions,
} from '@modelcontextprotocol/client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import {
  assertNoDeprecatedOAuthConfiguration,
  isLoopbackHost,
  parseServerArguments,
  runServer,
  safeStringEqual,
  type RunningServer,
} from '../../../src/server/index.js';
import { createCompaniesHouseMcpFactory } from '../../../src/server/mcp.js';

const API_KEY = 'test-api-key';
const VERSION = '9.8.7-test';

function clearServerEnvironment(): void {
  vi.stubEnv('MCP_BEARER_TOKEN', '');
  vi.stubEnv('MCP_OAUTH_CLIENT_ID', '');
  vi.stubEnv('MCP_OAUTH_CLIENT_SECRET', '');
  vi.stubEnv('MCP_PUBLIC_URL', '');
}

async function startHttp(
  host = '127.0.0.1',
  extraArgs: readonly string[] = []
): Promise<RunningServer> {
  return runServer({
    version: VERSION,
    apiKey: API_KEY,
    argv: ['--http', '--host', host, '--port', '0', ...extraArgs],
  });
}

function serverUrl(server: RunningServer, pathname: string): string {
  return `http://127.0.0.1:${server.port}${pathname}`;
}

function clientOptions(modern: boolean): { versionNegotiation: VersionNegotiationOptions } {
  return {
    versionNegotiation: {
      mode: modern ? { pin: '2026-07-28' } : 'legacy',
    },
  };
}

function mockCompanyProfileRequest(): void {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith('https://api.company-information.service.gov.uk/')) {
      return realFetch(input, init);
    }

    return Promise.resolve(
      new Response(
        JSON.stringify({
          company_name: 'Test Company Limited',
          company_number: '00445790',
          company_status: 'active',
          type: 'ltd',
          registered_office_address: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  });
}

async function verifyMcpSurface(client: Client): Promise<void> {
  expect(client.getServerVersion()).toEqual({ name: 'companies-house', version: VERSION });

  const listed = await client.listTools();
  expect(listed.tools).toHaveLength(18);
  expect(listed.tools.every(tool => Boolean(tool.title))).toBe(true);

  const result = await client.callTool({
    name: 'get_company_profile',
    arguments: { company_number: '00445790' },
  });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toMatchObject({
    company_name: 'Test Company Limited',
    company_number: '00445790',
  });

  const invalid = await client.callTool({
    name: 'get_company_profile',
    arguments: {},
  });
  expect(invalid.isError).toBe(true);

  await expect(
    client.callTool({ name: 'tool_that_does_not_exist', arguments: {} })
  ).rejects.toThrow();
}

describe('server argument parsing', () => {
  it('defaults to stdio with loopback HTTP defaults', () => {
    expect(parseServerArguments([])).toEqual({
      mode: 'stdio',
      host: '127.0.0.1',
      port: 3000,
    });
  });

  it('parses HTTP host and port', () => {
    expect(parseServerArguments(['--http', '--host', 'localhost', '--port', '8080'])).toEqual({
      mode: 'http',
      host: 'localhost',
      port: 8080,
    });
  });

  it.each([
    [['--wat'], 'Unknown server option'],
    [['--http', '--port'], '--port requires a value'],
    [['--http', '--port', '-1'], '--port must be an integer'],
    [['--http', '--port', '65536'], '--port must be an integer'],
    [['--http', '--host', 'https://example.com'], 'Invalid host'],
    [['--host', 'localhost'], '--host and --port require --http'],
    [['--http', '--http'], 'provided more than once'],
  ])('rejects invalid arguments %#', (args, message) => {
    expect(() => parseServerArguments(args)).toThrow(message);
  });
});

describe('server authentication helpers', () => {
  it('recognises only explicit loopback hosts', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLoopbackHost('example.com')).toBe(false);
  });

  it('compares bearer tokens safely', () => {
    expect(safeStringEqual('same-secret', 'same-secret')).toBe(true);
    expect(safeStringEqual('same-secret', 'other-value')).toBe(false);
    expect(safeStringEqual('short', 'a-much-longer-secret')).toBe(false);
  });

  it.each(['MCP_OAUTH_CLIENT_ID', 'MCP_OAUTH_CLIENT_SECRET', 'MCP_PUBLIC_URL'])(
    'refuses deprecated %s configuration',
    variable => {
      expect(() => assertNoDeprecatedOAuthConfiguration({ [variable]: 'configured' })).toThrow(
        'custom OAuth configuration has been removed'
      );
    }
  );

  it('ignores absent and blank deprecated configuration', () => {
    expect(() =>
      assertNoDeprecatedOAuthConfiguration({ MCP_OAUTH_CLIENT_ID: '   ' })
    ).not.toThrow();
  });
});

describe.sequential('HTTP server boundary', () => {
  let runningServer: RunningServer | undefined;

  afterEach(async () => {
    await runningServer?.close();
    runningServer = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('serves the unauthenticated health check only on loopback', async () => {
    clearServerEnvironment();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runningServer = await startHttp();

    const response = await fetch(serverUrl(runningServer, '/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      tools: 18,
      protocols: ['legacy', '2026-07-28'],
    });
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('does not expose the removed OAuth endpoints or wildcard CORS', async () => {
    clearServerEnvironment();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runningServer = await startHttp();

    const discovery = await fetch(
      serverUrl(runningServer, '/.well-known/oauth-authorization-server')
    );
    expect(discovery.status).toBe(404);
    expect(discovery.headers.has('access-control-allow-origin')).toBe(false);

    const preflight = await fetch(serverUrl(runningServer, '/mcp'), { method: 'OPTIONS' });
    expect(preflight.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('rejects untrusted Host and Origin headers on loopback HTTP', async () => {
    clearServerEnvironment();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runningServer = await startHttp();

    const hostileHost = await fetch(serverUrl(runningServer, '/mcp'), {
      method: 'POST',
      headers: { Host: 'evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect([400, 403]).toContain(hostileHost.status);

    const hostileOrigin = await fetch(serverUrl(runningServer, '/mcp'), {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect([400, 403]).toContain(hostileOrigin.status);
  });

  it('refuses a token-free non-loopback bind', async () => {
    clearServerEnvironment();

    await expect(startHttp('0.0.0.0')).rejects.toThrow(
      'Refusing to bind an unauthenticated MCP server'
    );
  });

  it('requires and validates bearer authentication on a controlled bind', async () => {
    clearServerEnvironment();
    vi.stubEnv('MCP_BEARER_TOKEN', 'correct-secret');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runningServer = await startHttp('0.0.0.0');

    const missing = await fetch(serverUrl(runningServer, '/mcp'), { method: 'POST' });
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toBe('Bearer');
    expect(await missing.json()).toEqual({ error: 'unauthorized' });

    const wrong = await fetch(serverUrl(runningServer, '/mcp'), {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    expect(wrong.status).toBe(401);

    const authorised = await fetch(serverUrl(runningServer, '/mcp'), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer correct-secret',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    expect(authorised.status).not.toBe(401);

    const health = await fetch(serverUrl(runningServer, '/health'));
    expect(health.status).toBe(200);
  });

  it('refuses startup when deprecated OAuth configuration is present', async () => {
    clearServerEnvironment();
    vi.stubEnv('MCP_OAUTH_CLIENT_ID', 'old-client');

    await expect(startHttp()).rejects.toThrow('custom OAuth configuration has been removed');
  });

  it.each([
    ['legacy', false],
    ['2026-07-28', true],
  ] as const)('serves the %s protocol over HTTP', async (_era, modern) => {
    clearServerEnvironment();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCompanyProfileRequest();
    runningServer = await startHttp();

    const client = new Client(
      { name: 'companies-house-test', version: '1.0.0' },
      clientOptions(modern)
    );
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl(runningServer, '/mcp')));

    try {
      await client.connect(transport);
      await verifyMcpSurface(client);
    } finally {
      await client.close();
    }
  });
});

describe.sequential('stdio protocol compatibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['legacy', false],
    ['2026-07-28', true],
  ] as const)('serves the %s protocol from the same factory', async (_era, modern) => {
    mockCompanyProfileRequest();
    const factory = createCompaniesHouseMcpFactory({ apiKey: API_KEY, version: VERSION });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverHandle = serveStdio(factory, { transport: serverTransport });
    const client = new Client(
      { name: 'companies-house-test', version: '1.0.0' },
      clientOptions(modern)
    );

    try {
      await client.connect(clientTransport);
      await verifyMcpSurface(client);
    } finally {
      await client.close();
      await serverHandle.close();
    }
  });
});
