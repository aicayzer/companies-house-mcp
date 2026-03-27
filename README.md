# Companies House CLI & MCP

Tools for the [UK Companies House API](https://developer.company-information.service.gov.uk/). Search companies, check officers, trace ownership, scrutinise filings, and run due diligence — from the terminal or any AI assistant.

Two packages, one repo:

| Package | Install | What it does |
|---------|---------|--------------|
| [`companies-house-cli`](./packages/cli) [![npm](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli) | `npm install -g companies-house-cli` | `ch` binary — full terminal CLI with 11 commands and three output modes |
| [`companies-house-mcp`](./packages/mcp) [![npm](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp) | `npx -y companies-house-mcp` | MCP server — connects Claude, Cursor, Zed, and other AI tools to live company data |

Both require a free API key from [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## What's available

17 tools across four groups:

- **Search** — find companies by name, status, type, SIC code, or location; find officers by name
- **Company data** — profile, officers, ownership (PSCs), filing history, charges, insolvency, statutory registers
- **Composite** — `company_report` (full overview in one call), `due_diligence_check` (automated red-flag scan), `officer_network` (map a director's connections across all their companies)
- **Extended** — exemptions, UK establishments, officer disqualifications, individual filing documents

## Packages

Full documentation is in each package's README:

- [`packages/cli`](./packages/cli/README.md) — CLI reference, commands, flags, output modes
- [`packages/mcp`](./packages/mcp/README.md) — MCP setup for Claude Desktop, Claude Code, Cursor, and Zed

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
pnpm test:unit
```

Requires Node.js ≥22 and pnpm. See [CONTRIBUTING.md](./CONTRIBUTING.md) for more.

## Licence

MIT
