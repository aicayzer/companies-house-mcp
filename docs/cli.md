# CLI reference

The `ch` command reads the Companies House public register from your terminal.

## Install

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
```

Get a free key at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## Commands

Every MCP tool has a command. `ch <command> --help` prints the full flag list for that command, generated from the tool itself, so it is never out of date.

**Search**

```
ch search <query>                Find companies by name
ch search-officers <query>       Find officers by name across the register
```

**Company record**

```
ch profile <company-number>      Read a company record
ch charges <company-number>      List registered charges
ch insolvency <company-number>   Read the insolvency record
ch registers <company-number>    Show where statutory registers are held
ch exemptions <company-number>   List disclosure exemptions
ch establishments <company-number>
                                 List UK establishments of an overseas company
```

**Officers and ownership**

```
ch officers <company-number>     List company officers
ch appointments <officer-id>     List one officer's appointments
ch ownership <company-number>    List persons with significant control
ch disqualifications <officer-id>
                                 Check the disqualified directors register
```

**Filings and documents**

```
ch filings <company-number>      Read filing history
ch filing <company-number> <transaction-id>
                                 Read one filing in detail
ch document <document-id>        Download the document behind a filing
```

**Combined summaries**

```
ch report <company-number>       Read the main records for one company in one call
ch check <company-number>        Screen a company against the public register
ch network <officer-name>        Map an officer's appointments across companies
```

**Server and configuration**

```
ch serve                         Run the MCP server over stdio
ch serve --http --host 127.0.0.1 --port 3000
                                 Run it over Streamable HTTP
ch config set-key <key>          Save an API key
ch config show                   Show which key source is active, masked
ch config path                   Print the config file path
ch config clear                  Remove the saved key
ch tools                         List the MCP tools this build exposes
```

## Output

| Mode | Flag | Best for |
|------|------|----------|
| Terminal | (default) | Reading |
| Markdown | `--md` | Saving to a file or pasting into notes |
| JSON | `--json` | Scripting and `jq` |

## Global flags

| Flag | Effect |
|------|--------|
| `--key <key>` | Use this API key for one command |
| `--help`, `-h` | Show help. `ch <command> --help` for one command |
| `--version`, `-v` | Print the version |

Common per-command flags include `--limit` and `--start` for paging, `--all` on `ch officers` to include resigned officers, `--category` on `ch filings`, and `--out`, `--info` and `--format` on `ch document`. `ch <command> --help` lists them all.

## API key

Checked in this order:

1. `--key` for a single command
2. The `COMPANIES_HOUSE_API_KEY` environment variable
3. `~/.config/companies-house/config.json`, written with owner-only permissions by `ch config set-key`

`ch config show` prints only the last four characters of the key and which source it came from.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | The request failed — Companies House returned an error, or the network did |
| `2` | Bad usage — unknown command, unknown flag, missing or invalid argument |
| `3` | No API key configured |

## Examples

Find a company and read it:

```bash
ch search "BrewDog"
ch profile SC311560
```

Screen a company against the register:

```bash
ch check SC311560
```

See who is in post, then everywhere one of them is appointed:

```bash
ch officers 00445790
ch search-officers "Ken Murphy"
ch network --id <officer-id>
```

Find the accounts and download the document:

```bash
ch filings 14604577 --category accounts
ch document <document-id> --info
ch document <document-id> --out ./accounts.pdf
```

Script against the structured payload:

```bash
ch profile 00445790 --json | jq -r .company_status
ch officers 00445790 --json | jq -r '.items[].name'
ch check SC311560 --json | jq -r '.observations[] | "\(.severity)\t\(.detail)"'
```

Save a report:

```bash
ch report 00445790 --md > tesco.md
```

## Running the MCP server

`ch serve` starts the same MCP server the `companies-house-mcp` package ships. For AI assistant setup, use that package — see [MCP setup](/mcp). HTTP binds to `127.0.0.1` by default; any other binding requires `MCP_BEARER_TOKEN`.
