import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { APIClient } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';

// Import tools to trigger registration
import '../../../src/tools/search.js';
import '../../../src/tools/company.js';
import '../../../src/tools/officers.js';
import '../../../src/tools/ownership.js';
import '../../../src/tools/filings.js';
import '../../../src/tools/financial.js';
import '../../../src/tools/extended.js';
import '../../../src/tools/composite.js';

const MOCK_PROFILE = {
  company_name: 'ACME LTD',
  company_number: '12345678',
  company_status: 'active',
  type: 'ltd',
  date_of_creation: '2020-01-01',
  registered_office_address: { address_line_1: '1 Test St', locality: 'London', postal_code: 'EC1A 1BB' },
  sic_codes: ['62011'],
  accounts: { overdue: false },
  confirmation_statement: { overdue: false },
  has_insolvency_history: false,
  has_charges: false,
};

const MOCK_OFFICERS = {
  items: [
    { name: 'SMITH, John', officer_role: 'director', appointed_on: '2020-01-01', nationality: 'British' },
    { name: 'DOE, Jane', officer_role: 'secretary', appointed_on: '2020-06-01', resigned_on: '2023-01-01' },
  ],
  total_results: 2,
  items_per_page: 50,
  kind: 'officer-list',
  start_index: 0,
};

const MOCK_PSCS = {
  items: [
    {
      name: 'SMITH, John',
      kind: 'individual-person-with-significant-control',
      natures_of_control: ['ownership-of-shares-75-to-100-percent'],
      notified_on: '2020-01-01',
    },
  ],
  total_results: 1,
  items_per_page: 25,
  kind: 'persons-with-significant-control#list',
  start_index: 0,
};

const MOCK_CHARGES = {
  items: [
    { status: 'outstanding', classification: { description: 'Debenture', type: 'charge' }, created_on: '2021-01-01' },
    { status: 'fully-satisfied', classification: { description: 'Mortgage', type: 'charge' }, created_on: '2019-01-01', satisfied_on: '2022-01-01' },
  ],
  total_count: 2,
};

const MOCK_FILINGS = {
  items: [
    { transaction_id: 'txn1', date: '2024-01-15', type: 'AA', description: 'Annual accounts', category: 'accounts' },
    { transaction_id: 'txn2', date: '2024-03-01', type: 'CS01', description: 'Confirmation statement', category: 'confirmation-statement' },
  ],
  total_count: 2,
  items_per_page: 25,
  kind: 'filing-history',
  start_index: 0,
};

const MOCK_SEARCH = {
  items: [
    { title: 'ACME LTD', company_number: '12345678', company_status: 'active', company_type: 'ltd', date_of_creation: '2020-01-01' },
    { title: 'ACME PLC', company_number: '00000002', company_status: 'dissolved', company_type: 'plc' },
  ],
  total_results: 2,
  items_per_page: 20,
  kind: 'search#companies',
  start_index: 0,
};

const MOCK_OFFICER_SEARCH = {
  items: [
    { title: 'SMITH, John', appointment_count: 3, links: { self: '/officers/abc123/appointments' } },
  ],
  total_results: 1,
  items_per_page: 20,
  kind: 'search#officers',
  start_index: 0,
};

const MOCK_APPOINTMENTS = {
  items: [
    {
      officer_role: 'director',
      appointed_on: '2020-01-01',
      appointed_to: { company_number: '12345678', company_name: 'ACME LTD', company_status: 'active' },
    },
    {
      officer_role: 'director',
      appointed_on: '2018-01-01',
      resigned_on: '2022-01-01',
      appointed_to: { company_number: '99999999', company_name: 'OLD CO LTD', company_status: 'dissolved' },
    },
  ],
  total_results: 2,
  name: 'John SMITH',
  items_per_page: 50,
  kind: 'officer-appointments',
  start_index: 0,
};

function createMockClient(): APIClient {
  const client = new APIClient({ api_key: 'test', cache_enabled: false });
  // Override the get method
  vi.spyOn(client, 'get').mockImplementation(async (path: string) => {
    if (path.includes('/search/companies')) return MOCK_SEARCH;
    if (path.includes('/search/officers')) return MOCK_OFFICER_SEARCH;
    if (path.match(/\/company\/[^/]+\/officers/)) return MOCK_OFFICERS;
    if (path.match(/\/company\/[^/]+\/persons-with-significant-control/)) return MOCK_PSCS;
    if (path.match(/\/company\/[^/]+\/charges/)) return MOCK_CHARGES;
    if (path.match(/\/company\/[^/]+\/filing-history/)) return MOCK_FILINGS;
    if (path.match(/\/company\/[^/]+\/insolvency/)) return { cases: [] };
    if (path.match(/\/company\/[^/]+\/registers/)) return { registers: {} };
    if (path.match(/\/company\/[^/]+\/exemptions/)) return { exemptions: {} };
    if (path.match(/\/company\/[^/]+\/uk-establishments/)) return { items: [] };
    if (path.match(/\/company\/[^/]+$/)) return MOCK_PROFILE;
    if (path.match(/\/officers\/[^/]+\/appointments/)) return MOCK_APPOINTMENTS;
    if (path.match(/\/disqualified-officers/)) {
      const error = new Error('Not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    throw new Error(`Unexpected path: ${path}`);
  });
  return client;
}

describe('Tool Execution (mocked)', () => {
  let client: APIClient;

  beforeAll(() => {
    client = createMockClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
  });

  it('search_companies returns formatted results', async () => {
    const tool = getTool('search_companies')!;
    const result = await tool.execute(client, { query: 'Acme' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('ACME LTD');
    expect(result.content[0]!.text).toContain('ACME PLC');
    expect(result.content[0]!.text).toContain('Found 2 companies');
    expect(result.structuredContent).toBeDefined();
  });

  it('get_company_profile returns formatted profile', async () => {
    const tool = getTool('get_company_profile')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('ACME LTD');
    expect(result.content[0]!.text).toContain('Active');
    expect(result.content[0]!.text).toContain('Private Limited Company');
    expect(result.content[0]!.text).toContain('62011');
  });

  it('get_officers filters resigned by default', async () => {
    const tool = getTool('get_officers')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('SMITH, John');
    expect(result.content[0]!.text).not.toContain('DOE, Jane'); // resigned, filtered out
  });

  it('get_officers includes resigned when requested', async () => {
    const tool = getTool('get_officers')!;
    const result = await tool.execute(client, { company_number: '12345678', include_resigned: true });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('SMITH, John');
    expect(result.content[0]!.text).toContain('DOE, Jane');
  });

  it('get_ownership shows PSCs with control descriptions', async () => {
    const tool = getTool('get_ownership')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('SMITH, John');
    expect(result.content[0]!.text).toContain('75-100%');
  });

  it('get_filings returns filing history', async () => {
    const tool = getTool('get_filings')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Annual accounts');
    expect(result.content[0]!.text).toContain('Confirmation statement');
  });

  it('get_charges returns charge data', async () => {
    const tool = getTool('get_charges')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Debenture');
    expect(result.content[0]!.text).toContain('outstanding');
  });

  it('get_insolvency handles empty cases', async () => {
    const tool = getTool('get_insolvency')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('No insolvency');
  });

  it('search_officers returns results', async () => {
    const tool = getTool('search_officers')!;
    const result = await tool.execute(client, { query: 'Smith' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('SMITH, John');
    expect(result.content[0]!.text).toContain('abc123');
  });

  it('get_appointments returns officer appointments', async () => {
    const tool = getTool('get_appointments')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('ACME LTD');
    expect(result.content[0]!.text).toContain('OLD CO LTD');
    expect(result.content[0]!.text).toContain('John SMITH');
  });

  it('company_report generates comprehensive report', async () => {
    const tool = getTool('company_report')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0]!.text;
    // Should contain all sections
    expect(text).toContain('ACME LTD');
    expect(text).toContain('Officers');
    expect(text).toContain('Ownership');
    expect(text).toContain('Charges');
    expect(text).toContain('Filings');
    expect(text).toContain('Insolvency');
    // Structured content
    expect(result.structuredContent?.profile).toBeDefined();
    expect(result.structuredContent?.officers).toBeDefined();
    expect(result.structuredContent?.pscs).toBeDefined();
  });

  it('due_diligence_check identifies risk flags', async () => {
    const tool = getTool('due_diligence_check')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Due Diligence Report');
    expect(result.structuredContent?.risk_level).toBeDefined();
    expect(result.structuredContent?.flags).toBeDefined();
    // Should flag: outstanding charges, sole director
    const flags = result.structuredContent?.flags as Array<{ category: string }>;
    expect(flags.some(f => f.category === 'Charges')).toBe(true);
    expect(flags.some(f => f.category === 'Officers')).toBe(true); // sole director
  });

  it('officer_network maps connections by ID', async () => {
    const tool = getTool('officer_network')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Officer Network');
    expect(result.content[0]!.text).toContain('ACME LTD');
    expect(result.content[0]!.text).toContain('OLD CO LTD');
    expect(result.structuredContent?.active_count).toBe(1);
    expect(result.structuredContent?.resigned_count).toBe(1);
  });

  it('officer_network maps connections by name', async () => {
    const tool = getTool('officer_network')!;
    const result = await tool.execute(client, { officer_name: 'Smith' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Officer Network');
  });

  it('get_officer_disqualifications handles 404 gracefully', async () => {
    const tool = getTool('get_officer_disqualifications')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('No disqualifications');
  });

  it('get_uk_establishments handles empty list', async () => {
    const tool = getTool('get_uk_establishments')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('No UK establishments');
  });
});
