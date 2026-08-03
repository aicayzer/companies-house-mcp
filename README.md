# Companies House CLI and MCP

[![npm: companies-house-cli](https://img.shields.io/npm/v/companies-house-cli?label=companies-house-cli&style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm: companies-house-mcp](https://img.shields.io/npm/v/companies-house-mcp?label=companies-house-mcp&style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)

Read the UK Companies House public register from your terminal, your scripts, or an AI assistant. Search companies, read their records, trace ownership, pull filings and download the filed documents themselves.

Everything runs on your own free API key. No hosted backend, no shared key, no proxy — requests go from your machine straight to Companies House.

**Documentation:** [companies-house.uk](https://companies-house.uk)

## Pick your route

**In an AI assistant** — Claude Code, Claude Desktop, Codex, Cursor, Zed:

```bash
npx -y companies-house-mcp
```

Set `COMPANIES_HOUSE_API_KEY` in the client's config. Full setup for each client: [companies-house.uk/mcp](https://companies-house.uk/mcp).

**In the terminal** — the `ch` command:

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
ch report 00445790
```

Full reference: [companies-house.uk/cli](https://companies-house.uk/cli).

**On your own server** — an optional Cloudflare Worker you deploy into your own account, so Claude Code can reach it remotely. See [packages/worker](./packages/worker/README.md).

Get a free API key at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/). It takes about a minute.

## What you can do

**Find a company** — `search_companies` / `ch search` by name, with filters for status, type, incorporation date, location and SIC code. `search_officers` / `ch search-officers` finds people across the whole register.

**Read its record** — `get_company_profile` / `ch profile` for status, addresses, SIC codes and filing dates. `get_charges`, `get_insolvency`, `get_company_registers`, `get_exemptions` and `get_uk_establishments` for the rest.

**Trace people and ownership** — `get_officers` / `ch officers` for who is in post, `get_appointments` and `officer_network` for everywhere one person is appointed, `get_ownership` / `ch ownership` for persons with significant control, and `get_officer_disqualifications` for the disqualified directors register.

**Read the filings** — `get_filings` / `ch filings` for the filing history, `get_filing_document` for one filing in detail, and `download_filing_document` / `ch document` for the filed PDF itself.

**Get the whole picture at once** — `company_report` / `ch report` reads the main records in a single call. `due_diligence_check` / `ch check` screens a company against the register and reports the entries a reviewer would want to look at.

Full parameter reference: [companies-house.uk/tools](https://companies-house.uk/tools).

## What this is not

Companies House records what companies file. It carries out basic completeness checks but does not verify that the information is accurate.

So nothing here is a verification, a credit check, a sanctions or politically-exposed-person screening, or a clearance decision. `due_diligence_check` is a screening summary: it tells you what is on the register and what it could not check. It never concludes that a company is sound. An absence of adverse entries means nothing adverse has been *filed*.

The register also does not cover trading performance, litigation, or beneficial ownership held outside the persons-with-significant-control regime. Identity verification for existing directors and PSCs is still being rolled out under the Economic Crime and Corporate Transparency Act, so a name on the register does not mean the person behind it has been identity-checked.

## Your key, your data

Your API key stays with you. The CLI reads it from `--key`, then `COMPANIES_HOUSE_API_KEY`, then `~/.config/companies-house/config.json`, which is written with owner-only permissions. `ch config show` prints only the last four characters.

Nothing is sent anywhere except Companies House. There is no telemetry.

Companies House allows 600 requests per five minutes per key. The client queues requests to stay inside that, and if it does hit the limit it waits only when Companies House says the window is about to reset — otherwise it reports the limit rather than stalling.

Officer records include service addresses and dates of birth as published on the public register. Treat them as the personal data they are.

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install && pnpm build && pnpm test:unit
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Disclaimer

Not affiliated with or endorsed by Companies House or the UK Government. Uses the public [Companies House API](https://developer.company-information.service.gov.uk/).

## Licence

MIT
