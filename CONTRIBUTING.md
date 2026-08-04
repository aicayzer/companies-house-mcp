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

Unit tests cover the API client, cache, rate limiter, pagination, tool registry, tool behaviour, MCP transports, formatters, the Worker and the documentation. Integration tests exercise representative tools, absent-record behaviour and a real document download against the live API.

`docs/tools.md` and `docs/public/llms.txt` are generated from the tool registry, and a unit test fails when they drift. After changing a tool's name, description or parameters:

```bash
UPDATE_DOCS=1 pnpm test:unit
```

The same test checks that the prose documentation mentions every tool and mentions no tool that does not exist. When it fails, the documentation is wrong, not the test.

## Project structure

```
packages/
  cli/      → companies-house-cli: API client, CLI, MCP factory and runner, 18 tools
  mcp/      → companies-house-mcp: thin wrapper that starts the shared MCP server
  worker/   → optional single-user Cloudflare Worker (private, not published)
```

All shared implementation lives in `packages/cli/src/`. The MCP package supplies its own identity and starts the transport-neutral server the CLI package exports. The Worker does the same over HTTP.

Code shared with the Worker has to stay runtime-neutral: web-standard APIs, no `Buffer`, and no static `node:` imports. Node-only work belongs in `server/index.ts`, `config.ts`, or behind a dynamic import.

## Making changes

- One logical change per PR
- Run `pnpm lint && pnpm typecheck && pnpm build && pnpm test:unit` before pushing
- Keep product language truthful: nothing may read as verification, a credit check, a sanctions screening or a clearance decision
- Follow the existing code style — TypeScript, ESM, snake_case for API types
- Add or update tests for non-trivial logic changes

## Submitting a PR

Open a pull request against `main`. CI runs lint, typecheck, build, and unit tests automatically. Integration tests run on pushes from within the repo (they require the `COMPANIES_HOUSE_API_KEY` secret).
