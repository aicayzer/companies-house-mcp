---
name: companies-house
description: Research UK companies using Companies House data. Use when the user asks about UK companies, directors, ownership, filings, due diligence, or company searches.
---

You have access to the `companies-house` MCP server, which provides tools for querying the UK Companies House API. Use this skill to help users research UK companies, officers, ownership, and corporate history.

## Workflow

**Start broad, go deep:**

1. **Find the company** — Use `search_companies` to find the company number. UK company numbers are 8 digits, zero-padded (e.g., `00445790`). Scottish companies start with `SC`, Northern Irish with `NI`, LLPs with `OC`.

2. **Get the overview** — Use `company_report` for a comprehensive view in one call. This returns profile, officers, PSCs, charges, filings, and insolvency status. This is the best starting point for most requests.

3. **Go deeper as needed:**
   - Ownership questions → `get_ownership`
   - Officer history → `get_appointments` (with officer ID from officers list)
   - Director network → `officer_network` (finds all companies a person directs)
   - Financial health → `due_diligence_check` (automated red-flag scanner)
   - Specific filings → `get_filings` with category filter
   - Charges detail → `get_charges`

## Available Tools

| Tool | Use When |
|------|----------|
| `search_companies` | Finding a company by name. Supports filters: status, type, SIC code, location, incorporation date. |
| `search_officers` | Finding a person across all companies. Returns officer IDs for deeper queries. |
| `get_company_profile` | Getting detailed profile for a known company number. |
| `get_officers` | Listing directors/secretaries. Use `include_resigned: true` for full history. |
| `get_appointments` | Seeing all companies an officer is/was associated with. Needs officer ID. |
| `get_ownership` | PSCs — who owns/controls the company. Individual, corporate, and legal person PSCs. |
| `get_filings` | Filing history. Filter by category: accounts, officers, mortgage, capital, etc. |
| `get_charges` | Mortgages/debentures. Outstanding vs satisfied charges. |
| `get_insolvency` | Insolvency cases, practitioners, proceedings. |
| `company_report` | **Recommended starting point.** One call returns profile + officers + PSCs + charges + filings + insolvency. |
| `due_diligence_check` | Automated red-flag scan. Checks status, accounts, confirmation statement, charges, insolvency, officers, PSCs. |
| `officer_network` | Map all appointments for an officer. Takes name or officer ID. |
| `get_company_registers` | Where the company keeps its statutory registers. |
| `get_exemptions` | Company exemptions (rare). |
| `get_uk_establishments` | UK branches of overseas companies. |
| `get_officer_disqualifications` | Check if someone is disqualified from being a director. |
| `get_filing_document` | Metadata for a specific filing (needs transaction ID from `get_filings`). |

## Company Number Formats

- **Standard:** 8-digit, zero-padded: `00445790`, `13861484`
- **Scotland:** `SC` prefix: `SC123456`
- **Northern Ireland:** `NI` prefix: `NI012345`
- **LLP:** `OC` prefix: `OC301234`
- **Overseas:** `FC` prefix: `FC012345`
- **SE:** `SE` prefix (European companies)

Always pad numbers to 8 digits when needed (e.g., `445790` → `00445790`).

## Company Statuses

| Status | Meaning |
|--------|---------|
| `active` | Trading normally |
| `dissolved` | No longer exists — removed from register |
| `liquidation` | Being wound up — assets being sold |
| `receivership` | Under control of a receiver |
| `administration` | Under protection from creditors, restructuring |
| `voluntary-arrangement` | Reached agreement with creditors |
| `converted-closed` | Converted to another type or closed |
| `insolvency-proceedings` | Insolvency proceedings active |

## SIC Codes (Common)

- `62011` — Computer programming activities
- `62012` — Business and domestic software development
- `62020` — IT consultancy activities
- `62090` — Other IT activities
- `70229` — Management consultancy activities
- `64110` — Central banking
- `64191` — Banks
- `64205` — Financial holding companies
- `68100` — Buying/selling of own real estate
- `68209` — Other letting of own property
- `82990` — Other business support activities
- `47910` — Retail via internet
- `56101` — Licensed restaurants

## Filing Categories

Use with `get_filings` category parameter:
- `accounts` — Annual accounts
- `annual-return` — Annual returns (pre-2016)
- `confirmation-statement` — Confirmation statements (post-2016)
- `officers` — Director/secretary appointments, resignations, changes
- `mortgage` — Charge registrations and satisfactions
- `capital` — Share allotments, capital changes
- `incorporation` — Formation documents
- `change-of-name` — Name change certificates
- `liquidation` — Winding up documents
- `resolution` — Shareholder resolutions
- `miscellaneous` — Everything else

## Due Diligence Interpretation

When `due_diligence_check` returns flags:

**High severity — investigate further:**
- Company dissolved/in liquidation/in administration
- Insolvency history or active proceedings
- Accounts overdue (company may be non-compliant)
- No active officers

**Medium severity — worth noting:**
- Outstanding charges (normal for companies with bank lending)
- Confirmation statement overdue
- Officers recently resigned
- Registered office undeliverable or in dispute
- No PSCs registered for an active company

**Low severity — informational:**
- Company less than one year old
- Sole director (common for small companies)

## Natures of Control (PSC)

PSCs must register if they hold:
- **25-50%** of shares or voting rights
- **50-75%** of shares or voting rights
- **75-100%** of shares or voting rights
- **Right to appoint/remove directors**
- **Significant influence or control**

These can be held directly, in trust, or as a firm.

## Tips

- Company numbers are case-insensitive but always return uppercase from the API.
- The API returns dates as `YYYY-MM-DD` strings.
- `get_officers` returns active only by default. Use `include_resigned: true` for full history.
- PSC data may not be available for older companies or companies registered before the PSC regime (2016).
- Some endpoints return 404 for valid companies that simply don't have the relevant data (e.g., insolvency for a healthy company). This is normal, not an error.
- Officer IDs are embedded in `links.self` paths: `/officers/{OFFICER_ID}/appointments`.
- For large companies (e.g., Tesco), officer lists can be very long. Use pagination.
