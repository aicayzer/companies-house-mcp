# companies-house

Monorepo for the UK Companies House API toolkit.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`companies-house-cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/companies-house-cli?style=flat)](https://www.npmjs.com/package/companies-house-cli) | CLI and MCP server — the primary package |
| [`companies-house-mcp`](./packages/mcp) | [![npm](https://img.shields.io/npm/v/companies-house-mcp?style=flat)](https://www.npmjs.com/package/companies-house-mcp) | MCP server wrapper for AI tool integration |

**Install the CLI** for terminal access:
```bash
npm install -g companies-house-cli
ch search "Anthropic"
```

**Install the MCP server** for AI assistants (Claude, Cursor, Windsurf, Zed):
```bash
npx -y companies-house-mcp
```

Full documentation is in each package's README: [`packages/cli`](./packages/cli/README.md) · [`packages/mcp`](./packages/mcp/README.md)

## Development

```bash
pnpm install
pnpm build
pnpm test:unit
```

Requires Node.js ≥22 and pnpm.

## Licence

MIT
