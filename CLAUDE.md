# Companies House MCP v2

## Project Overview
MCP server and CLI for the UK Companies House API. Provides 17 tools for company search, profiles, officers, filings, ownership, charges, insolvency, and composite operations (company reports, due diligence checks, officer network mapping).

## Architecture
- `src/api/` — HTTP client, rate limiter, cache, endpoint functions
- `src/api/endpoints/` — One file per API domain (company, search, officers, filing, charges, psc, insolvency, exemptions)
- `src/tools/` — MCP tool definitions (registry pattern with side-effect imports)
- `src/server/` — MCP server entry point (stdio + streamable HTTP)
- `src/cli/` — CLI entry point
- `src/formatters/` — Shared markdown formatters
- `src/types/` — TypeScript types matching Companies House API (snake_case)

## Build & Run
```bash
npm run build          # TypeScript compilation
npm run dev            # Build + run stdio server
npm start              # Run from dist/
npm run start:http     # Streamable HTTP mode
```

## Testing
```bash
npm test               # All tests (vitest)
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests (needs API key)
npm run test:coverage  # With coverage report
```

## Code Conventions
- ESM modules (`"type": "module"`)
- Types use snake_case matching the Companies House API
- All tools return `{ content, structuredContent }` — text for humans, JSON for agents
- Tools register via side-effect imports into a central registry
- Rate limiter queues requests (never throws on rate limit)
- Cache uses LRU with per-endpoint TTLs
- Native fetch (no Axios)
- Vitest for testing

## Environment
- `COMPANIES_HOUSE_API_KEY` — Required. Get from https://developer.company-information.service.gov.uk/

## Tool Registration Pattern
Tools self-register by calling `registerTool()` at module level. The server and CLI import these modules for side effects:
```typescript
import '../tools/search.js';  // registers search_companies, search_officers
```

## Important
- Never commit API keys
- Company numbers are 8-digit zero-padded strings (e.g., "00445790")
- The API returns 404 for valid companies with no data for certain endpoints (insolvency, charges) — handle gracefully
