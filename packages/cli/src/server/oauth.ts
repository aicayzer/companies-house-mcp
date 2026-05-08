import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  expectedToken: string;
  publicUrlOverride: string | undefined;
  port: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: unknown) => {
      body += String(chunk);
    });
    req.on('end', () => resolve(body));
    req.on('error', (err: unknown) => reject(err));
  });
}

/** Constant-time string compare so credential checks don't leak timing
 *  info. If lengths differ we still run a constant-time op on equal-
 *  length hashes to keep timing uniform. */
function safeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ba.length !== bb.length) {
    const ha = createHash('sha256').update(ba).digest();
    const hb = createHash('sha256').update(bb).digest();
    timingSafeEqual(ha, hb);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Build a stateless OAuth authorization code: a base64url-encoded JSON
 *  payload joined to an HMAC signature. Verifying the signature later is
 *  enough to trust the payload — no server-side store is needed, which
 *  works across Fly's HA pair (both machines share the signing secret
 *  via env var). */
function makeAuthCode(
  payload: Record<string, unknown>,
  signingKey: string,
): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf-8').toString('base64url');
  const sig = createHmac('sha256', signingKey).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verify an auth code's HMAC signature and return the decoded payload,
 *  or null if the signature doesn't match / the code is malformed. */
function verifyAuthCode(
  code: string,
  signingKey: string,
): Record<string, unknown> | null {
  const dotIdx = code.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const body = code.slice(0, dotIdx);
  const sig = code.slice(dotIdx + 1);
  const expectedSig = createHmac('sha256', signingKey)
    .update(body)
    .digest('base64url');
  if (!safeStringEqual(sig, expectedSig)) return null;
  try {
    const json = Buffer.from(body, 'base64url').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Parse client_id / client_secret out of the request — either via HTTP
 *  Basic auth (RFC 6749 §2.3.1) or the request body. Returns whatever
 *  could be parsed; caller validates against config. */
function extractClientCredentials(
  req: IncomingMessage,
  params: URLSearchParams,
): { clientId: string | undefined; clientSecret: string | undefined } {
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  const authHeader = (req.headers.authorization as string | undefined) ?? '';
  const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
  if (basicMatch && basicMatch[1]) {
    try {
      const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx >= 0) {
        clientId = decodeURIComponent(decoded.slice(0, colonIdx));
        clientSecret = decodeURIComponent(decoded.slice(colonIdx + 1));
      }
    } catch {
      /* fall through to body credentials */
    }
  }
  if (!clientId) clientId = params.get('client_id') ?? undefined;
  if (!clientSecret) clientSecret = params.get('client_secret') ?? undefined;
  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Handle OAuth discovery, authorize and token endpoints.
 *
 * Supports two grant types:
 *   - client_credentials  (server-to-server, e.g. curl tests)
 *   - authorization_code  (with PKCE, used by Claude desktop's Custom
 *                          Connector and other browser-driven flows)
 *
 * Issued access tokens equal the configured static bearer token, which
 * means the existing /mcp bearer-auth check accepts both manually-set
 * and OAuth-issued tokens with no extra logic.
 *
 * Returns true if the request was handled (caller should return),
 * false otherwise.
 */
export async function handleOAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config: OAuthConfig,
): Promise<boolean> {
  // ---- CORS preflight (Claude desktop may invoke OAuth from a webview).
  if (
    req.method === 'OPTIONS' &&
    (pathname === '/oauth/token' || pathname === '/oauth/authorize')
  ) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  // ---- Discovery metadata
  if (pathname === '/.well-known/oauth-authorization-server') {
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const host =
      (req.headers.host as string | undefined) ?? `localhost:${config.port}`;
    const issuer = config.publicUrlOverride || `${proto}://${host}`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'client_credentials'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
          'none',
        ],
        scopes_supported: ['mcp'],
      }),
    );
    return true;
  }

  // ---- Authorization endpoint
  // Single-user server: validate the request, mint a signed code, and
  // 302 back to redirect_uri. There's no login UI because there's only
  // one user; possession of client_id is treated as approval.
  if (pathname === '/oauth/authorize') {
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end('Method Not Allowed');
      return true;
    }

    // We need the query string — parse from req.url. The caller passes
    // pathname only, so we re-parse the URL here to get searchParams.
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const host =
      (req.headers.host as string | undefined) ?? `localhost:${config.port}`;
    const url = new URL(req.url ?? '/', `${proto}://${host}`);
    const q = url.searchParams;
    const responseType = q.get('response_type');
    const reqClientId = q.get('client_id');
    const redirectUri = q.get('redirect_uri');
    const state = q.get('state') ?? '';
    const codeChallenge = q.get('code_challenge') ?? '';
    const codeChallengeMethod = q.get('code_challenge_method') ?? 'plain';
    const scope = q.get('scope') ?? '';

    const redirectError = (code: string, description: string): void => {
      if (!redirectUri) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: code, error_description: description }),
        );
        return;
      }
      let target: URL;
      try {
        target = new URL(redirectUri);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_request',
            error_description: 'Malformed redirect_uri',
          }),
        );
        return;
      }
      target.searchParams.set('error', code);
      target.searchParams.set('error_description', description);
      if (state) target.searchParams.set('state', state);
      res.writeHead(302, { Location: target.toString() });
      res.end();
    };

    if (!reqClientId || reqClientId !== config.clientId) {
      // Per RFC 6749 §4.1.2.1, an unknown client_id should NOT redirect
      // — return a direct error to avoid open-redirect risk.
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        }),
      );
      return true;
    }
    if (!redirectUri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing redirect_uri',
        }),
      );
      return true;
    }
    if (responseType !== 'code') {
      redirectError(
        'unsupported_response_type',
        'Only response_type=code is supported',
      );
      return true;
    }
    if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
      redirectError('invalid_request', 'Unsupported code_challenge_method');
      return true;
    }

    // Mint a 10-minute auth code containing everything we'll need to
    // verify the subsequent /oauth/token request.
    const code = makeAuthCode(
      {
        cid: reqClientId,
        rdi: redirectUri,
        cch: codeChallenge,
        ccm: codeChallengeMethod,
        sco: scope,
        exp: Date.now() + 10 * 60 * 1000,
      },
      config.expectedToken,
    );

    let target: URL;
    try {
      target = new URL(redirectUri);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Malformed redirect_uri',
        }),
      );
      return true;
    }
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    res.writeHead(302, { Location: target.toString() });
    res.end();
    return true;
  }

  // ---- Token endpoint
  if (pathname === '/oauth/token') {
    if (req.method !== 'POST') {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        Allow: 'POST',
      });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Only POST is supported',
        }),
      );
      return true;
    }

    let bodyText = '';
    try {
      bodyText = await readRequestBody(req);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: `Could not read body: ${(err as Error).message}`,
        }),
      );
      return true;
    }

    const params = new URLSearchParams(bodyText);
    const { clientId: reqClientId, clientSecret: reqClientSecret } =
      extractClientCredentials(req, params);
    const grantType = params.get('grant_type');

    const issueToken = (): void => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          access_token: config.expectedToken,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
    };

    // -- client_credentials grant (preserved for backward compat with
    //    the upstream behaviour pre-authorization_code).
    if (grantType === 'client_credentials') {
      if (
        !reqClientId ||
        !reqClientSecret ||
        !safeStringEqual(reqClientId, config.clientId) ||
        !safeStringEqual(reqClientSecret, config.clientSecret)
      ) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic',
        });
        res.end(
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'Unknown client_id or client_secret',
          }),
        );
        return true;
      }
      issueToken();
      return true;
    }

    // -- authorization_code grant (with PKCE)
    if (grantType === 'authorization_code') {
      const code = params.get('code') ?? '';
      const codeVerifier = params.get('code_verifier') ?? '';
      const redirectUri = params.get('redirect_uri') ?? '';

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_request',
            error_description: 'Missing code',
          }),
        );
        return true;
      }
      const payload = verifyAuthCode(code, config.expectedToken);
      if (!payload) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code signature',
          }),
        );
        return true;
      }

      const exp = typeof payload.exp === 'number' ? payload.exp : 0;
      if (Date.now() > exp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Authorization code expired',
          }),
        );
        return true;
      }

      const expectedClientId = String(payload.cid ?? '');
      if (
        !reqClientId ||
        !safeStringEqual(reqClientId, expectedClientId) ||
        !safeStringEqual(expectedClientId, config.clientId)
      ) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic',
        });
        res.end(
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'client_id mismatch',
          }),
        );
        return true;
      }

      // Confidential clients (those that registered a secret) must
      // present it. Public clients (PKCE-only) may omit the secret.
      // Since we have one configured client and it has a secret, we
      // accept either: secret present + matches, OR secret absent +
      // valid PKCE (checked below).
      if (reqClientSecret) {
        if (!safeStringEqual(reqClientSecret, config.clientSecret)) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Basic',
          });
          res.end(
            JSON.stringify({
              error: 'invalid_client',
              error_description: 'Bad client_secret',
            }),
          );
          return true;
        }
      }

      const expectedRedirectUri = String(payload.rdi ?? '');
      if (
        !redirectUri ||
        !safeStringEqual(redirectUri, expectedRedirectUri)
      ) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'redirect_uri mismatch',
          }),
        );
        return true;
      }

      // PKCE verification — required if the original /authorize
      // request included a code_challenge.
      const challenge = String(payload.cch ?? '');
      const challengeMethod = String(payload.ccm ?? 'plain');
      if (challenge) {
        if (!codeVerifier) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Missing code_verifier',
            }),
          );
          return true;
        }
        let derived: string;
        if (challengeMethod === 'S256') {
          derived = createHash('sha256')
            .update(codeVerifier, 'utf-8')
            .digest('base64url');
        } else {
          derived = codeVerifier;
        }
        if (!safeStringEqual(derived, challenge)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'PKCE verification failed',
            }),
          );
          return true;
        }
      } else if (!reqClientSecret) {
        // No PKCE and no client secret — not allowed.
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'invalid_client',
            error_description:
              'Public clients must use PKCE; confidential clients must present client_secret',
          }),
        );
        return true;
      }

      issueToken();
      return true;
    }

    // Unknown / missing grant_type
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grantType ?? ''}' is not supported`,
      }),
    );
    return true;
  }

  return false;
}
