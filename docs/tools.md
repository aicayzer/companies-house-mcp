# Tools reference

17 tools covering search, company data, officers, ownership, filings, charges, insolvency, and due diligence. Every tool returns formatted text for humans and structured JSON for agents.

Company numbers are 8-digit, zero-padded strings: `14604577`, `00445790`. Scottish companies use an `SC` prefix.

## Search

### `search_companies`

Search for UK companies by name. Supports filters for status, type, incorporation date, location, and SIC codes. When filters are provided, uses the advanced search endpoint for more precise results.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Company name or number |
| `items_per_page` | number | No | Results per page, max 100 (default: 20) |
| `start_index` | number | No | Pagination offset (default: 0) |
| `company_status` | string | No | Filter: `active`, `dissolved`, `liquidation`, `receivership`, etc. |
| `company_type` | string | No | Filter: `ltd`, `plc`, `llp`, etc. |
| `incorporated_from` | string | No | Incorporation date from (YYYY-MM-DD) |
| `incorporated_to` | string | No | Incorporation date to (YYYY-MM-DD) |
| `location` | string | No | Filter by registered office location |
| `sic_codes` | string | No | Filter by SIC code(s), comma-separated |

---

### `search_officers`

Search for company officers by name across all UK companies. Returns name, address, appointment count, date of birth, and officer ID for use with `get_appointments`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Officer name |
| `items_per_page` | number | No | Results per page, max 100 (default: 20) |
| `start_index` | number | No | Pagination offset (default: 0) |

---

## Company data

### `get_company_profile`

Full company profile: status, registered address, SIC codes, incorporation date, accounts and confirmation statement dates.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `get_officers`

Current and resigned directors, secretaries, and other officers. Includes name, role, appointed date, and resigned date where applicable.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |
| `items_per_page` | number | No | Results per page (default: 35) |
| `start_index` | number | No | Pagination offset (default: 0) |

---

### `get_appointments`

All appointments held by a specific officer across all UK companies — both current and past. Requires an officer ID from `search_officers`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | Yes | Officer ID (from `search_officers`) |
| `items_per_page` | number | No | Results per page (default: 35) |
| `start_index` | number | No | Pagination offset (default: 0) |

---

### `get_ownership`

Persons with significant control (PSCs) and corporate ownership chains. Includes name, nationality, ownership nature, and notified date.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |
| `items_per_page` | number | No | Results per page (default: 25) |
| `start_index` | number | No | Pagination offset (default: 0) |

---

### `get_filings`

Filing history with document metadata and download links. Filterable by category.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |
| `items_per_page` | number | No | Results per page (default: 25) |
| `start_index` | number | No | Pagination offset (default: 0) |
| `category` | string | No | Filter by category: `accounts`, `confirmation-statement`, `incorporation`, `officers`, `mortgages`, etc. |

---

### `get_filing_document`

Retrieve a specific filing document by its document ID. Returns the document content or a download link.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |
| `transaction_id` | string | Yes | Transaction ID from `get_filings` |

---

### `get_charges`

Charges and mortgages registered against the company. Includes charge holder, creation date, and satisfaction status.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |
| `items_per_page` | number | No | Results per page (default: 25) |
| `start_index` | number | No | Pagination offset (default: 0) |

---

### `get_insolvency`

Insolvency proceedings, liquidations, and administrations. Returns 404 (handled gracefully) when no insolvency history exists.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `get_company_registers`

Statutory registers: members, directors, secretaries, and charges. Shows whether each register is held at Companies House or elsewhere.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

## Composite

These tools make multiple API calls and combine the results. Start with `company_report` for any new company investigation.

### `company_report`

Comprehensive company report in a single call: full profile, active officers, PSCs/ownership, outstanding charges, recent filings (last 10), and insolvency status. Recommended starting point for any company research.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `due_diligence_check`

Automated due diligence red-flag scan. Checks: company status (dissolved, liquidation, etc.), insolvency history, outstanding charges, overdue accounts, overdue confirmation statement, PSC warnings, recently resigned officers, and company age. Returns a risk assessment with HIGH / MEDIUM / LOW severity ratings.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `officer_network`

Map an officer's network of company appointments. Given an officer ID or name, finds all their current and past directorships. Shows connected companies, their statuses, and roles held.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | No | Officer ID from `search_officers`. Provide this or `officer_name`. |
| `officer_name` | string | No | Officer name to search for. Provide this or `officer_id`. |

---

## Extended

### `get_exemptions`

Disclosure exemptions registered for the company.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `get_uk_establishments`

UK establishments of overseas companies.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number |

---

### `get_officer_disqualifications`

Disqualification orders made against a specific officer.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | Yes | Officer ID from `search_officers` |
