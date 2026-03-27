# Companies House CLI & MCP

Search UK companies, check who runs them, trace ownership, scrutinise filings, and run due diligence checks — from your terminal or any AI assistant.

Built on the free [Companies House API](https://developer.company-information.service.gov.uk/). Two packages, one repo.

---

## For terminal users → [`companies-house-cli`](./packages/cli)

[![npm](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli)

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
ch search "Anthropic"
ch report 14604577
ch check 14604577
```

11 commands. Three output modes: colour terminal (default), `--md` for markdown, `--json` for scripting. Full reference in [`packages/cli`](./packages/cli/README.md).

## For AI assistants → [`companies-house-mcp`](./packages/mcp)

[![npm](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp)

```bash
npx -y companies-house-mcp
```

MCP server with 17 tools. Works with Claude Desktop, Claude Code, Cursor, Zed, and anything else that speaks MCP. Setup instructions for each client in [`packages/mcp`](./packages/mcp/README.md).

---

## What's available

17 tools across four groups:

- **Search** — companies by name, status, type, SIC code, or location; officers by name
- **Company data** — profile, officers, ownership (PSCs), filings, charges, insolvency, registers
- **Composite** — full company report, due diligence red-flag scan, officer network map
- **Extended** — exemptions, UK establishments of overseas companies, disqualification orders

Every tool returns formatted text for humans and structured JSON for agents.

## API key

Both packages use the same key. Register free at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/) — takes about 30 seconds.

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install && pnpm build && pnpm test:unit
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup guide.

## Licence

MIT — not affiliated with or endorsed by Companies House or the UK Government.
