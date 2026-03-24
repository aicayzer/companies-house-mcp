---
name: companies-house
description: Research UK companies using Companies House data. Use when asked about UK company details, directors, ownership, filings, due diligence, or corporate structure.
---

# UK Companies House Research

You have access to the `companies-house` MCP server with 17 tools for UK company research. Here's how to use them effectively.

## Quick Start

For most research tasks, start with one of these:

- **Know the company name?** → `search_companies` first, then `company_report` with the number
- **Want a full picture?** → `company_report` (fetches profile + officers + PSCs + charges + filings + insolvency in one call)
- **Checking if a company is safe to deal with?** → `due_diligence_check` (automated red-flag scan)
- **Investigating a director?** → `search_officers` then `officer_network`

## Company Numbers

UK company numbers are 8 characters. Format matters:
- **England/Wales:** 8 digits, zero-padded (e.g., `00445790` for Tesco)
- **Scotland:** `SC` prefix + 6 digits (e.g., `SC421617`)
- **Northern Ireland:** `NI` prefix + 6 digits
- **LLP:** `OC` prefix + 6 digits (e.g., `OC303480`)
- **Overseas:** `FC` prefix + 6 digits

Always use the full format including leading zeros.

## Tool Reference

### Core Tools
| Tool | Use When |
|------|----------|
| `search_companies` | Finding a company by name. Supports filters: status, type, SIC code, location, incorporation date |
| `search_officers` | Finding a person across all companies. Returns officer IDs for deeper investigation |
| `get_company_profile` | Getting full details: status, type, address, SIC codes, accounts dates |
| `get_officers` | Listing directors/secretaries. Default: active only. Use `include_resigned: true` for all |
| `get_appointments` | All companies where a specific officer holds/held positions |
| `get_ownership` | PSCs — who owns/controls the company. Shows ownership percentages and voting rights |
| `get_filings` | Filing history. Use `category` to filter (accounts, officers, mortgage, etc.) |
| `get_charges` | Mortgages and debentures. Outstanding charges = active security interests |
| `get_insolvency` | Insolvency proceedings, practitioners, dates |
| `get_company_registers` | Where statutory registers are held |

### Composite Tools (Use These First)
| Tool | Use When |
|------|----------|
| `company_report` | **Start here for any company research.** One call gets everything: profile, officers, PSCs, charges, filings, insolvency |
| `due_diligence_check` | Automated red-flag scan. Checks: status, insolvency, overdue accounts, charges, officer issues |
| `officer_network` | Mapping a director's connections across companies. Takes name or officer ID |

### Extended Tools
| Tool | Use When |
|------|----------|
| `get_exemptions` | Checking filing exemptions (most companies have none) |
| `get_uk_establishments` | Finding UK branches of overseas companies |
| `get_officer_disqualifications` | Checking if an officer is disqualified from acting as director |
| `get_filing_document` | Getting details of a specific filing by transaction ID |

## Recommended Workflows

### "Tell me about company X"
1. `search_companies` with the name → get company number
2. `company_report` with the number → full picture

### "Is this company safe to deal with?"
1. `due_diligence_check` with company number → risk assessment
2. If flags found, investigate with specific tools

### "Who runs this company and what else do they do?"
1. `get_officers` for the company
2. `search_officers` or `officer_network` for each director of interest
3. Cross-reference companies they're connected to

### "Who owns this company?"
1. `get_ownership` → PSCs with control percentages
2. If corporate PSC, search for that company too (follow the chain)

## Interpreting Data

### Company Status
- **Active** — trading normally
- **Dissolved** — no longer exists (struck off register)
- **Liquidation** — being wound up
- **Administration** — under administrator control
- **Voluntary Arrangement** — CVA or IVA in place

### SIC Codes (Common)
- `62011` — Computer programming
- `62012` — Business/management consultancy (computer)
- `62020` — IT consultancy
- `70100` — Head office activities
- `70229` — Management consultancy (other)
- `64110` — Central banking
- `64191` — Banks
- `82990` — Other business support

### Accounts
- **Overdue accounts** = company hasn't filed on time. Red flag.
- **Accounting reference date** = financial year end
- Companies must file within 9 months (private) or 6 months (public) of year end

### Confirmation Statement
- Annual filing confirming company details are correct
- **Overdue** = company may face strike-off proceedings

### Charges
- **Outstanding** = active security interest (e.g., bank has a charge over assets)
- **Satisfied** = debt paid off, charge released
- Many charges are normal for trading companies (bank facilities)

### PSC Natures of Control
- **25-50%** — significant but not majority
- **50-75%** — majority control
- **75-100%** — supermajority (can pass special resolutions)
- **Right to appoint/remove directors** — governance control even without share ownership

## Tips
- The API returns 404 for valid companies with no data for certain endpoints (insolvency, charges) — this is normal, not an error
- Company numbers must be exact. If search returns nothing, try variations or check for typos
- For dissolved companies, historical data is still available
- PSC data was introduced in 2016 — older companies may have incomplete records
- Use `$ARGUMENTS` as the company name or number for quick lookups
