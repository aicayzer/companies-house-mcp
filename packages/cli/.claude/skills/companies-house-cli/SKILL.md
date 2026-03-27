---
name: companies-house-cli
description: Help users work with the ch CLI for UK Companies House data. Use when the user wants to run ch commands, query Companies House from the terminal, pipe output, or script with the JSON output.
---

You have access to the `ch` CLI from the `companies-house-cli` package. Use it to help users query UK company data directly from the terminal.

## Commands

```
ch search <query>              Search companies by name
ch profile <company-number>    Company profile and status
ch officers <company-number>   Current officers (directors, secretaries)
ch ownership <company-number>  Persons with significant control (PSCs)
ch filings <company-number>    Filing history
ch charges <company-number>    Charges and mortgages
ch insolvency <company-number> Insolvency proceedings
ch report <company-number>     Full overview in one call (recommended starting point)
ch check <company-number>      Due diligence red-flag scan
ch network <officer-name>      All companies an officer is/was connected to
ch search-officers <query>     Search for officers by name
ch config set-key <key>        Save API key to ~/.config/companies-house/config.json
ch config show                 Show current key source
ch serve                       Start MCP server in stdio mode
ch serve --http --port 3000    Start MCP server in HTTP mode
```

## Flags

| Flag | Effect |
|------|--------|
| `--json` | Raw JSON — use for scripting and piping to `jq` |
| `--md` | Markdown — use for saving to files or pasting into notes |
| `--key <key>` | Override API key for this call only |
| `--all` | Include resigned officers (`ch officers` only) |
| `--category <cat>` | Filter filings by category (`ch filings` only) |
| `--status <status>` | Filter search by company status |
| `--sic <code>` | Filter search by SIC code |
| `--location <loc>` | Filter search by registered location |
| `--limit <n>` | Results per page |
| `--id <officer-id>` | Look up officer network by ID instead of name |

## Common workflows

**Find a company and get its full picture:**
```bash
ch search "BrewDog"
ch report 00007064
```

**Check if a director has other company connections:**
```bash
ch network "James Watt"
# or if you have an officer ID from ch officers output:
ch network --id abc123xyz
```

**Due diligence on a supplier:**
```bash
ch check 14604577
```

**Get all resigned officers (board history):**
```bash
ch officers 14604577 --all
```

**Extract data for scripting:**
```bash
ch profile 14604577 --json | jq '.company_status'
ch officers 14604577 --json | jq '[.officers[] | select(.resigned_on == null) | .name]'
```

**Save a report to a markdown file:**
```bash
ch report 14604577 --md > tesco-report.md
```

**Filter filings to accounts only:**
```bash
ch filings 14604577 --category accounts
```

## API key setup

Three sources in priority order:
1. `--key` flag (one-off override)
2. `COMPANIES_HOUSE_API_KEY` environment variable
3. Config file: `ch config set-key your-key` saves to `~/.config/companies-house/config.json`

Run `ch config show` to check which source is active.

## Company number formats

- **Standard:** 8 digits, zero-padded: `00445790`, `14604577`
- **Scotland:** `SC` prefix: `SC123456`
- **Northern Ireland:** `NI` prefix: `NI012345`
- **LLP:** `OC` prefix: `OC301234`

Always zero-pad to 8 digits when needed (e.g., `445790` → `00445790`).

## Output

Default output is colour-formatted for the terminal. Switch to `--json` for machine-readable output or `--md` when the result will be read in a markdown context.

When helping a user pipe or script with `ch --json`, suggest `jq` for filtering. The JSON structure matches the Companies House API response shapes directly.
