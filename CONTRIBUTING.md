# Contributing

## Setup

Requires Node.js ≥22 and pnpm.

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install
pnpm build
```

You'll need a free Companies House API key for integration tests — get one at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## Running tests

```bash
pnpm test:unit                                          # no API key needed
COMPANIES_HOUSE_API_KEY=your-key pnpm test:integration  # hits the live API
```

Unit tests cover the API client, cache, rate limiter, tool registry, MCP transports, and formatters. Integration tests exercise representative tools and empty-data behaviour against the real Companies House API.

## Project structure

```
packages/
  cli/   → companies-house-cli: API client, CLI, MCP factory and runner, 18 tools
  mcp/   → companies-house-mcp: thin wrapper that starts the shared MCP server
```

All shared implementation lives in `packages/cli/src/`. The MCP package supplies its own package identity and starts the transport-neutral server exported by the CLI package.

## Making changes

- One logical change per PR
- Run `pnpm lint && pnpm typecheck && pnpm test:unit` before pushing
- Follow the existing code style — TypeScript, ESM, snake_case for API types
- Add or update tests for non-trivial logic changes

## Submitting a PR

Open a pull request against `main`. CI runs lint, typecheck, build, and unit tests automatically. Integration tests run on pushes from within the repo (they require the `COMPANIES_HOUSE_API_KEY` secret).
