# Companies House MCP on Cloudflare Workers

Deploy your own remote Companies House MCP server. You run it in your own Cloudflare account, with your own Companies House API key and your own bearer token. There is no shared instance and no shared key.

Use this only if you want a remote server. The stdio server (`npx -y companies-house-mcp`) needs no deployment and is the right default.

## What you get

A single Worker exposing two routes:

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /mcp` | Bearer token | The MCP endpoint |
| `GET /health` | None | Liveness. Reports the version and tool count, and nothing about your secrets |

Anything else returns 404.

## Which clients this supports

**Claude Code is the supported client.** It sends a static bearer token on every request, which is what this Worker expects. Cursor and VS Code configure the same way.

**Claude.ai and Claude Desktop custom connectors are not supported.** Their generally available authentication is OAuth, which this Worker deliberately does not implement — an API-key proxy dressed as OAuth would be a worse security boundary, not a better one. Anthropic has a beta static-header option for connectors, but it is gated and organisation-scoped, so this project does not claim it works.

## Before you start

- A Cloudflare account. The free plan is enough.
- Your own Companies House API key, free from [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).
- Node.js 22 or newer, and `pnpm`.

## Deploy

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
```

Pick a name for your Worker. It becomes part of the URL, so choose something not easily guessed if you would rather it were not stumbled upon:

```bash
cd packages/worker
```

Edit `name` in `wrangler.jsonc`, then log in and deploy:

```bash
npx wrangler login
pnpm run deploy
```

`pnpm run deploy` rebuilds the shared server before bundling. Note the `run`: bare `pnpm deploy` is a built-in pnpm command and does something else entirely. Running `wrangler deploy` directly bundles whatever was last built, which silently ships stale code.

Wrangler prints your URL, of the form `https://<name>.<your-subdomain>.workers.dev`.

## Set the two secrets

Generate a bearer token. This is the password to your server, so make it long and random:

```bash
openssl rand -hex 32
```

Store both secrets. `wrangler secret put` prompts for the value; it is encrypted at rest and never printed back:

```bash
npx wrangler secret put COMPANIES_HOUSE_API_KEY
npx wrangler secret put MCP_BEARER_TOKEN
```

Confirm the names are set. This lists names only, never values:

```bash
npx wrangler secret list
```

Without `MCP_BEARER_TOKEN` nothing can authenticate, so `POST /mcp` answers `503` and says nothing more — an unauthenticated caller learns nothing about how the Worker is configured. Once the token is set, an authenticated caller missing the API key gets a `500` naming that secret. Neither response ever reveals a value.

## Check it works

```bash
curl https://<your-worker-url>/health
```

Expect `{"status":"ok","service":"companies-house-mcp","version":"...","tools":18}`.

Then confirm it refuses an unauthenticated call:

```bash
curl -i -X POST https://<your-worker-url>/mcp -d '{}'
```

Expect `401` with a `WWW-Authenticate: Bearer` header.

Then list the tools:

```bash
npx @modelcontextprotocol/inspector --cli https://<your-worker-url>/mcp \
  --transport http \
  --header "Authorization: Bearer <your-token>" \
  --method tools/list
```

## Connect Claude Code

Put the token in an environment variable rather than typing it into a command, so it does not end up in your shell history:

```bash
read -rs COMPANIES_HOUSE_MCP_TOKEN && export COMPANIES_HOUSE_MCP_TOKEN
claude mcp add --transport http companies-house https://<your-worker-url>/mcp --header "Authorization: Bearer $COMPANIES_HOUSE_MCP_TOKEN"
```

`read -rs` takes the token without echoing it. Note that `claude mcp add` stores the resolved value in your Claude Code config, so that file now holds the token — keep it out of any repository.

For a project checked into git, keep the token out of the config too by interpolating it in `.mcp.json`:

```json
{
  "mcpServers": {
    "companies-house": {
      "type": "http",
      "url": "https://<your-worker-url>/mcp",
      "headers": { "Authorization": "Bearer ${COMPANIES_HOUSE_MCP_TOKEN}" }
    }
  }
}
```

Check the connection with `claude mcp list`.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in your own values. `.dev.vars` is gitignored; never commit it.

```bash
npx wrangler dev
```

## Operational notes

**Cost.** A single user's traffic sits inside the Workers free plan. The Worker holds no Durable Object, KV, D1 or R2, so there is nothing else to pay for.

**Caching and rate limiting.** The API client keeps a short-lived response cache and queues requests to stay inside the Companies House limit of 600 requests per five minutes. Both live in the Worker's memory and reset whenever Cloudflare recycles the isolate. They are courtesies to Companies House, not guarantees — nothing depends on them surviving.

**Request size.** The document tool refuses content above 128 KB by default and 25 MB at the hard maximum. The limit is checked against the document metadata and the response length before anything is buffered, so a large document cannot exhaust the isolate. The default is small because the document travels back inside the tool result and lands in the caller's context; raise `max_bytes` deliberately when you need a bigger one.

**Logs.** `observability.logs` is on, so `npx wrangler tail` streams live requests and the dashboard keeps recent ones. The Worker logs error messages, HTTP status and paths. It never logs the Authorization header, the bearer token, the Companies House API key, or request bodies. If you add logging, keep it that way.

**Rotating the bearer token.** Run `wrangler secret put MCP_BEARER_TOKEN` again with a new value, then update your clients. The change takes effect on the next request.

**Redeploying.** Always `pnpm run deploy` rather than `wrangler deploy`, so the shared server is rebuilt first.

**Taking it down.** `npx wrangler delete` removes the Worker and its secrets.

## Security boundary

The bearer token is the only thing between the internet and your Companies House API key. Treat it as a password:

- Never commit it. Never paste it into an issue, a log, or a screenshot.
- Use a long random value, not a memorable one.
- Rotate it if you suspect it has leaked.

The Worker returns `401` for a missing or wrong token at the HTTP layer, before any request reaches the MCP server, and gives no hint which of the two it was.

This is a private, single-user boundary. It is not a multi-tenant service and has no user model, consent screen or per-user authorisation. Do not share the URL and token with people you would not give your API key to.
