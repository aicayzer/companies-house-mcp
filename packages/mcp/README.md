# Companies House MCP

[![npm version](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![npm downloads](https://img.shields.io/npm/dw/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)
[![Node 22+](https://img.shields.io/node/v/companies-house-mcp?style=flat)](https://nodejs.org/)

An MCP server for the [UK Companies House public register](https://developer.company-information.service.gov.uk/). Connects Claude Code, Claude Desktop, Codex, Cursor, Zed and other MCP clients to 18 tools for company search, company records, officers, ownership, filings and filed documents.

Runs on your own free API key. There is no hosted backend and no shared key.

**Full docs:** [companies-house.uk](https://companies-house.uk)

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, about a minute. The server uses your key directly and sends nothing anywhere else.

## Setup

### Claude Code

```bash
claude mcp add companies-house -e COMPANIES_HOUSE_API_KEY=your-key-here -- npx -y companies-house-mcp
```

### Claude Desktop

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

<details>
<summary>Codex</summary>

```bash
codex mcp add companies-house --env COMPANIES_HOUSE_API_KEY=your-key-here -- npx -y companies-house-mcp
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

**Search** — `search_companies`, `search_officers`

**Company record** — `get_company_profile`, `get_charges`, `get_insolvency`, `get_company_registers`, `get_exemptions`, `get_uk_establishments`

**Officers and ownership** — `get_officers`, `get_appointments`, `get_ownership`, `get_officer_disqualifications`

**Filings and documents** — `get_filings`, `get_filing_document`, `download_filing_document`

**Combined summaries** — `company_report`, `due_diligence_check`, `officer_network`

Every tool returns readable text alongside a structured payload, and every list says where you are in it and how to ask for the next page. Full parameter reference at [companies-house.uk/tools](https://companies-house.uk/tools).

## What you can ask

- "Look up Tesco on Companies House"
- "Who are the current directors of company 14604577?"
- "What does the register say about company SC311560?"
- "What other companies is this director appointed to?"
- "Does this company have outstanding charges?"
- "Who controls this company?"
- "Download the latest confirmation statement for company 14604577"

## What the register does not tell you

Companies House records what companies file. It carries out basic completeness checks but does not verify the information is accurate.

`due_diligence_check` is a screening summary of what is on the register, not a verdict. It reports the entries a reviewer would want to look at, the checks it ran, and the checks it could not run. It never concludes that a company is sound, and an absence of adverse entries only means nothing adverse has been filed.

Nothing here is a verification, a credit check, a sanctions or politically-exposed-person screening, or a clearance decision. The register does not cover trading performance, litigation, or beneficial ownership held outside the persons-with-significant-control regime. Identity verification for existing directors and PSCs is still being rolled out under the Economic Crime and Corporate Transparency Act.

## Running over HTTP

Stdio is the default and the right choice for local clients. Streamable HTTP is available for local development and for a server you deploy yourself:

```bash
COMPANIES_HOUSE_API_KEY=your-key npx -y companies-house-mcp --http
```

That binds to `127.0.0.1:3000`, where no token is needed. Binding anywhere else requires `MCP_BEARER_TOKEN`; the server refuses to start without it.

For a remote server, deploy the [Cloudflare Worker](https://github.com/aicayzer/companies-house-mcp/tree/main/packages/worker) into your own account. Claude Code, Cursor and VS Code can connect to it with a bearer token. Claude.ai and Claude Desktop custom connectors cannot: their generally available authentication is OAuth, which this project does not implement.

## CLI

For terminal use without an assistant, install [`companies-house-cli`](https://www.npmjs.com/package/companies-house-cli):

```bash
npm install -g companies-house-cli
ch report 00445790
```

From v3.0.0 this package is a thin wrapper over that one. Existing `npx -y companies-house-mcp` configs work unchanged.

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the public [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
