---
name: companies-house-cli
description: Help users work with the ch CLI for the UK Companies House public register. Use when the user wants to run ch commands, query Companies House from the terminal, pipe its output, or script against its JSON.
---

You have the `ch` CLI from the `companies-house-cli` package. Use it to read the UK Companies House public register from the terminal.

Run `ch --help` for the command list and `ch <command> --help` for one command's flags. That help is generated from the tools themselves, so prefer it over anything remembered.

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

## Flags

| Flag | Effect |
|------|--------|
| `--json` | The structured payload. Use for scripting and `jq` |
| `--md` | Markdown. Use for files and notes |
| `--key <key>` | Use a specific API key for one command |
| `--limit <n>`, `--start <n>` | Page size and offset, where the command supports paging |
| `--all` | Include resigned officers (`ch officers`) |
| `--category <cat>` | Filter filings (`ch filings`) |
| `--status`, `--type`, `--sic`, `--location` | Narrow a search (`ch search`) |
| `--id <officer-id>` | Use an officer id instead of a name (`ch network`) |
| `--info`, `--out <path>`, `--format <fmt>` | Inspect, save, or choose a format (`ch document`) |

## Common workflows

**Find a company, then read it:**

```bash
ch search "BrewDog"
ch profile SC311560
```

**Screen a company against the register:**

```bash
ch check SC311560
```

**Board history:**

```bash
ch officers 00445790 --all
```

**Follow one person across companies.** Search first: names are not unique, and `ch network` refuses to guess between matches.

```bash
ch search-officers "Ken Murphy"
ch network --id <officer-id>
```

**Get a filed document.** Check its size and formats before pulling it:

```bash
ch filings 14604577 --category accounts
ch document <document-id> --info
ch document <document-id> --out ./accounts.pdf
```

**Script against the JSON:**

```bash
ch profile 00445790 --json | jq -r .company_status
ch officers 00445790 --json | jq -r '.items[].name'
ch check SC311560 --json | jq -r '.observations[] | "\(.severity)\t\(.detail)"'
```

The JSON follows the Companies House response shapes, with a few added fields such as `charge_counts`, `coverage` and, for `ch check`, `observations` and `checks_performed`.

## API key

Three sources, highest priority first:

1. `--key <key>`
2. `COMPANIES_HOUSE_API_KEY`
3. `~/.config/companies-house/config.json` via `ch config set-key`

`ch config show` reports the source and only the last four characters. Never echo a full key into a terminal the user might share.

## Company numbers

Eight characters, zero-padded: `00445790`. Scotland `SC`, Northern Ireland `NI`, LLPs `OC`, overseas `FC`. Shorter all-digit numbers are padded automatically, so `445790` works.

## Exit codes

`0` success, `1` the request failed, `2` bad usage, `3` no API key configured. Branch on these in scripts rather than parsing output.

## Reporting results honestly

Companies House records what companies file and does not verify it is accurate.

`ch check` is a screening summary, not a verdict. When you relay it, say what is on the register and what was not checked. Never describe a company as clear, sound, in good standing, low risk or verified. An absence of adverse entries means only that nothing adverse has been filed.

Also worth carrying into any summary:

- Ceased PSCs stay in the ownership list. Check the ceased marker before calling someone a current controller.
- An empty PSC register often has an explanation — a market-listing exemption, or a filed statement. `ch ownership` says which.
- A registered charge shows security was granted. It says nothing about the balance owed.
- Every list says where it stops. If it is a partial view, say so rather than presenting it as complete.
