# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## companies-house-cli [2.0.0] / companies-house-mcp [4.0.0] — Unreleased

### Added
- **Honest coverage reporting** — `company_report` and `due_diligence_check` state what they retrieved, what they could not retrieve, and what the public register cannot establish. `get_officers` reports the API's own active and resigned totals.
- **PSC absence explained** — an empty persons-with-significant-control register is now distinguished between a market-listing exemption, a filed statement, and a genuine absence of data.
- **Document metadata first** — `download_filing_document` reads the document metadata before transferring anything, so it reports the available formats, page count and exact size, and refuses oversized content up front. `metadata_only` inspects a document without retrieving it.
- **Bounded auto-pagination** — requesting officers in post pages through the list until every active officer has been found, rather than filtering a single page.
- **Full CLI coverage** — every MCP tool now has a `ch` command, including `appointments`, `filing`, `document`, `registers`, `exemptions`, `establishments` and `disqualifications`. `ch tools` lists the registry, `ch --version` reports the version, and `ch <command> --help` is generated from the tool's own schema.
- **Optional Cloudflare Worker** — `packages/worker` is a single-user Worker that serves the same MCP server over Streamable HTTP with a bearer token, deployed by the user into their own account.
- **Generated documentation** — `docs/tools.md` and `docs/public/llms.txt` are generated from the tool registry, and a test fails when the prose documentation drifts from the tools.
- **MCP SDK v2 foundation** — the server now uses the split `@modelcontextprotocol/server` and `@modelcontextprotocol/node` packages with Zod v4.
- **Modern and legacy protocol support** — stdio and Streamable HTTP serve legacy MCP clients alongside protocol version `2026-07-28` from one tool implementation.
- **Public server interfaces** — `companies-house-cli/mcp` exports `createCompaniesHouseMcpFactory()` and `companies-house-cli/server` exports the explicit `runServer()` entry point.
- **Controlled HTTP binding** — `--host` defaults to `127.0.0.1`; non-loopback bindings require `MCP_BEARER_TOKEN`.

### Changed
- **Due-diligence output is a summary, not a verdict** — `due_diligence_check` reports observations drawn from filed data, the checks it ran and the checks it could not run. The `CLEAR` risk level and the "appears to be in good standing" conclusion are gone, along with the `risk_level` and `flags` fields, replaced by `observations`, `observation_counts`, `checks_performed` and `coverage`.
- **Documents come back to the caller** — `download_filing_document` returns the document as an MCP embedded resource rather than a filesystem path on the server. Writing to disk is now opt-in through `save_to`; `return_as`, `save_dir` and `COMPANIES_HOUSE_DOWNLOAD_DIR` are removed.
- **Counts come from the API, not from a page** — outstanding charges use the aggregate satisfied and part-satisfied totals, and officer counts use `active_count` and `resigned_count`, so they stay correct for companies with more records than fit in one request.
- **Deprecated profile fields retired** — company records read the `links` sub-resources and `accounts.next_accounts.overdue` instead of `has_charges`, `has_insolvency_history` and `accounts.overdue`, and describe recorded charges as history rather than current encumbrance.
- **`company_status_detail` is surfaced**, so a company that is active with a proposal to strike off is no longer reported as simply active.
- **`officer_network` refuses to guess** — an ambiguous name returns the matches and asks for an officer id instead of silently using the first result.
- **Rate limits** — the client reads the Companies House quota headers and waits out a 429 only when the API says the window is about to reset, reporting it otherwise.
- **Transport-neutral server** — the shared MCP factory owns the API client, cache, rate limiter, and all 18 tool registrations while transport runners create isolated server sessions.
- **Dependency baseline** — updated build and test tooling within supported major versions and pinned the Node adapter's Hono peer to a patched release.
- **Tool contracts** — all tools now have titles and complete Zod input schemas. `download_filing_document` is correctly marked as capable of writing to disk.
- **Structured failures** — tool errors include safe structured metadata describing the failure kind, upstream status, endpoint, and retryability.
- **Package identity** — the MCP wrapper and CLI server supply their own versions instead of reporting the CLI package version for both entry points.
- **HTTP health response** — `/health` reports the 18-tool inventory and supported protocol families without exposing authentication state.
- **Bring your own key** — active documentation consistently describes local or controlled private operation with each user supplying their own Companies House API key.

### Removed
- **Incomplete OAuth façade** — removed the custom OAuth discovery, authorisation, PKCE, and token endpoints. Deprecated `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`, and `MCP_PUBLIC_URL` settings now produce migration guidance at startup.
- **Wildcard CORS** — removed permissive browser CORS handling from the private HTTP transport.

### Fixed
- **Active officers could be missed entirely** — filtering one page for officers in post reported none for a company whose active officers fall past the first page.
- **PSC exemption misread as a compliance gap** — a listed company exempt from the PSC regime was flagged as having no ownership on record.
- **Dates shifted a day** west of UTC, because calendar dates were formatted in the host's timezone.
- **Document API metadata used the wrong host** — a dead endpoint helper pointed at the main API rather than the document service.
- **Wrong company numbers in the documentation and test fixtures** — examples labelled as BrewDog, Tesco and Anthropic pointed at unrelated companies.
- **Tool inventory drift** — server, CLI, tests, documentation, and bundled skills now use the same 18-tool registry.
- **Rate-limit message** — an upstream `429` is reported as retryable instead of incorrectly claiming the request was queued.
- **Factory credential consistency** — document metadata and content requests now use the API key supplied to the MCP factory.
- **Loopback HTTP hardening** — local HTTP requests validate their `Host` and `Origin` headers to prevent DNS rebinding.
- **Release ordering** — the wrapper package is no longer published when the CLI package publication fails.
- **Clean release artefacts** — package builds now remove stale output before compiling, preventing removed server files from leaking into tarballs.

## companies-house-cli [1.2.0] / companies-house-mcp [3.2.0] — 2026-05-08

### Added
- **OAuth `authorization_code + PKCE` grant** — the HTTP server now supports the full interactive OAuth flow required by Claude Desktop's Custom Connector UI. Set `MCP_OAUTH_CLIENT_ID` and `MCP_OAUTH_CLIENT_SECRET` to enable; the server handles `/oauth/authorize` (mints stateless HMAC-signed codes) and `/oauth/token` (validates code + PKCE, issues bearer token). Both `S256` and `plain` challenge methods are supported.

### Changed
- **OAuth discovery** — `/.well-known/oauth-authorization-server` now advertises `authorization_endpoint`, `response_types_supported`, `grant_types_supported`, `code_challenge_methods_supported`, and `token_endpoint_auth_methods_supported` in accordance with RFC 8414.
- **Startup log** — HTTP mode now logs the OAuth authorize and token endpoint URLs when OAuth is enabled.
- **Docs** — added HTTP mode section, authentication and environment variable table, and Custom Connector walkthrough to `docs/mcp.md`; added `download_filing_document` to the tools reference; updated tool count 17→18 throughout.

---

## companies-house-cli [1.1.0] / companies-house-mcp [3.1.0] — 2026-05-05

### Added
- **`download_filing_document` tool** — fetches the actual filed document (PDF / XHTML / XML / JSON) for a filing history item via the Companies House Document API. Handles the two-step redirect flow; supports `file_path` and `base64` return modes (base64 required for remote HTTP servers). Contributed by Jon Bloor ([#18](https://github.com/aicayzer/companies-house-mcp/pull/18)).

### Fixed
- **HTTP transport crash** — `--http` mode crashed on every request after the first with `Error: Already connected to a transport`. Switched to stateless mode: a fresh `McpServer` + `StreamableHTTPServerTransport` per request, torn down on `res.close`. Contributed by Jon Bloor ([#18](https://github.com/aicayzer/companies-house-mcp/pull/18)).

### Changed
- **HTTP server: optional bearer-token auth** — set `MCP_BEARER_TOKEN` to require an `Authorization: Bearer` header on `/mcp`. Logs a warning when unset. Contributed by Jon Bloor ([#18](https://github.com/aicayzer/companies-house-mcp/pull/18)).
- **HTTP server: optional OAuth `client_credentials` grant** — set `MCP_OAUTH_CLIENT_ID` and `MCP_OAUTH_CLIENT_SECRET` to enable `/oauth/token` and `/.well-known/oauth-authorization-server`. Lets Claude desktop's Custom Connector UI authenticate without a manually-pasted bearer token. Contributed by Jon Bloor ([#18](https://github.com/aicayzer/companies-house-mcp/pull/18)).
- OAuth endpoint logic extracted from `main()` into `src/server/oauth.ts`.

---

## companies-house-mcp [3.0.1] — 2026-03-27

### Fixed
- `companies-house-mcp` was published with a pnpm `workspace:` protocol in its dependency on `companies-house-cli`, causing `EUNSUPPORTEDPROTOCOL` errors when installing via npm. Switched publish step to `pnpm publish` so workspace protocol is converted to a real version before publishing.

---

## companies-house-cli [1.0.1] / companies-house-mcp [3.0.0] — 2026-03-27

### Changed
- **Monorepo restructure.** The codebase is now a pnpm workspace with two packages.
- `companies-house-cli@1.0.1` is the new primary package. All source code (API client, CLI, MCP server, tools, formatters) lives here. Install for the `ch` terminal CLI.
- `companies-house-mcp@3.0.0` is now a thin wrapper that depends on `companies-house-cli` and exposes the MCP server binary. Existing MCP configs (`npx -y companies-house-mcp`) continue to work unchanged.
- MCP server now reads its version dynamically from `package.json` — no more hardcoded version string.
- Removed MkDocs documentation site (outdated v1 content). The README is now the single source of truth.
- CI/CD rewritten for pnpm workspaces; both packages publish via OIDC trusted publishing on tag push.

### Added
- New CLI skill (`companies-house-cli`) bundled with `companies-house-cli` — teaches Claude Code how to help users work with the `ch` binary.
- `server.json` and `mcpName` field for listing on the [official MCP Registry](https://modelcontextprotocol.io/registry).
- `llms.txt` structured index for LLM discoverability.

---

## companies-house-mcp [2.1.0] — 2026-03-10

### Changed
- Switched to npm trusted publishing (OIDC) — no more stored npm tokens.
- CI now uses npm ≥11.5.1 for OIDC compatibility.
- README rewrite.

---

## companies-house-mcp [2.0.0] — 2026-01-15

### Changed
- Complete rewrite. New architecture: endpoint modules, tool registry, shared formatters.
- Expanded from 7 to 17 tools.
- Added composite tools: `company_report`, `due_diligence_check`, `officer_network`.
- Added extended tools: `get_exemptions`, `get_uk_establishments`, `get_officer_disqualifications`, `get_filing_document`.
- Added terminal CLI (`ch`) with full command set and three output modes.
- Switched to native fetch (removed Axios).
- ESM throughout (`"type": "module"`).
- Node.js requirement raised to ≥22.
- All tools return both formatted text and structured JSON.
- Rate limiter and LRU cache with per-endpoint TTLs.
- Added MCP skill for Claude Code.

---

## companies-house-mcp [1.0.1] — 2025-07-19

### Fixed
- Fixed CLI binary execution when installed globally via npm or npx.
- Improved module detection logic for npm's symlink system.

---

## companies-house-mcp [1.0.0] — 2025-07-18

### Added
- Initial release. 7 MCP tools: company search, profiles, officers, filing history, charges, PSCs, officer search.
- Built-in rate limiting and response caching.
- TypeScript, Node.js 18+.

[1.0.0]: https://github.com/aicayzer/companies-house-mcp/releases/tag/v1.0.0
