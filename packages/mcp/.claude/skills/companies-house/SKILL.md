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

## Visual Output

When the data warrants it and the user's context supports Mermaid rendering (Claude.ai, Claude Desktop, Obsidian, GitHub), generate diagrams from the structured data. Do not generate diagrams in terminal-only contexts (Claude Code CLI, Cursor) — describe the structure in text instead.

**Only generate a diagram when it adds clarity the text alone doesn't provide.** A single PSC doesn't need a flowchart. A company with one director doesn't need a network graph. Use diagrams for relationships, timelines, and comparisons — not for restating what the text already says clearly.

Use `<br/>` for line breaks in Mermaid node labels — never `\n`.

### Ownership Flowcharts

Generate from `get_ownership` data when there are **2+ active PSCs** or **corporate PSCs** (layered ownership).

**Default: top-down, colour-coded by PSC type.**

```
graph TD
    C["Company Name<br/>Company Number | Status"]

    P1["Corporate PSC Name<br/>(Corporate PSC)"]
    P2["Individual Name<br/>(Individual)"]

    P1 -->|"25-50% shares<br/>25-50% votes"| C
    P2 -->|"75-100% shares"| C

    style C fill:#1e3a5f,color:#fff,stroke:#0d253f
    style P1 fill:#7c3aed,color:#fff,stroke:#5b21b6
    style P2 fill:#0d9488,color:#fff,stroke:#0f766e
```

Colours: dark blue for the target company, purple for corporate PSCs, teal for individual PSCs.

**When the user asks about ownership changes or history**, show ceased PSCs with dashed lines and grey styling:

```
    X1["Former Owner<br/>Ceased Dec 2023"]:::ceased
    X1 -.->|"formerly 25-50%"| C
    classDef ceased fill:#94a3b8,color:#fff,stroke:#64748b,stroke-dasharray: 5 5
```

**When there are 5+ PSCs**, use left-to-right layout (`graph LR`) to avoid a tall narrow diagram.

### Officer Network Graphs

Generate from `officer_network` data when an officer has **2+ appointments**.

**Default: left-to-right, colour-coded by company status.**

```
graph LR
    O["Officer Name"]

    C1["Company Name<br/>Company Number"]
    C2["Dissolved Company<br/>Company Number"]:::dissolved

    O -->|"Director<br/>(active)"| C1
    O -->|"Director<br/>(resigned)"| C2

    style O fill:#1e40af,color:#fff,stroke:#1e3a8a
    style C1 fill:#059669,color:#fff,stroke:#047857
    classDef dissolved fill:#dc2626,color:#fff,stroke:#b91c1c
```

Colours: blue for the officer, green for active companies, red for dissolved companies.

**Cap at 15 companies.** If there are more, show active appointments only and note "N additional resigned appointments not shown."

### Filing Timelines

Generate from `get_filings` and `get_officers` data when the user asks about company history, lifecycle, or "what happened with this company."

**Default: sectioned by era, curated key events only.**

```
timeline
    title Company Name — Key Events
    section Formation
        Month Year : Incorporated
    section Growth
        Month Year : Key event description
    section Recent
        Month Year : Key event description
```

**Curate, don't dump.** Select: incorporation, significant officer changes, status changes, charges, insolvency events, and major filings. Skip routine annual accounts and confirmation statements unless they're overdue or the only activity.

### Officer Tenure (Gantt Charts)

Generate from `get_officers` (with `include_resigned: true`) when the user asks about board history, director tenure, or "who was there when."

**Default: full board history, grouped by status.**

```
gantt
    title Company Name — Director Tenure
    dateFormat YYYY-MM-DD
    axisFormat %Y

    section Active
        Director Name :active, start-date, end-date

    section Resigned
        Former Director :done, start-date, end-date
```

Use `active` for current officers, `done` for resigned. For active officers, use today's date as the end date.

**For companies with 15+ officers**, offer a simplified view showing only current officers and key historical figures (founders, long-serving directors).

### Charge Lifecycle (Gantt Charts)

Generate from `get_charges` data when a company has **both outstanding and satisfied charges**, or when the user asks about charge history.

```
gantt
    title Company Name — Charges
    dateFormat YYYY-MM-DD
    axisFormat %Y

    section Outstanding
        Charge Description :active, created-date, today

    section Satisfied
        Charge Description :done, created-date, satisfied-date
```

## Tips

- Company numbers are case-insensitive but always return uppercase from the API.
- The API returns dates as `YYYY-MM-DD` strings.
- `get_officers` returns active only by default. Use `include_resigned: true` for full history.
- PSC data may not be available for older companies or companies registered before the PSC regime (2016).
- Some endpoints return 404 for valid companies that simply don't have the relevant data (e.g., insolvency for a healthy company). This is normal, not an error.
- Officer IDs are embedded in `links.self` paths: `/officers/{OFFICER_ID}/appointments`.
- For large companies (e.g., Tesco), officer lists can be very long. Use pagination.
