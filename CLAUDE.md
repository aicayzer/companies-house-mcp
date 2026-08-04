# Companies House CLI and MCP

## What this is

An unofficial CLI and MCP server for the UK Companies House public register. 18 tools covering company search, company records, officers, ownership, filings, filed documents and combined summaries. Every user brings their own free API key; there is no shared key, hosted backend or proxy.

## Layout

```
packages/cli/      companies-house-cli — the API client, the tools, the CLI, and the MCP server
packages/mcp/      companies-house-mcp — a thin wrapper that starts the shared server over stdio
packages/worker/   optional single-user Cloudflare Worker (private, not published)
docs/              VitePress documentation site
```

All shared implementation lives in `packages/cli/src`:

- `api/` — HTTP client, rate limiter, cache, pagination helper, endpoint functions
- `api/endpoints/` — one file per API domain
- `tools/` — MCP tool definitions, registered into a central registry by side-effect import
- `server/` — the transport-neutral MCP factory, the Node stdio and HTTP runners, secret comparison
- `cli/` — the `ch` entry point, its command table, and schema introspection
- `formatters/` — shared markdown formatters
- `types/` — types matching the Companies House API, in its own snake_case

## Commands

```bash
pnpm build              # all packages
pnpm test:unit          # no API key needed
pnpm test:integration   # needs COMPANIES_HOUSE_API_KEY
pnpm test:package       # packaged stdio entry points, via the MCP client SDK
pnpm lint
pnpm typecheck
pnpm docs:dev
```

The Worker builds with `wrangler deploy --dry-run`, which is what catches bundling problems.

## Conventions

- ESM throughout, Node 22 or newer.
- Types mirror the Companies House API and stay snake_case.
- Tools self-register by calling `registerTool()` at module level. `tools/all.ts` imports them for the side effect; the server and CLI import that.
- Every tool returns `{ content, structuredContent }` — readable text plus a structured payload.
- Every tool declares a `group`, used by the CLI help and the generated docs.
- The rate limiter queues rather than throwing. A 429 is only waited out when Companies House says the window is about to reset.
- Native `fetch`. No Axios.
- Code shared with the Worker must stay runtime-neutral: web-standard APIs, no `Buffer`, no static `node:` imports. Node-only work belongs in `server/index.ts`, `config.ts`, or behind a dynamic import.

## Things that are easy to get wrong

- **Company numbers** are eight characters, zero-padded. `companyNumberSchema` pads all-digit input.
- **Absent sub-resources return 404.** Insolvency, charges, registers, exemptions and UK establishments legitimately 404 for a company that has none. Report an absence, not an error. The company profile's `links` say which exist, so check there before firing a request.
- **Deprecated profile fields.** `has_charges`, `has_insolvency_history`, `has_been_liquidated` and `accounts.overdue` are deprecated, and the first two mean "has or had". Prefer the `links` sub-resources and `accounts.next_accounts.overdue`.
- **`company_status_detail`** matters independently of `company_status`. A company can be `active` with a strike-off proposal.
- **Ceased PSCs stay in the list.** Filter on `ceased_on` before describing anyone as a current controller.
- **Page-derived counts lie.** Use the API's `active_count`, `resigned_count`, `total_count`, `satisfied_count` and `part_satisfied_count` rather than the length of whatever page came back.
- **Dates are calendar dates.** Format them in UTC or they shift a day for callers west of UTC.

## Product language

Companies House does not verify what companies file. Nothing this project produces may read as verification, a credit check, a sanctions or politically-exposed-person screening, or clearance.

`due_diligence_check` reports observations, the checks it ran, the checks it could not run, and the coverage it achieved. It has no overall verdict and must not gain one. `tools-execution.test.ts` asserts the absence of verdict language; keep that test passing rather than working around it.

## Documentation

`docs/tools.md` and `docs/public/llms.txt` are generated from the tool registry. Regenerate with:

```bash
UPDATE_DOCS=1 pnpm test:unit
```

`tests/docs/docs.test.ts` also checks that the prose documentation mentions every tool, mentions no tool that does not exist, and that the CLI command table matches the registry. When it fails, the documentation is wrong, not the test.

## Never

- Commit an API key or bearer token. `.dev.vars` is gitignored; keep it that way.
- Log, echo or return a credential — not in errors, diagnostics, tests or examples.
- Present the Worker as anything other than a private single-user deployment.
- Claim Claude.ai or Claude Desktop custom connector support. Their generally available authentication is OAuth, which this project does not implement.
