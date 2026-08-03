# Getting started

## 1. Get an API key

Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/). It is free and takes about a minute.

You will need the key for everything below. Nobody else's key will do — this project has no shared key and no hosted backend.

## 2. Choose how you want to use it

### In an AI assistant

Add the MCP server to your client's config. For Claude Code:

```bash
claude mcp add companies-house -e COMPANIES_HOUSE_API_KEY=your-key-here -- npx -y companies-house-mcp
```

Then ask it something:

> Look up Tesco on Companies House and tell me who the current directors are.

Setup for Claude Desktop, Codex, Cursor and Zed is in [MCP setup](/mcp).

### In the terminal

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
```

Try it:

```bash
ch search "Tesco"
ch profile 00445790
ch report 00445790
```

The [CLI reference](/cli) has every command.

### On your own server

If you want a remote MCP server that Claude Code can reach from anywhere, deploy the Cloudflare Worker into your own account. It uses your key and a bearer token you choose. See the [Worker guide](https://github.com/aicayzer/companies-house-mcp/tree/main/packages/worker).

## 3. Know what you are reading

Companies numbers are eight characters, zero-padded:

- `00445790` — Tesco PLC
- `14604577` — Anthropic Limited
- `SC311560` — a Scottish company
- `NI012345` — Northern Ireland, `OC301234` — an LLP, `FC012345` — an overseas company

Shorter all-digit numbers are padded for you, so `445790` works. If you only know the name, search first.

Companies House records what companies file. It does not verify that what they filed is true. That shapes everything these tools can tell you — see [what the register does not tell you](/tools#what-the-register-does-not-tell-you).
