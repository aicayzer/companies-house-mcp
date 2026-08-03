# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## companies-house-cli [2.0.0] / companies-house-mcp [4.0.0] — Unreleased

### Added
- **MCP SDK v2 foundation** — the server now uses the split `@modelcontextprotocol/server` and `@modelcontextprotocol/node` packages with Zod v4.
- **Modern and legacy protocol support** — stdio and Streamable HTTP serve legacy MCP clients alongside protocol version `2026-07-28` from one tool implementation.
- **Public server interfaces** — `companies-house-cli/mcp` exports `createCompaniesHouseMcpFactory()` and `companies-house-cli/server` exports the explicit `runServer()` entry point.
- **Controlled HTTP binding** — `--host` defaults to `127.0.0.1`; non-loopback bindings require `MCP_BEARER_TOKEN`.

### Changed
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
