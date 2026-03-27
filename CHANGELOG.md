# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
