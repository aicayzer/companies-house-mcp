# Handover: Companies House MCP v2 Rebuild

> **This is a temporary file.** Delete it before merging the PR.
> Run: `git rm HANDOVER.md && git commit -m "remove handover doc"`

---

## What Was Done

The entire codebase was rebuilt from scratch on branch `claude/companies-house-v2-rebuild-OwKQw`. See the [PROPOSAL.md](./PROPOSAL.md) for the original design and the commit history for details:

```bash
git log --oneline master..HEAD
```

**4 commits:**
1. `44afa28` — v2 rebuild proposal document
2. `c0762e6` — **The main rebuild** — 17 tools, CLI, MCP server (stdio + HTTP), new architecture
3. `832f635` — UX fixes found during manual code review
4. `82fa330` — Expanded the Claude Code skill with reference tables

**76 files changed, 6111 insertions, 8841 deletions.**

### Architecture (quick summary)
- `src/api/` — HTTP client, rate limiter (queue-based, never throws), LRU cache
- `src/api/endpoints/` — One file per API domain
- `src/tools/` — 17 MCP tools, self-registering via registry pattern
- `src/server/` — MCP server (stdio + streamable HTTP)
- `src/cli/` — CLI (`ch` command)
- `src/formatters/` — Shared markdown formatters
- `src/types/` — TypeScript types (snake_case matching Companies House API)
- All tools return `{ content, structuredContent }` — markdown for humans, JSON for agents

---

## Current Test Status

**Unit tests: 59 passing** (all green, no issues)

```
 ✓ tests/unit/api/cache.test.ts          (8 tests)
 ✓ tests/unit/api/client.test.ts         (10 tests)
 ✓ tests/unit/api/rate-limiter.test.ts   (4 tests)
 ✓ tests/unit/tools/formatters.test.ts   (17 tests)
 ✓ tests/unit/tools/registry.test.ts     (4 tests)
 ✓ tests/unit/tools/tools-execution.test.ts (16 tests)
```

**Integration tests: 12 skipped** — these need a real API key and network access. They could not run in the sandboxed cloud environment. **This is the main thing you need to verify locally.**

---

## What You Need To Do

### Step 1: Pull the branch

```bash
cd ~/path-to/companies-house-mcp
git fetch origin claude/companies-house-v2-rebuild-OwKQw
git checkout claude/companies-house-v2-rebuild-OwKQw
```

### Step 2: Install and build

```bash
npm install
npm run build
```

### Step 3: Set your API key

```bash
export COMPANIES_HOUSE_API_KEY=your_api_key_here
```

Get one from https://developer.company-information.service.gov.uk/ if you don't have one already. It's free — just register an application and use the API key it gives you.

### Step 4: Run ALL tests

```bash
# Unit tests (should all pass — already verified)
npm run test:unit

# Integration tests (THE IMPORTANT ONES — need API key)
npm run test:integration

# Or just run everything:
npm test
```

The integration tests (`tests/integration/tools.test.ts`) exercise the actual tools end-to-end against the live Companies House API. They test:
- `search_companies` (searches for "Tesco")
- `get_company_profile` (fetches Tesco PLC — company 00445790)
- `get_company_officers`
- `get_filing_history`
- `get_persons_with_significant_control`
- `get_company_charges`
- `get_insolvency_history`
- `search_officers` (searches for "John Smith")
- `get_officer_appointments`
- `get_company_exemptions`
- `get_company_report` (composite tool)
- `get_officer_network` (composite tool)

If any fail, check:
- Is `COMPANIES_HOUSE_API_KEY` set and valid?
- Do you have internet access?
- Companies House API occasionally returns 500s — retry once if that happens

### Step 5: Quick manual smoke test

```bash
# Test the CLI
npm run build
echo '{"company_number": "00445790"}' | npx ch get_company_profile

# Or test the MCP server directly
node dist/server/index.js
```

### Step 6: Test with Claude Code (optional but recommended)

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json` or similar):

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "node",
      "args": ["/absolute/path/to/companies-house-mcp/dist/server/index.js"],
      "env": {
        "COMPANIES_HOUSE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Then ask Claude: "Search for Tesco on Companies House" — it should use the `search_companies` tool.

### Step 7: Clean up and merge

Once tests pass:

```bash
# Remove this handover file
git rm HANDOVER.md
git commit -m "remove handover doc"
git push origin claude/companies-house-v2-rebuild-OwKQw

# Then create/merge the PR on GitHub
```

---

## Key Files To Review If Anything Looks Off

| Area | File(s) |
|------|---------|
| All tool definitions | `src/tools/*.ts` |
| API client + retry/rate-limit | `src/api/client.ts`, `src/api/rate-limiter.ts` |
| Integration tests | `tests/integration/tools.test.ts` |
| MCP server entry | `src/server/index.ts` |
| CLI entry | `src/cli/index.ts` |
| Type definitions | `src/types/*.ts` |

---

## TL;DR

Everything is built and unit-tested. You just need to:
1. `npm install && npm run build`
2. `export COMPANIES_HOUSE_API_KEY=...`
3. `npm test` — verify integration tests pass
4. `git rm HANDOVER.md` — clean up this file
5. Merge the PR
