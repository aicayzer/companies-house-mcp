# MCP setup

The MCP server connects AI assistants to live Companies House data. 18 tools for search, company profiles, officers, filings, charges, insolvency, and due diligence — including direct document downloads.

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, takes about 30 seconds.

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

## Claude Code

```bash
claude mcp add --transport stdio --env COMPANIES_HOUSE_API_KEY=your-key-here companies-house -- npx -y companies-house-mcp
```

Or add to `~/.claude.json` manually:

```json
{
  "mcpServers": {
    "companies-house": {
      "type": "stdio",
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

Register the stdio server with the Codex CLI:

```bash
codex mcp add \
  --env COMPANIES_HOUSE_API_KEY=your-key-here \
  companies-house -- npx -y companies-house-mcp
```

Confirm the registration with `codex mcp get companies-house`.

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

## HTTP mode

The server can run as Streamable HTTP instead of stdio for local development or a controlled private deployment. It supports legacy MCP clients alongside protocol version `2026-07-28`.

Start on the default loopback address and port (`127.0.0.1:3000`):

```bash
COMPANIES_HOUSE_API_KEY=your-key \
npx companies-house-mcp --http
```

Or choose a host and port explicitly. A non-loopback binding requires a bearer token:

```bash
COMPANIES_HOUSE_API_KEY=your-key \
MCP_BEARER_TOKEN=a-long-random-token \
npx companies-house-mcp --http --host 0.0.0.0 --port 8080
```

Two endpoints are available:

| Endpoint | Purpose |
|----------|---------|
| `/mcp` | MCP protocol requests |
| `GET /health` | Unauthenticated health check with tool count and supported protocol families |

### Authentication and environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `COMPANIES_HOUSE_API_KEY` | Yes | Your own API key from developer.company-information.service.gov.uk |
| `MCP_BEARER_TOKEN` | Non-loopback HTTP only | Bearer token required on `/mcp`; loopback-only HTTP can run without one |
| `COMPANIES_HOUSE_DOWNLOAD_DIR` | Optional | Default save directory for `download_filing_document` in `file_path` mode |

Bearer authentication is intended for a server you control. Put TLS and any wider network access controls in front of it. The server refuses a non-loopback binding without `MCP_BEARER_TOKEN`.

The previous custom OAuth environment variables and endpoints have been removed. If `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`, or `MCP_PUBLIC_URL` is set, startup fails with migration guidance rather than silently using an unsafe authentication boundary.

### Public Claude Custom Connectors

This release is not a public Claude Custom Connector deployment. Public connectors require a real hosted OAuth boundary with user authorisation and consent; a bearer token on a privately controlled server is not a substitute. A supported self-hosted deployment and authentication path is planned separately.

## What to ask

Once connected, ask naturally:

- "Look up Tesco on Companies House"
- "Who are the directors of Anthropic Limited?"
- "Run a due diligence check on company 07670541"
- "Show me the filing history for BrewDog"
- "What other companies is this director involved with?"
- "Does this company have any outstanding charges?"
- "Map the ownership structure of this holding company"
- "Are there any insolvency proceedings against this company?"

## Tools

18 tools available. See the [full tools reference →](/tools).

## CLI

For terminal access without an AI assistant, install [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli). See the [CLI reference →](/cli).
