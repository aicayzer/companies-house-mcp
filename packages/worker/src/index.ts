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
import { isAuthorised } from 'companies-house-cli/secret';
import { WORKER_VERSION } from './version.js';

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
 */
let handler: McpHttpHandler | undefined;

function getHandler(apiKey: string): McpHttpHandler {
  handler ??= createMcpHandler(
    createCompaniesHouseMcpFactory({ apiKey, version: WORKER_VERSION }),
    {
      // Reporting only. The message never includes request bodies or headers,
      // so a credential cannot reach the log from here.
      onerror: error => console.error('MCP request error:', error.message),
    }
  );
  return handler;
}

function json(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function misconfigured(missing: string[]): Response {
  // Names only. The values are secrets and must never appear in a response.
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
      return json({ status: 'ok', service: 'companies-house-mcp', version: WORKER_VERSION });
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

    const missing: string[] = [];
    if (!env.MCP_BEARER_TOKEN?.trim()) missing.push('MCP_BEARER_TOKEN');
    if (!env.COMPANIES_HOUSE_API_KEY?.trim()) missing.push('COMPANIES_HOUSE_API_KEY');
    if (missing.length) return misconfigured(missing);

    // The gate is at the HTTP layer. A 200 carrying a tool error would read to
    // a client as an ordinary tool failure and would never prompt for
    // credentials, so authentication failures answer 401 with a challenge.
    const authorised = await isAuthorised(
      request.headers.get('authorization'),
      env.MCP_BEARER_TOKEN!.trim()
    );
    if (!authorised) {
      return json(
        { error: 'invalid_token', error_description: 'A valid bearer token is required.' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      );
    }

    return getHandler(env.COMPANIES_HOUSE_API_KEY!.trim()).fetch(request);
  },
};
