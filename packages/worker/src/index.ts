/**
 * Companies House MCP server as a single-user Cloudflare Worker.
 *
 * This is the optional remote path. It runs the same transport-neutral server
 * the stdio entry point runs, over Streamable HTTP, protected by a bearer
 * token that the deployer sets as a Worker secret. It is deployed by an
 * individual into their own Cloudflare account with their own Companies House
 * API key. There is no shared instance and no shared key.
 *
 * Deliberately small: a `fetch` handler, no Durable Object, no session store,
 * no OAuth. The MCP SDK's HTTP handler is already a web-standard
 * `fetch(request) -> Response`, and the 2026-07-28 protocol revision is
 * stateless, so nothing here needs to persist between requests.
 */

import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { createCompaniesHouseMcpFactory } from 'companies-house-cli/mcp';
import { getAllTools } from 'companies-house-cli/tools';
import { isAuthorised } from 'companies-house-cli/secret';
import { WORKER_VERSION } from './version.js';

const TOOL_COUNT = getAllTools().length;

export interface Env {
  /** The deployer's own Companies House API key. Set with `wrangler secret put`. */
  COMPANIES_HOUSE_API_KEY?: string;
  /** The bearer token clients must present. Set with `wrangler secret put`. */
  MCP_BEARER_TOKEN?: string;
}

/**
 * Built once per isolate and reused while it stays warm, so the API client's
 * cache and rate limiter survive across requests on the same instance. Both
 * are best-effort courtesies to Companies House rather than an accounting
 * system, so losing them when an isolate is recycled is harmless.
 *
 * The cache is keyed on the API key so a rotated secret cannot keep being
 * served by a warm isolate holding the old one.
 */
let cached: { apiKey: string; handler: McpHttpHandler } | undefined;

function getHandler(apiKey: string): McpHttpHandler {
  if (cached?.apiKey !== apiKey) {
    cached = {
      apiKey,
      handler: createMcpHandler(
        createCompaniesHouseMcpFactory({ apiKey, version: WORKER_VERSION }),
        {
          // Reporting only. The message never includes request bodies or
          // headers, so a credential cannot reach the log from here.
          onerror: error => console.error('MCP request error:', error.message),
        }
      ),
    };
  }
  return cached.handler;
}

function json(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function unauthorised(): Response {
  return json(
    { error: 'invalid_token', error_description: 'A valid bearer token is required.' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
  );
}

/**
 * Report a missing secret by name to the deployer, never its value.
 *
 * Only reachable after a successful bearer check, so an unauthenticated
 * caller cannot use it to learn which secrets a Worker has been given.
 */
function misconfigured(missing: string[]): Response {
  console.error(`Worker is missing required secret(s): ${missing.join(', ')}`);
  return json(
    {
      error: 'server_misconfigured',
      error_description: `The Worker is missing ${missing.join(' and ')}. Set them with "wrangler secret put".`,
    },
    { status: 500 }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      // Unauthenticated on purpose, and deliberately says nothing about
      // whether the secrets are correct — only that the Worker is running.
      return json({
        status: 'ok',
        service: 'companies-house-mcp',
        version: WORKER_VERSION,
        tools: TOOL_COUNT,
      });
    }

    if (url.pathname !== '/mcp') {
      return json(
        {
          error: 'not_found',
          error_description: 'The MCP endpoint is /mcp. GET /health reports liveness.',
        },
        { status: 404 }
      );
    }

    // Authentication comes first, so an unauthenticated caller cannot use the
    // configuration report below to learn which secrets this Worker holds.
    const expectedToken = env.MCP_BEARER_TOKEN?.trim();
    if (!expectedToken) {
      // Nothing can authenticate, so nothing can be served. Answer opaquely
      // rather than confirming the Worker is half-configured.
      console.error('Worker is missing required secret(s): MCP_BEARER_TOKEN');
      return json(
        { error: 'unavailable', error_description: 'This server is not available.' },
        { status: 503 }
      );
    }

    // The gate is at the HTTP layer. A 200 carrying a tool error would read to
    // a client as an ordinary tool failure and would never prompt for
    // credentials, so authentication failures answer 401 with a challenge.
    if (!(await isAuthorised(request.headers.get('authorization'), expectedToken))) {
      return unauthorised();
    }

    const apiKey = env.COMPANIES_HOUSE_API_KEY?.trim();
    if (!apiKey) return misconfigured(['COMPANIES_HOUSE_API_KEY']);

    return getHandler(apiKey).fetch(request);
  },
};
