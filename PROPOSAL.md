# Companies House MCP v2: The Definitive Rebuild

## What This Is

A complete rewrite of `companies-house-mcp` — same repo, same npm package, new everything. The goal is simple: **the best Companies House tool that exists.** Not a thin API wrapper. A tool that's genuinely good to use — for humans in a terminal, for agents via MCP, and for Claude Code via skills.

One package, three interfaces:
```
npx companies-house-mcp              # MCP server (stdio, default)
npx companies-house-mcp --http       # MCP server (streamable HTTP)
ch search "Anthropic"                # CLI
ch report 13861484                   # CLI composite command
# + Claude Code skill for guided UK company research
```

---

## Why Rewrite

The v1 codebase works, but it has structural issues that make evolution painful:

- SDK is on 1.12.1; current is 1.27.1 with structured outputs, tool annotations, streamable HTTP
- No composite tools (the feature that would actually differentiate this)
- CLI is just a server launcher — no direct terminal commands
- No structured outputs, no tool annotations
- Types use mixed casing conventions
- Tool pattern creates tight coupling between tool classes and client instantiation

The MCP ecosystem has moved significantly since v1. Patching won't get us where we need to be.

---

## Architecture

```
companies-house-mcp/
├── src/
│   ├── cli/                        # CLI entry point
│   │   ├── index.ts                # Command router
│   │   └── formatters.ts           # Terminal tables, colours
│   ├── server/                     # MCP server entry point
│   │   └── index.ts                # Server setup, transport selection
│   ├── api/                        # Shared API layer
│   │   ├── client.ts               # Single HTTP client (native fetch, auth, retry)
│   │   ├── rate-limiter.ts         # Token bucket — queues requests, never throws
│   │   ├── cache.ts                # LRU with TTL
│   │   └── endpoints/              # One file per API domain
│   │       ├── company.ts          # Profile, registered address, registers
│   │       ├── search.ts           # Basic search, advanced search, alphabetical
│   │       ├── officers.ts         # Officers list, appointments, disqualifications
│   │       ├── filing.ts           # Filing history, individual filing, document metadata
│   │       ├── charges.ts          # Charges list, individual charge
│   │       ├── psc.ts              # All PSC types consolidated
│   │       └── insolvency.ts       # Insolvency proceedings
│   ├── tools/                      # MCP tool definitions
│   │   ├── registry.ts             # Tool registration, dispatch, schema generation
│   │   ├── search.ts               # search_companies, search_officers
│   │   ├── company.ts              # get_company_profile
│   │   ├── officers.ts             # get_officers, get_appointments
│   │   ├── ownership.ts            # get_ownership (consolidated PSC)
│   │   ├── filings.ts              # get_filings, get_filing_document
│   │   ├── financial.ts            # get_charges, get_insolvency
│   │   ├── extended.ts             # registers, exemptions, uk_establishments, disqualifications
│   │   └── composite.ts            # company_report, due_diligence, officer_network
│   ├── formatters/                 # Shared output formatting
│   │   └── index.ts                # Markdown formatters for MCP text responses
│   └── types/                      # Single source of truth
│       └── index.ts                # snake_case matching CH API, with JSDoc
├── skills/
│   └── companies-house.md          # Claude Code skill
├── tests/
│   ├── unit/                       # Mocked tests for every component
│   ├── integration/                # Real API tests with known companies
│   └── fixtures/                   # Recorded API responses
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

### Core Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Single API client, dependency-injected** | One rate limiter, one cache, one auth config. No more 7 instances. |
| **Rate limiter queues, never throws** | CH allows 600 req/5min. If at limit, wait 200ms. Better than erroring. |
| **Native fetch, no Axios** | Node 18+ has fetch built in. Zero dependency for HTTP. |
| **Types match API (snake_case)** | CH returns `company_number`, types say `company_number`. No mapping layer. |
| **Tools designed around use cases** | Not a 1:1 endpoint mirror. One `get_ownership` tool, not 13 PSC sub-tools. |
| **Structured outputs on every tool** | Both `content` (formatted text) and `structuredContent` (typed JSON). |
| **CLI and server share the API layer** | CLI is just a different frontend on the same client/endpoints. |

---

## Tool Design

### Core Tools (10)

These cover the primary use cases and map to the most-used CH API endpoints:

| Tool | What it does | CH Endpoints Used |
|------|-------------|-------------------|
| `search_companies` | Search by name. Accepts optional filters: status, SIC code, incorporation date range, location, dissolved. Uses advanced search when filters present. | `/search/companies`, `/advanced-search/companies` |
| `search_officers` | Find a person across all companies. Returns name, company, role, appointment date. | `/search/officers` |
| `get_company_profile` | Full company profile: name, status, type, SIC codes, registered address, accounts dates, confirmation statement dates, previous names. Enriched with human-readable explanations (company type, status meaning). | `/company/{id}`, `/company/{id}/registered-office-address` |
| `get_officers` | Officers for a company. Active by default, option for all (including resigned). Role, appointment date, nationality, occupation. | `/company/{id}/officers` |
| `get_appointments` | All appointments for a specific officer across companies. The inverse of get_officers. | `/officers/{id}/appointments` |
| `get_ownership` | All PSCs for a company — individuals, corporates, legal persons. Consolidated into one tool regardless of PSC type. Natures of control translated to plain English. | `/company/{id}/persons-with-significant-control` (all sub-endpoints) |
| `get_filings` | Filing history with category filtering. Includes transaction IDs and document links. | `/company/{id}/filing-history` |
| `get_charges` | Charges/mortgages. Outstanding vs satisfied. Chargee details. | `/company/{id}/charges` |
| `get_insolvency` | Insolvency proceedings, cases, practitioners, dates. | `/company/{id}/insolvency` |
| `get_company_registers` | Statutory registers: directors, secretaries, members, PSCs. | `/company/{id}/registers` |

### Composite Tools (3) — The Differentiator

These don't exist in any competitor. They call multiple endpoints and synthesise the results:

| Tool | What it does | Why it matters |
|------|-------------|----------------|
| `company_report` | One call returns: profile + active officers + PSCs + outstanding charges + recent filings (last 10) + insolvency status. Formatted as a structured report. | This is what 90% of users actually want. One tool call instead of 6. |
| `due_diligence_check` | Red-flag scanner. Checks: insolvency status, outstanding charges, overdue accounts, overdue confirmation statement, dissolved/struck-off status, PSC warnings, recently resigned officers. Returns a structured risk assessment. | Unique. No competitor does this. Agents can use this to quickly assess company health. |
| `officer_network` | Given an officer name or ID, finds all their current and past appointments. Builds a map of connected companies. | Essential for investigating directors across multiple companies. |

### Extended Tools (4) — Full Coverage

| Tool | CH Endpoints |
|------|-------------|
| `get_exemptions` | `/company/{id}/exemptions` |
| `get_uk_establishments` | `/company/{id}/uk-establishments` |
| `get_officer_disqualifications` | `/officer-disqualifications/natural/{id}`, `/officer-disqualifications/corporate/{id}` |
| `get_filing_document` | `/company/{id}/filing-history/{transaction_id}`, document API |

**Total: 17 tools.** Each one with structured output, tool annotations, and formatted text.

### Tool Annotations (Every Tool)

```typescript
annotations: {
  readOnlyHint: true,       // all tools are read-only
  destructiveHint: false,    // nothing is modified
  idempotentHint: true,      // same input = same output
  openWorldHint: true,       // hits external CH API
}
```

### Structured Output Example

Every tool returns both human-readable text AND typed JSON:

```typescript
// Tool response for get_company_profile
{
  content: [
    {
      type: "text",
      text: "## Anthropic UK Ltd\n\nCompany Number: 13861484\nStatus: Active\n..."
    }
  ],
  structuredContent: {
    company_number: "13861484",
    company_name: "ANTHROPIC UK LTD",
    company_status: "active",
    type: "ltd",
    date_of_creation: "2022-01-10",
    registered_office_address: { ... },
    sic_codes: ["62011"],
    accounts: { ... },
    confirmation_statement: { ... }
  }
}
```

---

## CLI

The same package doubles as a terminal tool. The CLI uses the same API layer as the MCP server.

```bash
# Install globally
npm install -g companies-house-mcp

# Or use directly
npx companies-house-mcp search "Anthropic"

# Core commands
ch search "Anthropic"                          # search companies
ch search --status active --sic 62011 "tech"   # advanced search
ch profile 13861484                            # company profile
ch officers 13861484                           # officers
ch officers 13861484 --all                     # include resigned
ch ownership 13861484                          # PSCs
ch filings 13861484 --category accounts        # filing history
ch charges 13861484                            # charges
ch insolvency 13861484                         # insolvency

# Composite commands (the good stuff)
ch report 13861484                             # full company report
ch check 13861484                              # due diligence red-flag scan
ch network "John Smith"                        # officer network map

# Output control
ch profile 13861484 --json                     # raw JSON (pipe-friendly)
ch search "Acme" --json | jq '.[]'             # works with jq

# Server mode
ch serve                                       # stdio (default)
ch serve --http                                # streamable HTTP
ch serve --http --port 8080                    # custom port
```

**Config**: reads `COMPANIES_HOUSE_API_KEY` from environment. Also supports `~/.config/companies-house/config.json` for persistent config.

---

## Skill

A `skills/companies-house.md` file that teaches Claude Code how to do UK company research. This is domain expertise, not just tool documentation.

**What it covers:**

- **Company number formats**: 8-digit zero-padded, SC (Scotland), NI (Northern Ireland), OC (LLP), FC/SE (overseas)
- **SIC code interpretation**: common codes and what they mean
- **Company status meanings**: active, dissolved, liquidation, receivership, administration, etc.
- **Filing categories**: accounts, annual-return, confirmation-statement, capital, incorporation, officers, mortgage
- **Due diligence workflows**: step-by-step process, what to check, what red flags look like
- **Nature of control codes**: PSC control thresholds (25-50%, 50-75%, 75%+), what they mean
- **Recommended tool sequences**: "start with search, then report, then network for deeper investigation"
- **Data interpretation**: accounting reference dates, overdue meanings, confirmation statement obligations

The skill references MCP tools by name and tells Claude *when* and *how* to use each one.

---

## MCP Protocol Features

| Feature | Implementation |
|---------|---------------|
| **SDK version** | @modelcontextprotocol/sdk 1.27.1 (latest) |
| **Structured outputs** | `outputSchema` defined per tool, `structuredContent` in every response |
| **Tool annotations** | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` on all tools |
| **Transport: stdio** | Default. For Claude Desktop, Claude Code, Cursor, etc. |
| **Transport: Streamable HTTP** | `--http` flag. For remote deployment, multi-client scenarios. |
| **Protocol negotiation** | SDK handles it. No manual `InitializeRequestSchema` handler. |
| **Error responses** | Actionable messages with specific next steps (e.g., "Company not found. Try search_companies to find the correct number.") |
| **Pagination** | Consistent `limit` and `offset` params. Tools handle pagination internally where useful (e.g., composite tools fetch all pages). |

---

## API Client Design

```
┌─────────────────────────────────────────────┐
│              Tool / CLI Command              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Endpoint Layer                     │
│  (company.ts, search.ts, officers.ts, ...)  │
│  Typed methods, response parsing             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Shared API Client                  │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Cache   │ │  Rate    │ │   Retry      │  │
│  │  (LRU)  │ │  Limiter │ │   (backoff)  │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
│  Native fetch · Basic auth · Error mapping   │
└──────────────────┬──────────────────────────┘
                   │
         Companies House API
```

**Rate Limiter**: Token bucket, 600 tokens per 5 minutes. When exhausted, queues the request and waits. Never throws a rate limit error to the caller.

**Cache**: LRU with per-endpoint TTLs:
- Company profile: 30 min (rarely changes)
- Search results: 5 min
- Officers: 15 min
- Filings: 5 min
- Charges: 30 min
- PSC: 15 min

**Retry**: Exponential backoff for 5xx errors and network failures. 3 attempts max.

---

## Distribution

| Channel | How |
|---------|-----|
| **npm** | `npx companies-house-mcp` for MCP server, `npm i -g companies-house-mcp` for CLI. Publish as v2.0.0. |
| **Homebrew** | `aicayzer/homebrew-tap` repo. `brew tap aicayzer/tap && brew install companies-house-mcp` |
| **MCP Registry** | Official listing via `server.json` for discoverability in MCP-aware clients. |
| **Smithery** | `smithery.yaml` for one-click Claude Desktop install. |

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js 22+ | LTS, native fetch, modern JS |
| Language | TypeScript (strict, ESM) | Type safety, SDK compatibility |
| MCP SDK | @modelcontextprotocol/sdk 1.27.1 | Latest, structured outputs, annotations |
| Validation | Zod 3.x | SDK standard, schema generation |
| HTTP | Native fetch | Zero dependencies |
| CLI parsing | Lightweight (citty or hand-rolled) | Commander.js is overkill |
| Testing | Vitest | Fast, ESM-native, TypeScript-first |
| Formatting | chalk + cli-table3 | Terminal colours and tables |
| Licence | MIT | No adoption barriers |

**Production dependencies target: 4-5 max** (SDK, Zod, chalk, cli-table3, and possibly citty for CLI).

---

## Test Strategy

### Unit Tests
- API client: mock fetch, test auth headers, error mapping, retry logic
- Rate limiter: token depletion, queue behaviour, refill timing
- Cache: TTL expiry, LRU eviction, hit/miss
- Each endpoint file: response parsing, parameter handling
- Each tool: input validation, output formatting, structured content shape
- Formatters: markdown output correctness

### Integration Tests
Real API calls against known companies:

| Company | Number | Why |
|---------|--------|-----|
| ANTHROPIC UK LTD | 13861484 | Active, tech company, simple structure |
| TESCO PLC | 00445790 | Large, many officers, charges, filings |
| COMPANIES HOUSE | N/A | Search result testing |
| A dissolved company | TBD | Test dissolved status handling |
| A company in insolvency | TBD | Test insolvency data |
| A company with PSCs | TBD | Test ownership data |
| An LLP | OC... | Test non-standard company types |
| A Scottish company | SC... | Test SC prefix handling |

### Evaluation (per Anthropic's MCP Builder guidance)
10+ complex, realistic test scenarios that exercise multiple tools:
1. "Research Anthropic UK and give me a full profile"
2. "Who are the directors of Tesco and what other companies do they direct?"
3. "Is [company] financially healthy? Any red flags?"
4. "Find all companies with SIC code 62011 in London"
5. "What filings has [company] made in the last year?"
... etc.

---

## What I Need From You

1. **API Key** — ✅ Received. Will use for integration testing.
2. **npm publish access** — When v2 is ready, you'll need to `npm publish`. Or grant me a token.
3. **GitHub repo permissions** — I can push to the branch. For Homebrew tap, you'd need to create `aicayzer/homebrew-tap` repo (can do this later).
4. **Test companies** — I'll compile a list of known companies for integration tests. If you have specific ones you care about, let me know.
5. **Smithery / MCP Registry accounts** — When we get to distribution. Not needed now.

That's it. Everything else I can build.

---

## Build Order

This is the full scope. We'll break it into phases when we start building, but here's the logical sequence:

1. **Foundation** — New project structure, tsconfig, package.json, CLAUDE.md. Nuke old src/.
2. **API Layer** — Client, rate limiter, cache, all endpoint files. This is the engine.
3. **Core Tools (10)** — MCP tool definitions with structured outputs and annotations.
4. **MCP Server** — Server entry point, stdio + HTTP transport, tool registration.
5. **Composite Tools (3)** — company_report, due_diligence_check, officer_network.
6. **Extended Tools (4)** — Full API coverage parity.
7. **CLI** — Terminal commands, formatters, config file support.
8. **Skill** — companies-house.md with domain expertise.
9. **Tests** — Unit + integration + evaluation scenarios.
10. **Distribution** — npm publish, Homebrew tap, MCP Registry, Smithery.
11. **Polish** — README, examples, CI/CD.

---

## What Makes This The Best

| Dimension | Competitor (stefanoamorelli) | Current v1 | This v2 |
|-----------|------------------------------|------------|---------|
| Tools | ~40 (1:1 API mirror) | 7 | 17 (use-case oriented) |
| Composite tools | None | None | 3 (report, due diligence, network) |
| Output | Raw JSON.stringify | Formatted text | Formatted text + structured JSON |
| Structured outputs | No | No | Yes (outputSchema + structuredContent) |
| Tool annotations | No | No | Yes (all 4 hints) |
| Caching | No | Yes (basic) | Yes (LRU + per-endpoint TTL) |
| Rate limiting | No | Yes (throws) | Yes (queues, never throws) |
| Transport | stdio + HTTP | stdio | stdio + Streamable HTTP |
| CLI | No | Server launcher only | Full terminal interface |
| Skill | No | No | Yes (domain expertise) |
| SDK version | 1.27.1 | 1.12.1 | 1.27.1 |
| Dependencies | Axios + many | 3 | 4-5 |
| Licence | AGPL-3.0 | MIT | MIT |

The competitor has breadth (40 tools). We have depth (17 tools that are actually good, with composites nobody else has, structured outputs, a CLI, and a skill). Breadth is a weekend of `JSON.stringify`. Depth is the hard part.
