# companies-house

Monorepo for the UK Companies House API toolkit.

| Package | Description |
|---------|-------------|
| [`companies-house-cli`](./packages/cli) [![npm](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli) | CLI (`ch` binary) — search, profile, officers, filings, and due diligence from the terminal |
| [`companies-house-mcp`](./packages/mcp) [![npm](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp) | MCP server for Claude, Cursor, Zed, and other AI tools |

Both packages use the free [Companies House API](https://developer.company-information.service.gov.uk/).

## Development

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
```

Requires Node.js ≥22 and pnpm. See [`packages/cli`](./packages/cli/README.md) and [`packages/mcp`](./packages/mcp/README.md) for full documentation.

## Licence

MIT
