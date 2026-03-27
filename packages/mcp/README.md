# Companies House MCP

[![npm version](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![npm downloads](https://img.shields.io/npm/dw/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)
[![Node 22+](https://img.shields.io/node/v/companies-house-mcp?style=flat)](https://nodejs.org/)

MCP server for the [UK Companies House API](https://developer.company-information.service.gov.uk/). Connects Claude, Cursor, Zed, and other AI tools to live UK company data — 17 tools for search, profiles, officers, filings, ownership, charges, insolvency, and due diligence.

From v3.0.0 this package is a thin wrapper over [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli). Existing `npx -y companies-house-mcp` configs work unchanged.

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

## Tools

**Search**
- `search_companies` — search UK companies by name, status, type, SIC code, or location
- `search_officers` — search for company officers by name

**Company data**
- `get_company_profile` — status, registered addresses, SIC codes, accounts and confirmation statement dates
- `get_officers` — current and resigned directors, secretaries, and other officers
- `get_appointments` — all appointments held by a specific officer across all companies
- `get_ownership` — persons with significant control (PSCs) and corporate ownership
- `get_filings` — filing history with document metadata and download links
- `get_filing_document` — retrieve a specific filing document
- `get_charges` — charges and mortgages registered against the company
- `get_insolvency` — insolvency proceedings, liquidations, and administrations
- `get_company_registers` — statutory registers (members, directors, secretaries)

**Composite** — combine multiple API calls into a single response
- `company_report` — full overview: profile, officers, ownership, charges, filings, and insolvency
- `due_diligence_check` — automated red-flag scan with HIGH/MEDIUM/LOW severity ratings
- `officer_network` — map a director's connections across all associated UK companies

**Extended**
- `get_exemptions` — disclosure exemptions
- `get_uk_establishments` — UK establishments of overseas companies
- `get_officer_disqualifications` — disqualification orders against an officer

Every tool returns formatted text for humans and structured JSON for agents.

## What you can ask

Once connected, ask naturally:

- "Look up Tesco on Companies House"
- "Who are the directors of Anthropic Limited?"
- "Run a due diligence check on company 14604577"
- "Show me the filing history for BrewDog"
- "What other companies is this director involved with?"
- "Does this company have any outstanding charges?"
- "Map the ownership structure of this holding company"
- "Are there any insolvency proceedings against this company?"

## CLI

For terminal access without an AI assistant, install [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli):

```bash
npm install -g companies-house-cli
ch search "Anthropic"
ch report 14604577
```

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
