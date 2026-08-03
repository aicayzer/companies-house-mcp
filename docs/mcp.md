# MCP setup

Connect an AI assistant to the Companies House public register. 18 tools for search, company records, officers, ownership, filings and documents.

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/). It is free and takes about a minute. Every user brings their own key; there is no shared one.

## Claude Code

```bash
claude mcp add companies-house -e COMPANIES_HOUSE_API_KEY=your-key-here -- npx -y companies-house-mcp
```

Check it with `claude mcp list`.

To share the setup with a project without sharing the key, commit a `.mcp.json` that reads the key from the environment:

```json
{
  "mcpServers": {
    "companies-house": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "companies-house-mcp"],
      "env": { "COMPANIES_HOUSE_API_KEY": "${COMPANIES_HOUSE_API_KEY}" }
    }
  }
}
```

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "npx",
      "args": ["-y", "companies-house-mcp"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Codex

```bash
codex mcp add companies-house --env COMPANIES_HOUSE_API_KEY=your-key-here -- npx -y companies-house-mcp
```

Confirm with `codex mcp get companies-house`.

## Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "npx",
      "args": ["-y", "companies-house-mcp"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Zed

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "companies-house": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "companies-house-mcp"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your-key-here"
      }
    }
  }
}
```

## What to ask

Once connected:

- "Look up Tesco on Companies House"
- "Who are the current directors of company 14604577?"
- "What does the register say about company SC311560?"
- "Show me the accounts BrewDog filed last year"
- "What other companies is this director appointed to?"
- "Does this company have outstanding charges?"
- "Who controls this company?"
- "Download the latest confirmation statement for company 14604577"

The tools return readable text alongside a structured payload, so an assistant can both summarise and compute.

## Running over HTTP

Stdio is the default and the right choice for local clients. Streamable HTTP exists for local development and for a server you deploy yourself.

Bind to loopback with no token:

```bash
COMPANIES_HOUSE_API_KEY=your-key npx companies-house-mcp --http
```

That listens on `http://127.0.0.1:3000/mcp`. Loopback-only traffic needs no token.

Bind anywhere else and a token becomes mandatory — the server refuses to start without one:

```bash
COMPANIES_HOUSE_API_KEY=your-key \
MCP_BEARER_TOKEN=$(openssl rand -hex 32) \
npx companies-house-mcp --http --host 0.0.0.0 --port 8080
```

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /mcp` | Bearer token when bound off-loopback | MCP requests |
| `GET /health` | None | Liveness, tool count and supported protocol families |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `COMPANIES_HOUSE_API_KEY` | Yes | Your own key from developer.company-information.service.gov.uk |
| `MCP_BEARER_TOKEN` | For any non-loopback HTTP bind | The token clients must present on `/mcp` |

There is no download-directory variable. `download_filing_document` returns the document to the caller; pass `save_to` when you want a copy written to the machine running the server.

The removed custom OAuth variables — `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`, `MCP_PUBLIC_URL` — now cause startup to fail with migration guidance rather than quietly restoring an unsafe boundary.

## Remote servers

You can deploy your own remote server as a Cloudflare Worker in your own account, with your own API key and your own bearer token. See [self-hosting](/self-hosting).

**Claude Code, Cursor and VS Code support this**, because they send a static bearer token on every request.

**Claude.ai and Claude Desktop custom connectors do not.** Their generally available authentication is OAuth, which this project deliberately does not implement: an API-key proxy dressed as OAuth would be a weaker boundary, not a stronger one. Anthropic has a beta static-header option for connectors, but it is gated and organisation-scoped, so no support is claimed for it here.

## Protocol

The server speaks the `2026-07-28` MCP revision and still serves the legacy handshake era for older clients. Tools carry titles, complete input schemas and read-only annotations, and return both text and structured content.

## Tools

See the [full tools reference](/tools).
