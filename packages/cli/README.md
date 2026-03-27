# Companies House CLI

[![npm version](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm downloads](https://img.shields.io/npm/dw/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)
[![Node 22+](https://img.shields.io/node/v/companies-house-cli?style=flat)](https://nodejs.org/)

Search for UK companies, check who runs them, trace ownership, scrutinise filings, and run due diligence checks — from your terminal or AI assistant. Built on the free [Companies House API](https://developer.company-information.service.gov.uk/).

> [!NOTE]
> Also includes an MCP server for AI assistants. Install [`companies-house-mcp`](https://www.npmjs.com/package/companies-house-mcp) to connect Claude, Cursor, Windsurf, and others.

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, takes about 30 seconds. You'll need this regardless of whether you're using the CLI or the MCP server.

## Setup

### Terminal

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
ch search "Anthropic"
```

Three output modes: clean terminal formatting (default), `--md` for markdown, `--json` for scripting.

### AI assistants (MCP)

Install the MCP server package and connect your AI tool. Claude Desktop is shown below — see [companies-house-mcp](https://www.npmjs.com/package/companies-house-mcp) for full setup details.

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

## What it can do

### With Claude (or any AI assistant)

Once the MCP server is connected, ask naturally:

- "Look up Tesco on Companies House"
- "Who are the directors of Anthropic Limited?"
- "Run a due diligence check on company number 14604577"
- "Show me the filing history for BrewDog"
- "What other companies is this director involved with?"
- "Does this company have any outstanding charges?"
- "Map the ownership structure of this holding company"

### CLI reference

```
ch search "Anthropic"                      Search companies by name
ch search --status active --sic 62011      Filter by status, SIC code, type, location
ch profile 14604577                        Company profile
ch officers 14604577                       Current officers
ch officers 14604577 --all                 Include resigned officers
ch ownership 14604577                      Who owns/controls the company (PSCs)
ch filings 14604577                        Filing history
ch filings 14604577 --category accounts    Filter filings by category
ch charges 00445790                        Charges and mortgages
ch insolvency 00445790                     Insolvency proceedings
ch report 14604577                         Everything in one call
ch check 14604577                          Due diligence red-flag scan
ch network "John Smith"                    Officer's company connections
ch network --id abc123                     Officer network by ID
ch search-officers "Smith"                 Search for officers by name
ch config set-key your-key                 Save API key
ch config show                             Show current key source
ch serve                                   Start MCP server (stdio)
ch serve --http --port 3000                Start MCP server (HTTP)
```

**Flags available on most commands:**
- `--json` — raw JSON output, pipe-friendly
- `--md` — markdown output, good for notes and files
- `--key your-key` — override the configured API key for this call

## Tools

17 tools available via the MCP server.

**Search** — `search_companies`, `search_officers`

**Company data** — `get_company_profile`, `get_officers`, `get_appointments`, `get_ownership`, `get_filings`, `get_charges`, `get_insolvency`, `get_company_registers`

**Composite** — combine multiple API calls into one response:
- `company_report` — full overview (profile, officers, ownership, charges, filings, insolvency)
- `due_diligence_check` — automated red-flag scan with severity ratings
- `officer_network` — map a director's connections across all companies

**Extended** — `get_exemptions`, `get_uk_establishments`, `get_officer_disqualifications`, `get_filing_document`

Every tool returns formatted text for humans and structured JSON for agents.

## Output formats

| Flag | Output | Best for |
|------|--------|----------|
| (default) | Colour terminal formatting | Reading in the terminal |
| `--md` | Markdown | Saving to files, pasting into docs |
| `--json` | Raw JSON | Scripting, piping to `jq` |

## API key

The key is checked in this order:

1. `--key` flag — `ch profile 00445790 --key your-key`
2. `COMPANIES_HOUSE_API_KEY` environment variable
3. Config file — run `ch config set-key your-key` to save to `~/.config/companies-house/config.json`

Run `ch config show` to see which source is active and a masked preview of the key.

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
pnpm test:unit                             # no API key needed
pnpm test:integration                      # requires COMPANIES_HOUSE_API_KEY
```

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
