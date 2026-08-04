<!-- Generated from the tool registry. Run `UPDATE_DOCS=1 pnpm test:unit` to regenerate. Do not edit by hand. -->

# Tools reference

The MCP server exposes 18 tools. Every tool returns readable text for people and a structured payload for programs.

Company numbers are eight characters, zero-padded — `00445790`. Scottish companies use an `SC` prefix, Northern Irish `NI`, LLPs `OC`, overseas companies `FC`. Shorter all-digit numbers are padded automatically.

Every tool that returns a list tells you where you are in it and how to ask for the next page.

## Search

### `search_companies`

Find UK companies by name and return their company numbers. Supplying any of the status, type, incorporation date, location or SIC filters switches to the advanced search endpoint. This is a name lookup, not a bulk export: narrow the query rather than paging deeply.

CLI: `ch search`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Company name, or part of one. Also accepts a company number. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 20). Default `20`. |
| `start_index` | number | No | Zero-based offset into the results (0–900). Companies House search is not a bulk export; narrow the query rather than paging deeply. Default `0`. |
| `company_status` | string | No | Restrict to a register status: active, dissolved, liquidation, receivership, administration, voluntary-arrangement, converted-closed, insolvency-proceedings. |
| `company_type` | string | No | Restrict to a company type: ltd, plc, llp, and so on. |
| `incorporated_from` | string | No | Earliest incorporation date, YYYY-MM-DD. |
| `incorporated_to` | string | No | Latest incorporation date, YYYY-MM-DD. |
| `location` | string | No | Restrict to a registered office location. |
| `sic_codes` | string | No | Restrict to SIC code(s), comma-separated. |

### `search_officers`

Find company officers by name across the whole UK register. Returns each match with its officer id, service address, month and year of birth where published, and total appointment count. Use the officer id with get_appointments or officer_network. Names are not unique — check the birth date and address before treating two results as the same person.

CLI: `ch search-officers`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Officer name, or part of one. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 20). Default `20`. |
| `start_index` | number | No | Zero-based offset into the results (0–900). Companies House search is not a bulk export; narrow the query rather than paging deeply. Default `0`. |

## Company record

### `get_charges`

List the charges — mortgages, debentures and other security — registered against a UK company, with the persons entitled, creation and delivery dates, particulars and satisfaction status. Outstanding, part-satisfied and satisfied totals come from Companies House aggregate counts, so they stay correct even when the list is longer than one page. A registered charge records that security was granted; it says nothing about the current balance owed.

CLI: `ch charges`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 25). Default `25`. |
| `start_index` | number | No | Zero-based offset into the list. Use the value suggested by the previous response. Default `0`. |

### `get_company_profile`

Read the Companies House register entry for one UK company: registered name, number, status and status detail, company type, incorporation date, registered office address, SIC codes, accounts and confirmation statement dates, and previous names. Use search_companies first if you only know the name.

CLI: `ch profile`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `get_company_registers`

Report where a company keeps its statutory registers of directors, secretaries, members and PSCs — at Companies House or at its own address. Companies House holds no register record for most companies, which the response reports as an absence rather than an error.

CLI: `ch registers`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `get_exemptions`

List the disclosure exemptions recorded for a UK company, with the dates each applies from and to. The most common is exemption from the persons-with-significant-control requirements for companies whose shares trade on a regulated market. Most companies have none.

CLI: `ch exemptions`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `get_insolvency`

Read the insolvency record for a UK company: cases, case type, key dates, appointed practitioners and notes. Companies House returns no record for a company that has never been subject to insolvency proceedings, which the response reports as an absence rather than an error.

CLI: `ch insolvency`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `get_uk_establishments`

List the UK establishments registered by an overseas company — its UK branches, each with its own company number and status. Applies to overseas companies, typically those with an FC-prefixed number; UK-incorporated companies have none.

CLI: `ch establishments`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

## Officers and ownership

### `get_appointments`

List every company appointment held by one officer id, current and past, with the company name, number, status, role and dates. An officer id identifies one person as recorded by Companies House; the same individual can hold more than one id if their details were filed differently. Use search_officers to obtain the id.

CLI: `ch appointments`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | Yes | Companies House officer id, taken from search_officers results or the `links.officer.appointments` path on an officer record. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 50). Default `50`. |
| `start_index` | number | No | Zero-based offset into the list. Use the value suggested by the previous response. Default `0`. |

### `get_officer_disqualifications`

Look up an officer id in the Companies House register of disqualified directors and return any disqualification with its dates, statutory reason, court and the companies named. An empty result means no disqualification is recorded against that officer id — it is not a confirmation that the person has never been disqualified, since the same individual can appear under more than one id.

CLI: `ch disqualifications`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | Yes | Companies House officer id, taken from search_officers results or the `links.officer.appointments` path on an officer record. |
| `is_corporate` | boolean | No | Set true for a corporate officer. Default false queries the natural-person register. Default `false`. |

### `get_officers`

List a company's officers — directors, secretaries, LLP members and equivalents — with role, appointment date, resignation date, nationality, occupation and service address. Returns officers currently in post by default. Companies House offers no general server-side filter for officers still in post, so requesting them pages through the list until every one has been found; the response states how much of the register was read.

CLI: `ch officers`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |
| `include_resigned` | boolean | No | Include officers who have resigned. Default false returns only officers currently in post. Default `false`. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 50). Default `50`. |
| `start_index` | number | No | Zero-based offset into the list. Use the value suggested by the previous response. Default `0`. |
| `order_by` | `appointed_on` \| `resigned_on` \| `surname` | No | Sort order applied by Companies House. |

### `get_ownership`

List the persons with significant control (PSCs) recorded for a UK company — the individuals, corporate entities and legal persons that own or control it — with natures of control, notified date and ceased date. Ceased PSCs stay on the register and are returned alongside current ones, clearly marked. When no PSC is recorded the response explains why, distinguishing a market-listing exemption or a filed statement from a genuine gap.

CLI: `ch ownership`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 25). Default `25`. |
| `start_index` | number | No | Zero-based offset into the list. Use the value suggested by the previous response. Default `0`. |

## Filings and documents

### `download_filing_document`

Retrieve the document filed for a Companies House filing and return it to you directly — PDF and other binary formats as an embedded binary resource, XHTML, XML and JSON as text. Reads the document metadata first, so it reports the available formats, page count and exact size, and refuses oversized content before transferring it. Get the document id from get_filings. Set metadata_only to inspect a document without retrieving it. The document is returned to you; this tool does not write files.

CLI: `ch document`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `document_id` | string | Yes | Document id from a filing. get_filings and get_filing_document report it as "Document ID". A full `links.document_metadata` URL or a `/document/{id}` path is also accepted. |
| `format` | `pdf` \| `xhtml` \| `xml` \| `json` | No | Preferred content type. Most filings exist only as pdf; modern accounts may also be held as xhtml (iXBRL). If the requested format is not held, the response lists what is and returns nothing. Default `pdf`. |
| `max_bytes` | number | No | Refuse to return content larger than this many bytes (default 131072, hard maximum 26214400). Checked against the document metadata and the response length before anything is buffered. Default `131072`. |
| `metadata_only` | boolean | No | Return only the document metadata — available formats, sizes and page count — without transferring the document. Default `false`. |

### `get_filing_document`

Read the full detail of one filing by its transaction id: description, date, category, type, page count and the document id needed to retrieve the document itself. This returns the filing record, not the filed document — use download_filing_document for the document.

CLI: `ch filing`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |
| `transaction_id` | string | Yes | Transaction id of a single filing, taken from get_filings results. |

### `get_filings`

Read a company's filing history: accounts, confirmation statements, officer changes, charge registrations, resolutions and everything else it has filed. Each entry carries a transaction id and, where a scanned or rendered document exists, a document id. Pass that document id to download_filing_document to retrieve the document itself.

CLI: `ch filings`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |
| `category` | string | No | Restrict to one filing category: accounts, address, annual-return, capital, change-of-name, confirmation-statement, incorporation, insolvency, liquidation, miscellaneous, mortgage, officers, persons-with-significant-control, resolution. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 25). Default `25`. |
| `start_index` | number | No | Zero-based offset into the list. Use the value suggested by the previous response. Default `0`. |

## Combined summaries

### `company_report`

Read the main Companies House records for one company in a single call: profile, officers currently in post, persons with significant control, charges, the most recent filings and any insolvency record. The report states how much of each list it retrieved and what the register does not cover. Use this as the starting point for company research, then use the individual tools for anything the report shows is incomplete.

CLI: `ch report`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `due_diligence_check`

Screen one company against what is recorded on the Companies House public register and report the entries a reviewer would want to look at: register status and status detail, insolvency records, outstanding charges, overdue accounts and confirmation statements, registered office disputes, officer changes, ownership records and company age. It reports observations drawn from filed data, together with the checks it ran and the checks it could not run. It is not a verification, credit check, sanctions or politically-exposed-person screening, or a clearance decision, and it never concludes that a company is sound.

CLI: `ch check`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company_number` | string | Yes | Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name. |

### `officer_network`

Map every company one officer id is or was appointed to, split into current and past appointments with each company's status. Pages through the full appointment list rather than showing only the first page. Prefer officer_id: a name is only accepted when it matches exactly one officer, because officer names are not unique and picking the wrong match produces a confidently wrong network. Appointments are grouped by Companies House officer id, so one individual may hold more than one.

CLI: `ch network`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `officer_id` | string | No | Officer id from search_officers. Preferred — provide this or officer_name. |
| `officer_name` | string | No | Officer name to look up. Only used when officer_id is not given, and only accepted when the name matches exactly one officer. |
| `items_per_page` | number | No | Records to return in one page (1–100, default 100). Default `100`. |

## What the register does not tell you

Companies House records what companies file. It carries out basic completeness checks but does not verify that the information is accurate, so nothing these tools return is a verification, a credit check, a sanctions or politically-exposed-person screening, or a clearance decision.

The register also does not cover trading performance, litigation, or beneficial ownership held outside the persons-with-significant-control regime. Identity verification for existing directors and PSCs is still being rolled out under the Economic Crime and Corporate Transparency Act, so a name on the register does not mean the person behind it has been identity-checked.
