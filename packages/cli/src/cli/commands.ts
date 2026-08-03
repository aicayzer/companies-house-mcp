/**
 * The CLI command table.
 *
 * Every registered MCP tool has a command, so `ch` and the MCP server expose
 * the same capability set. Each entry only declares the human-facing shape —
 * the command name, which tool it calls, which parameters are positional, and
 * short flag aliases. Everything else, including the full flag list and its
 * help text, is derived from the tool's own input schema.
 */

export interface CommandDefinition {
  name: string;
  tool: string;
  summary: string;
  /** Tool parameters supplied positionally, in order. */
  positionals: string[];
  /** Short flag aliases, mapping alias to the tool parameter name. */
  aliases?: Record<string, string>;
  examples: string[];
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'search',
    tool: 'search_companies',
    summary: 'Find companies by name',
    positionals: ['query'],
    aliases: { '--limit': 'items_per_page', '--start': 'start_index', '--status': 'company_status', '--type': 'company_type', '--sic': 'sic_codes' },
    examples: ['ch search "Tesco"', 'ch search "brewing" --status active --sic 11050'],
  },
  {
    name: 'search-officers',
    tool: 'search_officers',
    summary: 'Find officers by name across the register',
    positionals: ['query'],
    aliases: { '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch search-officers "Dario Amodei"'],
  },
  {
    name: 'profile',
    tool: 'get_company_profile',
    summary: 'Read a company record',
    positionals: ['company_number'],
    examples: ['ch profile 00445790'],
  },
  {
    name: 'officers',
    tool: 'get_officers',
    summary: 'List company officers',
    positionals: ['company_number'],
    aliases: { '--all': 'include_resigned', '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch officers 00445790', 'ch officers 00445790 --all'],
  },
  {
    name: 'appointments',
    tool: 'get_appointments',
    summary: "List one officer's appointments",
    positionals: ['officer_id'],
    aliases: { '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch appointments 8Ck-Qb_pB0eqUlnHNTjuoBoUmxQ'],
  },
  {
    name: 'ownership',
    tool: 'get_ownership',
    summary: 'List persons with significant control',
    positionals: ['company_number'],
    aliases: { '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch ownership 14604577'],
  },
  {
    name: 'filings',
    tool: 'get_filings',
    summary: 'Read filing history',
    positionals: ['company_number'],
    aliases: { '--category': 'category', '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch filings 00445790', 'ch filings 00445790 --category accounts'],
  },
  {
    name: 'filing',
    tool: 'get_filing_document',
    summary: 'Read one filing in detail',
    positionals: ['company_number', 'transaction_id'],
    examples: ['ch filing 14604577 MzUwMzIwMjQ5NGFkaXF6a2N4'],
  },
  {
    name: 'document',
    tool: 'download_filing_document',
    summary: 'Download the document behind a filing',
    positionals: ['document_id'],
    aliases: { '--out': 'save_to', '--format': 'format', '--info': 'metadata_only' },
    examples: [
      'ch document eeYoqJBWImTwDhRS2-qlLbqPPTGY7B0u9o40vDAuC9s --info',
      'ch document eeYoqJBWImTwDhRS2-qlLbqPPTGY7B0u9o40vDAuC9s --out ./accounts.pdf',
    ],
  },
  {
    name: 'charges',
    tool: 'get_charges',
    summary: 'List registered charges',
    positionals: ['company_number'],
    aliases: { '--limit': 'items_per_page', '--start': 'start_index' },
    examples: ['ch charges 00445790'],
  },
  {
    name: 'insolvency',
    tool: 'get_insolvency',
    summary: 'Read the insolvency record',
    positionals: ['company_number'],
    examples: ['ch insolvency SC311560'],
  },
  {
    name: 'registers',
    tool: 'get_company_registers',
    summary: 'Show where statutory registers are held',
    positionals: ['company_number'],
    examples: ['ch registers 00445790'],
  },
  {
    name: 'exemptions',
    tool: 'get_exemptions',
    summary: 'List disclosure exemptions',
    positionals: ['company_number'],
    examples: ['ch exemptions 00445790'],
  },
  {
    name: 'establishments',
    tool: 'get_uk_establishments',
    summary: 'List UK establishments of an overseas company',
    positionals: ['company_number'],
    examples: ['ch establishments FC013908'],
  },
  {
    name: 'disqualifications',
    tool: 'get_officer_disqualifications',
    summary: 'Check the disqualified directors register',
    positionals: ['officer_id'],
    aliases: { '--corporate': 'is_corporate' },
    examples: ['ch disqualifications 8Ck-Qb_pB0eqUlnHNTjuoBoUmxQ'],
  },
  {
    name: 'report',
    tool: 'company_report',
    summary: 'Read the main records for one company in one call',
    positionals: ['company_number'],
    examples: ['ch report 00445790', 'ch report 00445790 --md > tesco.md'],
  },
  {
    name: 'check',
    tool: 'due_diligence_check',
    summary: 'Screen a company against the public register',
    positionals: ['company_number'],
    examples: ['ch check SC311560'],
  },
  {
    name: 'network',
    tool: 'officer_network',
    summary: "Map an officer's appointments across companies",
    positionals: ['officer_name'],
    aliases: { '--id': 'officer_id', '--limit': 'items_per_page' },
    examples: ['ch network "Dario Amodei"', 'ch network --id 8Ck-Qb_pB0eqUlnHNTjuoBoUmxQ'],
  },
];
