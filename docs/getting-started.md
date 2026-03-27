# Getting started

## Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — free, takes about 30 seconds. You'll need the key for both the CLI and the MCP server.

## CLI

Install the `ch` binary globally:

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
```

Test it:

```bash
ch search "Anthropic"
ch profile 14604577
ch report 14604577
```

Full CLI reference in [CLI →](/cli).

## MCP server

The MCP server connects AI assistants (Claude, Cursor, Zed) to live Companies House data.

The quickest setup — add this to your client's config:

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "npx",
      "args": ["-y", "companies-house-mcp"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your-key-here"
      }
    }
  }
}
```

Client-specific instructions in [MCP setup →](/mcp).

## Company numbers

Companies House identifies companies by number — an 8-digit, zero-padded string:

- `14604577` — Anthropic Ltd
- `00445790` — Marks and Spencer
- `SC123456` — Scottish companies use the `SC` prefix

If you only know the company name, use `ch search` or the `search_companies` tool to find the number first.
