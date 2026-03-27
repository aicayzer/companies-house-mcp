# companies-house-mcp

MCP server for the UK [Companies House](https://www.gov.uk/government/organisations/companies-house) API. Connects Claude, Cursor, Windsurf, Zed, and other AI tools to live UK company data.

Provides 17 tools: company search and profiles, officers, ownership (PSCs), filings, charges, insolvency, due diligence checks, and officer network mapping.

> [!NOTE]
> This package is the MCP server only. The full CLI (`ch`) is in [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli).

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, takes about 30 seconds.

## Setup

### Claude Desktop

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

<details>
<summary>Claude Code</summary>

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

</details>

<details>
<summary>Cursor</summary>

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

</details>

<details>
<summary>Windsurf</summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

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

</details>

<details>
<summary>Zed</summary>

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

</details>

## What you can ask

Once connected, ask naturally:

- "Look up Tesco on Companies House"
- "Who are the directors of Anthropic Limited?"
- "Run a due diligence check on company number 14604577"
- "Show me the filing history for BrewDog"
- "What other companies is this director involved with?"
- "Does this company have any outstanding charges?"

## CLI

For terminal access without an AI assistant, install [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli):

```bash
npm install -g companies-house-cli
ch search "Anthropic"
ch report 14604577
```

## Development

This package is part of the [companies-house monorepo](https://github.com/aicayzer/companies-house-mcp). See the root README for development setup.

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
