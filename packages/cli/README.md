# Companies House CLI

[![npm version](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm downloads](https://img.shields.io/npm/dw/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)
[![Node 22+](https://img.shields.io/node/v/companies-house-cli?style=flat)](https://nodejs.org/)

Terminal tool for the [UK Companies House API](https://developer.company-information.service.gov.uk/). Look up companies, check who runs them, trace ownership, scrutinise filings, and run due diligence checks — directly from your terminal.

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, takes about 30 seconds.

## Install

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
ch search "Anthropic"
```

## Commands

```
ch search <query>               Search companies by name
ch profile <company-number>     Company profile and status
ch officers <company-number>    Current officers (directors, secretaries)
ch ownership <company-number>   Persons with significant control (PSCs)
ch filings <company-number>     Filing history
ch charges <company-number>     Charges and mortgages
ch insolvency <company-number>  Insolvency proceedings
ch report <company-number>      Full overview in one call
ch check <company-number>       Due diligence red-flag scan
ch network <officer-name>       All companies an officer is connected to
ch search-officers <query>      Search for officers by name
ch config set-key <key>         Save API key
ch config show                  Show current key source
ch serve                        Start MCP server (stdio)
ch serve --http --port 3000     Start MCP server (HTTP)
```

Company numbers are 8-digit strings, zero-padded: `00445790`, `14604577`. Scottish companies use an `SC` prefix (`SC123456`).

## Flags

| Flag | Effect |
|------|--------|
| `--json` | Raw JSON — pipe-friendly, use with `jq` |
| `--md` | Markdown — good for saving to files or notes |
| `--key <key>` | Override API key for this call only |
| `--all` | Include resigned officers (`ch officers` only) |
| `--category <cat>` | Filter filings by category (`ch filings` only) |
| `--status <status>` | Filter search by company status |
| `--type <type>` | Filter search by company type |
| `--sic <code>` | Filter search by SIC code |
| `--location <loc>` | Filter search by registered location |
| `--limit <n>` | Results per page |
| `--id <officer-id>` | Look up officer network by ID (`ch network` only) |

## Output modes

| Mode | Flag | Best for |
|------|------|----------|
| Terminal | (default) | Colour-formatted, human-readable |
| Markdown | `--md` | Saving to files, pasting into notes |
| JSON | `--json` | Scripting, piping to `jq` |

## API key

Checked in this order:

1. `--key` flag — one-off override
2. `COMPANIES_HOUSE_API_KEY` environment variable
3. Config file — run `ch config set-key your-key` to save to `~/.config/companies-house/config.json`

Run `ch config show` to see which source is active.

## MCP server

This package also ships an MCP server. Running `ch serve` starts it in stdio mode, which is how `companies-house-mcp` uses it internally. For AI assistant setup (Claude, Cursor, Zed), use the dedicated [`companies-house-mcp`](https://www.npmjs.com/package/companies-house-mcp) package — it handles all the wiring.

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
pnpm test:unit                   # no API key needed
pnpm test:integration            # requires COMPANIES_HOUSE_API_KEY
```

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
