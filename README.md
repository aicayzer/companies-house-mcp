# Companies House MCP

MCP server and CLI for the UK Companies House API. 17 tools for company search, profiles, officers, filings, ownership, charges, insolvency, and composite operations.

## What's Different

- **Composite tools** — `company_report` (one call gets everything), `due_diligence_check` (automated red-flag scan), `officer_network` (map a director's connections)
- **Structured outputs** — every tool returns formatted text AND typed JSON
- **Tool annotations** — read-only, idempotent, non-destructive hints for MCP clients
- **CLI** — `ch search "Anthropic"`, `ch report 13861484`, `ch check 13861484`
- **Claude Code skill** — domain expertise for UK company research
- **Rate limiter that queues** — never throws on rate limit, just waits

## Quick Start

```bash
# Set your API key
export COMPANIES_HOUSE_API_KEY=your-key-here

# MCP server (stdio — for Claude Desktop, Claude Code, Cursor, etc.)
npx companies-house-mcp

# MCP server (HTTP — for remote deployment)
npx companies-house-mcp --http --port 3000

# CLI
npx companies-house-mcp search "Anthropic"
npx companies-house-mcp report 13861484
```

Get an API key at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## Tools (17)

### Core (10)

| Tool | Description |
|------|-------------|
| `search_companies` | Search by name with optional filters (status, type, SIC, location, date) |
| `search_officers` | Find officers by name across all companies |
| `get_company_profile` | Full profile: status, type, address, SIC codes, accounts, previous names |
| `get_officers` | Company officers (active by default, optionally include resigned) |
| `get_appointments` | All appointments for a specific officer across companies |
| `get_ownership` | PSCs — who owns/controls the company, with plain-English control descriptions |
| `get_filings` | Filing history with category filtering |
| `get_charges` | Charges/mortgages (outstanding and satisfied) |
| `get_insolvency` | Insolvency proceedings, practitioners, dates |
| `get_company_registers` | Where statutory registers are held |

### Composite (3)

| Tool | Description |
|------|-------------|
| `company_report` | Full report in one call: profile + officers + PSCs + charges + filings + insolvency |
| `due_diligence_check` | Automated red-flag scan with severity levels |
| `officer_network` | Map an officer's company connections (by name or ID) |

### Extended (4)

| Tool | Description |
|------|-------------|
| `get_exemptions` | Company filing exemptions |
| `get_uk_establishments` | UK branches of overseas companies |
| `get_officer_disqualifications` | Check if an officer is disqualified |
| `get_filing_document` | Specific filing document metadata |

## Integration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "npx",
      "args": ["companies-house-mcp"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Claude Code

The server auto-discovers via `npx`. Set the env var and it's available.

A Claude Code skill is included at `.claude/skills/companies-house/SKILL.md` with domain expertise for UK company research — company number formats, SIC code interpretation, due diligence workflows, and recommended tool sequences.

## CLI

```bash
ch search "Anthropic"                     # Search companies
ch search --status active --sic 62011     # Advanced search
ch profile 13861484                       # Company profile
ch officers 13861484                      # Active officers
ch officers 13861484 --all                # Include resigned
ch ownership 13861484                     # PSCs
ch filings 13861484 --category accounts   # Filtered filings
ch charges 13861484                       # Charges
ch insolvency 13861484                    # Insolvency
ch report 13861484                        # Full report
ch check 13861484                         # Due diligence scan
ch network "John Smith"                   # Officer network
ch search-officers "Smith"                # Officer search
ch profile 13861484 --json                # JSON output (pipe-friendly)
ch serve                                  # Start MCP server (stdio)
ch serve --http                           # Start MCP server (HTTP)
```

## Development

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests (needs API key)
npm run test:coverage       # Coverage report
```

## Architecture

```
src/
├── api/                    # HTTP client, rate limiter, cache
│   ├── client.ts           # Single API client (native fetch, auth, retry)
│   ├── rate-limiter.ts     # Token bucket (600 req/5min, queues when exhausted)
│   ├── cache.ts            # LRU cache with per-endpoint TTLs
│   └── endpoints/          # One file per API domain
├── tools/                  # MCP tool definitions (self-registering)
│   ├── registry.ts         # Tool registration and dispatch
│   ├── composite.ts        # company_report, due_diligence_check, officer_network
│   └── ...                 # search, company, officers, ownership, filings, financial, extended
├── server/                 # MCP server (stdio + streamable HTTP)
├── cli/                    # Terminal interface
├── formatters/             # Shared markdown formatting
└── types/                  # TypeScript types (snake_case matching CH API)
```

## Disclaimer

This project is not affiliated with or endorsed by Companies House or the UK Government. It uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## License

MIT
