# CLI reference

## Install

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
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
ch config set-key <key>         Save API key to config file
ch config show                  Show current key source
ch serve                        Start MCP server (stdio)
ch serve --http --port 3000     Start MCP server (HTTP)
```

## Flags

| Flag | Applies to | Effect |
|------|-----------|--------|
| `--json` | All commands | Raw JSON output — pipe-friendly, use with `jq` |
| `--md` | All commands | Markdown output — save to files or notes |
| `--key <key>` | All commands | Override API key for this call only |
| `--all` | `ch officers` | Include resigned officers |
| `--category <cat>` | `ch filings` | Filter by category (e.g. `accounts`, `confirmation-statement`) |
| `--status <status>` | `ch search` | Filter by company status (`active`, `dissolved`, etc.) |
| `--type <type>` | `ch search` | Filter by company type (`ltd`, `plc`, `llp`, etc.) |
| `--sic <code>` | `ch search` | Filter by SIC code |
| `--location <loc>` | `ch search` | Filter by registered location |
| `--limit <n>` | `ch search`, `ch officers`, `ch filings` | Results per page |
| `--id <officer-id>` | `ch network` | Look up by officer ID instead of name |

## Output modes

| Mode | Flag | Best for |
|------|------|----------|
| Terminal | (default) | Colour-formatted, human-readable |
| Markdown | `--md` | Saving to files, pasting into notes |
| JSON | `--json` | Scripting, piping to `jq` |

## API key

Checked in this order:

1. `--key` flag — one-off override for a single call
2. `COMPANIES_HOUSE_API_KEY` environment variable
3. Config file — run `ch config set-key your-key` to save to `~/.config/companies-house/config.json`

Run `ch config show` to see which source is active.

## Examples

```bash
# Find a company and get its number
ch search "BrewDog"

# Full profile
ch profile 07670541

# All officers, including resigned
ch officers 07670541 --all

# Ownership (PSCs)
ch ownership 07670541

# Accounts filings only
ch filings 07670541 --category accounts

# Outstanding charges
ch charges 07670541

# Full report: profile + officers + ownership + charges + filings + insolvency
ch report 07670541

# Due diligence scan
ch check 07670541

# Director network
ch network "James Watt"

# Pipe JSON to jq
ch report 07670541 --json | jq '.profile.company_status'

# Save as Markdown
ch report 07670541 --md > brewdog-report.md
```

## MCP server

This package also ships an MCP server. `ch serve` starts it in stdio mode. For AI assistant setup (Claude, Cursor, Zed), use [`companies-house-mcp`](https://www.npmjs.com/package/companies-house-mcp) — it handles all the wiring. See [MCP setup →](/mcp).
