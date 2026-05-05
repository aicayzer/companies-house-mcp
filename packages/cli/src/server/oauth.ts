import type { IncomingMessage, ServerResponse } from 'node:http';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  expectedToken: string;
  publicUrlOverride: string | undefined;
  port: number;
}

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

/**
 * Handle OAuth discovery and token endpoints.
 * Returns true if the request was handled (caller should return), false otherwise.
 */
export async function handleOAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config: OAuthConfig,
): Promise<boolean> {
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
        token_endpoint: `${issuer}/oauth/token`,
        grant_types_supported: ['client_credentials'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
        ],
        response_types_supported: [],
      }),
    );
    return true;
  }

  if (pathname === '/oauth/token') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
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

    // Client credentials may arrive via HTTP Basic auth (RFC 6749 §2.3.1) or body.
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

    if (
      !clientId ||
      !clientSecret ||
      clientId !== config.clientId ||
      clientSecret !== config.clientSecret
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

    const grantType = params.get('grant_type');
    if (grantType !== 'client_credentials') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'unsupported_grant_type',
          error_description:
            'Only client_credentials grant is supported by this server',
        }),
      );
      return true;
    }

    // Re-use the static MCP_BEARER_TOKEN as the access token — the /mcp
    // bearer-auth check accepts it with no extra logic. expires_in is
    // advisory; the token never actually expires.
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    });
    res.end(
      JSON.stringify({
        access_token: config.expectedToken,
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    return true;
  }

  return false;
}
