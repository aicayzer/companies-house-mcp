# Self-hosting a remote server

Most people do not need this. The stdio server needs no deployment and is the right default for every local client — see [MCP setup](/mcp).

Deploy a remote server when you want an MCP endpoint reachable over the network: from a machine that cannot run Node, from more than one of your own machines, or from a client that only speaks HTTP.

## What it is

A single Cloudflare Worker running the same MCP server, over Streamable HTTP, in **your** Cloudflare account. It uses your Companies House API key and a bearer token you generate. There is no shared instance, and this project operates no service on your behalf.

It holds no database, no session store and no Durable Object — the current MCP protocol revision is stateless, so there is nothing to keep between requests. A single user's traffic fits inside the Cloudflare free plan.

## Which clients can use it

**Claude Code, Cursor and VS Code.** All three send a static bearer token on every request, which is exactly what the Worker expects.

**Not Claude.ai or Claude Desktop custom connectors.** Their generally available authentication is OAuth. This project deliberately does not implement OAuth: an API-key proxy shaped like OAuth is a weaker security boundary, not a stronger one, and shipping one would misrepresent what protects your key. Anthropic has a beta static-header option for connectors, but it is gated and organisation-scoped, so no support is claimed for it here.

If you need Claude Desktop, use the stdio server. It is a better fit anyway.

## The security boundary

Your bearer token is the only thing between the internet and your Companies House API key. Treat it as a password: make it long and random, never commit it, and rotate it if you think it has leaked.

The Worker answers `401` for a missing or wrong token at the HTTP layer, before anything reaches the MCP server, and does not reveal which of the two it was. Secrets are stored encrypted by Cloudflare, are never printed back, and never appear in logs or responses.

This is a private, single-user boundary. There is no user model and no consent step. Do not share the URL and token with anyone you would not hand your API key to.

## Deploy it

The full guide — deploying, setting the two secrets, verifying, connecting Claude Code, rotating the token and taking it down — lives with the code:

**[Worker deployment guide →](https://github.com/aicayzer/companies-house-mcp/tree/main/packages/worker)**

## Running HTTP yourself instead

If you would rather run the HTTP server on your own machine or your own host, `npx companies-house-mcp --http` does that. It binds to `127.0.0.1` by default, where no token is needed. Binding to any other address requires `MCP_BEARER_TOKEN`, and the server refuses to start without one. Put TLS and whatever network controls you need in front of it. See [MCP setup](/mcp#running-over-http).
