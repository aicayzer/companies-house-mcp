# Companies House CLI & MCP

[![npm: companies-house-cli](https://img.shields.io/npm/v/companies-house-cli?label=companies-house-cli&style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm: companies-house-mcp](https://img.shields.io/npm/v/companies-house-mcp?label=companies-house-mcp&style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)

An unofficial CLI and MCP server for the [UK Companies House API](https://developer.company-information.service.gov.uk/). Look up any UK company, check its officers, trace ownership, dig into filings, run a due diligence scan — from your terminal, your scripts, or directly inside Claude, Cursor, or any other AI tool that speaks MCP.

Everything runs on a free API key. No backend, no subscriptions, no middleman.

## Install

**CLI** — installs the `ch` binary:

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
```

**MCP server** — for Claude, Cursor, Zed, and others:

```bash
npx -y companies-house-mcp
```

Both packages use the same free API key from [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## What it can do

**Search and lookup**
- `search_companies` / `ch search` — find companies by name, with filters for status, type, SIC code, and location
- `search_officers` / `ch search-officers` — find officers across all companies by name
- `get_company_profile` / `ch profile` — full company profile: status, addresses, SIC codes, key dates

**Officers and ownership**
- `get_officers` / `ch officers` — current and resigned directors, secretaries, and other officers
- `get_appointments` — every company a given officer has ever been appointed to
- `get_ownership` / `ch ownership` — persons with significant control (PSCs), corporate ownership chains

**Filings and financials**
- `get_filings` / `ch filings` — full filing history with document links, filterable by category
- `get_filing_document` — retrieve an individual filing document
- `get_charges` / `ch charges` — charges and mortgages registered against the company
- `get_insolvency` / `ch insolvency` — insolvency proceedings, liquidations, administrations

**Due diligence**
- `company_report` / `ch report` — everything in one call: profile, officers, ownership, charges, filings, insolvency
- `due_diligence_check` / `ch check` — automated red-flag scan with HIGH / MEDIUM / LOW severity ratings
- `officer_network` / `ch network` — map a director's connections across every company they're linked to

**Extended**
- `get_company_registers` — statutory registers (members, directors, secretaries, charges)
- `get_exemptions` — disclosure exemptions
- `get_uk_establishments` — UK establishments of overseas companies
- `get_officer_disqualifications` — disqualification orders made against an officer

## CLI quick reference

```
ch search "Anthropic"
ch profile 14604577
ch officers 14604577 --all
ch ownership 14604577
ch filings 14604577 --category accounts
ch charges 14604577
ch report 14604577
ch check 14604577
ch network "John Smith"
ch report 14604577 --json | jq '.profile.company_status'
ch report 14604577 --md > report.md
```

Full reference, flags, and output modes in [`packages/cli`](./packages/cli/README.md).

## MCP setup

Add to your client config with your API key and run `npx -y companies-house-mcp`. Detailed setup for Claude Desktop, Claude Code, Cursor, and Zed in [`packages/mcp`](./packages/mcp/README.md).

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install && pnpm build && pnpm test:unit
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the publicly available [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
