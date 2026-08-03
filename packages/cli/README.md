# Companies House CLI

[![npm version](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm downloads](https://img.shields.io/npm/dw/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)
[![Node 22+](https://img.shields.io/node/v/companies-house-cli?style=flat)](https://nodejs.org/)

Read the [UK Companies House public register](https://developer.company-information.service.gov.uk/) from your terminal. Search companies, read their records, trace officers and ownership, pull filings and download the filed documents.

Runs on your own free API key. Nothing is sent anywhere except Companies House.

**Full docs:** [companies-house.uk](https://companies-house.uk)

## Install

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
ch report 00445790
```

Get a free key at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## Commands

```
ch search <query>                Find companies by name
ch search-officers <query>       Find officers by name across the register

ch profile <company-number>      Read a company record
ch charges <company-number>      List registered charges
ch insolvency <company-number>   Read the insolvency record
ch registers <company-number>    Show where statutory registers are held
ch exemptions <company-number>   List disclosure exemptions
ch establishments <company-number>   UK establishments of an overseas company

ch officers <company-number>     List company officers
ch appointments <officer-id>     List one officer's appointments
ch ownership <company-number>    List persons with significant control
ch disqualifications <officer-id>    Check the disqualified directors register

ch filings <company-number>      Read filing history
ch filing <company-number> <transaction-id>   Read one filing in detail
ch document <document-id>        Download the document behind a filing

ch report <company-number>       Read the main records in one call
ch check <company-number>        Screen a company against the public register
ch network <officer-name>        Map an officer's appointments across companies

ch serve                         Run the MCP server (stdio, or --http)
ch config <set-key|show|path|clear>   Manage the saved API key
ch tools                         List the MCP tools this build exposes
```

`ch <command> --help` prints that command's full flag list, generated from the tool it calls.

Company numbers are eight characters, zero-padded: `00445790`. Scottish companies use `SC`, Northern Irish `NI`, LLPs `OC`, overseas companies `FC`. Shorter all-digit numbers are padded automatically.

## Output

| Mode | Flag | Best for |
|------|------|----------|
| Terminal | (default) | Reading |
| Markdown | `--md` | Files and notes |
| JSON | `--json` | Scripting and `jq` |

## API key

Checked in this order:

1. `--key <key>` for a single command
2. The `COMPANIES_HOUSE_API_KEY` environment variable
3. `~/.config/companies-house/config.json`, written with owner-only permissions by `ch config set-key`

`ch config show` prints only the last four characters and the source.

## Exit codes

`0` success, `1` the request failed, `2` bad usage, `3` no API key configured.

## What the register does not tell you

Companies House records what companies file. It carries out basic completeness checks but does not verify the information is accurate.

`ch check` is a screening summary of what is on the register, not a verdict. It reports the entries a reviewer would want to look at, the checks it ran, and the checks it could not run. It never concludes that a company is sound. Nothing here is a verification, a credit check, a sanctions or politically-exposed-person screening, or a clearance decision.

## MCP server

This package also ships the MCP server that [`companies-house-mcp`](https://www.npmjs.com/package/companies-house-mcp) wraps. `ch serve` starts it over stdio. For AI assistant setup, use that package — see [companies-house.uk/mcp](https://companies-house.uk/mcp).

HTTP binds to `127.0.0.1` by default and needs no token there. Binding anywhere else requires `MCP_BEARER_TOKEN`; the server refuses to start without it.

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

Not affiliated with or endorsed by Companies House or the UK Government. Uses the public [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
