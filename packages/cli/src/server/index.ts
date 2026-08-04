import { createServer, type Server as HttpServer } from 'node:http';
import { isIP } from 'node:net';
import type { AddressInfo } from 'node:net';
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { resolveApiKey } from '../config.js';
import { getAllTools } from '../tools/registry.js';
import { createCompaniesHouseMcpFactory } from './mcp.js';
import { isAuthorised } from './secret.js';

export { createCompaniesHouseMcpFactory } from './mcp.js';
export type { CompaniesHouseMcpFactoryOptions } from './mcp.js';
export { secretsMatch, readBearerToken, isAuthorised } from './secret.js';

export const MCP_PROTOCOLS = ['legacy', '2026-07-28'] as const;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const toolCount = getAllTools().length;
const DEPRECATED_OAUTH_ENV_VARS = [
  'MCP_OAUTH_CLIENT_ID',
  'MCP_OAUTH_CLIENT_SECRET',
  'MCP_PUBLIC_URL',
] as const;

export interface RunServerOptions {
  version: string;
  argv?: readonly string[];
  apiKey?: string;
}

export interface RunningServer {
  readonly mode: 'stdio' | 'http';
  readonly host?: string;
  readonly port?: number;
  close(): Promise<void>;
}

export interface ServerArguments {
  mode: 'stdio' | 'http';
  host: string;
  port: number;
}

export function isLoopbackHost(host: string): boolean {
  const normalised = host.toLowerCase();
  return (
    normalised === 'localhost' ||
    normalised === '127.0.0.1' ||
    normalised === '::1' ||
    normalised === '[::1]' ||
    normalised === '0:0:0:0:0:0:0:1'
  );
}

function isValidHostname(host: string): boolean {
  if (isIP(host) !== 0) return true;
  if (host.length > 253 || host.endsWith('.')) return false;

  const labels = host.split('.');
  return labels.every(
    label =>
      label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export const SERVE_USAGE = [
  'ch serve — run the Companies House MCP server',
  '',
  'Usage: ch serve [--http [--host <host>] [--port <port>]]',
  '',
  'Transports:',
  '  (default)  stdio — what MCP clients launch directly',
  '  --http     Streamable HTTP on http://127.0.0.1:3000/mcp',
  '',
  'Flags:',
  '  --host <host>  Bind address for --http (default 127.0.0.1)',
  '  --port <port>  Port for --http (default 3000)',
  '',
  'Any bind other than loopback requires MCP_BEARER_TOKEN; the server refuses',
  'to start without one.',
  '',
  'Environment:',
  '  COMPANIES_HOUSE_API_KEY  Required. Your own key.',
  '  MCP_BEARER_TOKEN         Required for a non-loopback --http bind.',
  '',
  'Examples:',
  '  ch serve',
  '  ch serve --http',
  '  MCP_BEARER_TOKEN=$(openssl rand -hex 32) ch serve --http --host 0.0.0.0 --port 8080',
].join('\n');

export function parseServerArguments(args: readonly string[]): ServerArguments {
  let mode: ServerArguments['mode'] = 'stdio';
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (!['--http', '--host', '--port'].includes(arg)) {
      throw new Error(`Unknown server option: ${arg}`);
    }
    if (seen.has(arg)) {
      throw new Error(`Server option provided more than once: ${arg}`);
    }
    seen.add(arg);

    if (arg === '--http') {
      mode = 'http';
      continue;
    }

    const value = readOptionValue(args, index, arg);
    index++;
    if (arg === '--host') {
      host = value;
    } else {
      if (!/^\d+$/.test(value)) {
        throw new Error('--port must be an integer between 0 and 65535.');
      }
      port = Number(value);
      if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
        throw new Error('--port must be an integer between 0 and 65535.');
      }
    }
  }

  const hostWithoutBrackets = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (!isValidHostname(hostWithoutBrackets)) {
    throw new Error(`Invalid host: ${host}`);
  }
  host = hostWithoutBrackets;

  if (mode === 'stdio' && (seen.has('--host') || seen.has('--port'))) {
    throw new Error('--host and --port require --http.');
  }

  return { mode, host, port };
}

export function assertNoDeprecatedOAuthConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  const configured = DEPRECATED_OAUTH_ENV_VARS.filter(name => Boolean(env[name]?.trim()));
  if (configured.length === 0) return;

  throw new Error(
    `The custom OAuth configuration has been removed because it was not a safe public ` +
      `authentication boundary. Remove ${configured.join(', ')}. Use MCP_BEARER_TOKEN ` +
      `for controlled private HTTP deployments.`
  );
}

function resolveRequiredApiKey(explicitApiKey?: string): string {
  const apiKey = explicitApiKey?.trim() || resolveApiKey()?.key.trim();
  if (apiKey) return apiKey;

  throw new Error(
    'No Companies House API key found. Set COMPANIES_HOUSE_API_KEY or run ' +
      '`ch config set-key <key>`. Get a free key at ' +
      'https://developer.company-information.service.gov.uk/'
  );
}

function writeJson(
  res: import('node:http').ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function installSignalHandlers(server: RunningServer): () => void {
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void server.close().catch(error => {
      console.error('Failed to close Companies House MCP server:', error);
      process.exitCode = 1;
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return () => {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  };
}

function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function listen(server: HttpServer, port: number, host: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine the HTTP server address.');
  }
  return (address as AddressInfo).port;
}

async function startHttpServer(
  factory: ReturnType<typeof createCompaniesHouseMcpFactory>,
  host: string,
  port: number,
  bearerToken: string | undefined,
  version: string
): Promise<RunningServer> {
  const mcpHandler: McpHttpHandler = createMcpHandler(factory, {
    onerror: error => console.error('MCP request error:', error.message),
  });
  const handleMcpRequest = toNodeHandler(mcpHandler, {
    onerror: error => console.error('MCP Node adapter error:', error.message),
  });
  const validateHost = isLoopbackHost(host) ? localhostHostValidation() : undefined;
  const validateOrigin = isLoopbackHost(host) ? localhostOriginValidation() : undefined;

  const httpServer = createServer(async (req, res) => {
    if (validateHost && !validateHost(req, res)) return;
    if (validateOrigin && !validateOrigin(req, res)) return;

    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method Not Allowed');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        req.method === 'HEAD'
          ? undefined
          : JSON.stringify({
              status: 'ok',
              service: 'companies-house-mcp',
              version,
              tools: toolCount,
              protocols: MCP_PROTOCOLS,
            })
      );
      return;
    }

    if (url.pathname !== '/mcp') {
      writeJson(res, 404, {
        error: 'not_found',
        error_description: 'The MCP endpoint is /mcp. GET /health reports liveness.',
      });
      return;
    }

    // The gate sits at the HTTP layer. A 200 carrying a tool error would read
    // to a client as an ordinary tool failure and never prompt for credentials.
    if (bearerToken && !(await isAuthorised(req.headers.authorization, bearerToken))) {
      writeJson(
        res,
        401,
        { error: 'invalid_token', error_description: 'A valid bearer token is required.' },
        { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
      );
      return;
    }

    await handleMcpRequest(req, res);
  });

  let actualPort: number;
  try {
    actualPort = await listen(httpServer, port, host);
  } catch (error) {
    await mcpHandler.close();
    throw error;
  }

  let removeSignalHandlers = () => {};
  let closePromise: Promise<void> | undefined;
  const runningServer: RunningServer = {
    mode: 'http',
    host,
    port: actualPort,
    close() {
      closePromise ??= (async () => {
        removeSignalHandlers();
        await Promise.all([closeHttpServer(httpServer), mcpHandler.close()]);
      })();
      return closePromise;
    },
  };
  removeSignalHandlers = installSignalHandlers(runningServer);

  console.error(`Companies House MCP server (HTTP) listening at http://${host}:${actualPort}/mcp`);
  console.error(`${toolCount} tools registered`);
  console.error(
    bearerToken
      ? 'Auth: bearer token required (MCP_BEARER_TOKEN)'
      : 'Auth: local loopback access only'
  );

  return runningServer;
}

function startStdioServer(
  factory: ReturnType<typeof createCompaniesHouseMcpFactory>
): RunningServer {
  const stdioHandle: StdioServerHandle = serveStdio(factory, {
    onerror: error => console.error('MCP stdio error:', error.message),
  });

  let removeSignalHandlers = () => {};
  let closePromise: Promise<void> | undefined;
  const runningServer: RunningServer = {
    mode: 'stdio',
    close() {
      closePromise ??= (async () => {
        removeSignalHandlers();
        await stdioHandle.close();
      })();
      return closePromise;
    },
  };
  removeSignalHandlers = installSignalHandlers(runningServer);

  console.error(`Companies House MCP server (stdio) started — ${toolCount} tools registered`);
  return runningServer;
}

export async function runServer({
  version,
  argv = process.argv.slice(2),
  apiKey,
}: RunServerOptions): Promise<RunningServer> {
  assertNoDeprecatedOAuthConfiguration();
  const args = parseServerArguments(argv);
  const bearerToken = process.env.MCP_BEARER_TOKEN?.trim() || undefined;

  if (args.mode === 'http' && !isLoopbackHost(args.host) && !bearerToken) {
    throw new Error(
      `Refusing to bind an unauthenticated MCP server to ${args.host}. ` +
        'Set MCP_BEARER_TOKEN or use a loopback host.'
    );
  }

  const factory = createCompaniesHouseMcpFactory({
    apiKey: resolveRequiredApiKey(apiKey),
    version,
  });

  return args.mode === 'http'
    ? startHttpServer(factory, args.host, args.port, bearerToken, version)
    : startStdioServer(factory);
}
