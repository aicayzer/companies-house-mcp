import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { APIClient, CompaniesHouseAPIError } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';
import { textOf } from '../../helpers.js';

import '../../../src/tools/all.js';

const MOCK_PROFILE = {
  company_name: 'ACME LTD',
  company_number: '12345678',
  company_status: 'active',
  type: 'ltd',
  date_of_creation: '2020-01-01',
  registered_office_address: {
    address_line_1: '1 Test St',
    locality: 'London',
    postal_code: 'EC1A 1BB',
  },
  sic_codes: ['62011'],
  accounts: { next_accounts: { due_on: '2026-09-30', overdue: false } },
  confirmation_statement: { overdue: false },
  links: {
    self: '/company/12345678',
    charges: '/company/12345678/charges',
    filing_history: '/company/12345678/filing-history',
    officers: '/company/12345678/officers',
    persons_with_significant_control: '/company/12345678/persons-with-significant-control',
  },
};

const MOCK_OFFICERS = {
  items: [
    {
      name: 'SMITH, John',
      officer_role: 'director',
      appointed_on: '2020-01-01',
      nationality: 'British',
    },
    {
      name: 'DOE, Jane',
      officer_role: 'secretary',
      appointed_on: '2020-06-01',
      resigned_on: '2023-01-01',
    },
  ],
  total_results: 2,
  active_count: 1,
  resigned_count: 1,
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
  active_count: 1,
  ceased_count: 0,
  items_per_page: 25,
  kind: 'persons-with-significant-control#list',
  start_index: 0,
};

const MOCK_CHARGES = {
  items: [
    {
      status: 'outstanding',
      classification: { description: 'Debenture', type: 'charge' },
      created_on: '2021-01-01',
    },
    {
      status: 'fully-satisfied',
      classification: { description: 'Mortgage', type: 'charge' },
      created_on: '2019-01-01',
      satisfied_on: '2022-01-01',
    },
  ],
  total_count: 2,
  satisfied_count: 1,
  part_satisfied_count: 0,
  unfiltered_count: 2,
};

const MOCK_FILINGS = {
  items: [
    {
      transaction_id: 'txn1',
      date: '2024-01-15',
      type: 'AA',
      description: 'Annual accounts',
      category: 'accounts',
    },
    {
      transaction_id: 'txn2',
      date: '2024-03-01',
      type: 'CS01',
      description: 'Confirmation statement',
      category: 'confirmation-statement',
    },
  ],
  total_count: 2,
  items_per_page: 25,
  kind: 'filing-history',
  start_index: 0,
};

const MOCK_SEARCH = {
  items: [
    {
      title: 'ACME LTD',
      company_number: '12345678',
      company_status: 'active',
      company_type: 'ltd',
      date_of_creation: '2020-01-01',
    },
    {
      title: 'ACME PLC',
      company_number: '00000002',
      company_status: 'dissolved',
      company_type: 'plc',
    },
  ],
  total_results: 2,
  items_per_page: 20,
  kind: 'search#companies',
  start_index: 0,
};

const MOCK_OFFICER_SEARCH = {
  items: [
    {
      title: 'SMITH, John',
      appointment_count: 3,
      links: { self: '/officers/abc123/appointments' },
    },
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
      appointed_to: {
        company_number: '12345678',
        company_name: 'ACME LTD',
        company_status: 'active',
      },
    },
    {
      officer_role: 'director',
      appointed_on: '2018-01-01',
      resigned_on: '2022-01-01',
      appointed_to: {
        company_number: '99999999',
        company_name: 'OLD CO LTD',
        company_status: 'dissolved',
      },
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
      throw new CompaniesHouseAPIError('Not found', 404, path);
    }
    if (path.match(/persons-with-significant-control-statements/)) {
      throw new CompaniesHouseAPIError('Not found', 404, path);
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
    expect(textOf(result)).toContain('ACME LTD');
    expect(textOf(result)).toContain('ACME PLC');
    expect(textOf(result)).toContain('Found 2 companies');
    expect(result.structuredContent).toBeDefined();
  });

  it('get_company_profile returns formatted profile', async () => {
    const tool = getTool('get_company_profile')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ACME LTD');
    expect(textOf(result)).toContain('Active');
    expect(textOf(result)).toContain('Private Limited Company');
    expect(textOf(result)).toContain('62011');
  });

  it('get_officers filters resigned by default', async () => {
    const tool = getTool('get_officers')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('SMITH, John');
    expect(textOf(result)).not.toContain('DOE, Jane'); // resigned, filtered out
  });

  it('get_officers includes resigned when requested', async () => {
    const tool = getTool('get_officers')!;
    const result = await tool.execute(client, {
      company_number: '12345678',
      include_resigned: true,
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('SMITH, John');
    expect(textOf(result)).toContain('DOE, Jane');
  });

  it('get_ownership shows PSCs with control descriptions', async () => {
    const tool = getTool('get_ownership')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('SMITH, John');
    expect(textOf(result)).toContain('75-100%');
  });

  it('get_filings returns filing history', async () => {
    const tool = getTool('get_filings')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Annual accounts');
    expect(textOf(result)).toContain('Confirmation statement');
  });

  it('get_charges returns charge data', async () => {
    const tool = getTool('get_charges')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Debenture');
    expect(textOf(result)).toContain('outstanding');
  });

  it('get_insolvency handles empty cases', async () => {
    const tool = getTool('get_insolvency')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('No insolvency');
  });

  it('search_officers returns results', async () => {
    const tool = getTool('search_officers')!;
    const result = await tool.execute(client, { query: 'Smith' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('SMITH, John');
    expect(textOf(result)).toContain('abc123');
  });

  it('get_appointments returns officer appointments', async () => {
    const tool = getTool('get_appointments')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ACME LTD');
    expect(textOf(result)).toContain('OLD CO LTD');
    expect(textOf(result)).toContain('John SMITH');
  });

  it('company_report covers every section and states its coverage', async () => {
    const tool = getTool('company_report')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);

    expect(text).toContain('ACME LTD');
    expect(text).toContain('Officers currently in post');
    expect(text).toContain('Ownership');
    expect(text).toContain('Charges');
    expect(text).toContain('Most recent filings');
    expect(text).toContain('Insolvency');
    expect(text).toContain('Coverage');

    expect(result.structuredContent?.profile).toBeDefined();
    expect(result.structuredContent?.officers).toBeDefined();
    expect(result.structuredContent?.pscs).toBeDefined();
    expect(result.structuredContent?.coverage).toBeDefined();
  });

  it('company_report states what the register does not establish', async () => {
    const text = textOf(
      await getTool('company_report')!.execute(client, { company_number: '12345678' })
    );
    expect(text).toContain('What this does not tell you');
    expect(text).toContain('does not verify');
  });

  it('company_report skips sub-resources the profile does not link to', async () => {
    const result = await getTool('company_report')!.execute(client, { company_number: '12345678' });
    // The mock profile links to charges but not insolvency, so insolvency is
    // reported as absent without a request that would 404.
    const paths = vi.mocked(client.get).mock.calls.map(([path]) => path as string);
    expect(paths.some(path => path.includes('/charges'))).toBe(true);
    expect(paths.some(path => path.includes('/insolvency'))).toBe(false);
    expect(textOf(result)).toContain('No insolvency history is recorded');
  });

  it('due_diligence_check reports observations, checks and limitations', async () => {
    const tool = getTool('due_diligence_check')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();

    const text = textOf(result);
    expect(text).toContain('Public register screening');
    expect(text).toContain('Checks performed');
    expect(text).toContain('What this does not tell you');

    const observations = result.structuredContent?.observations as Array<{ category: string }>;
    expect(observations.some(o => o.category === 'Charges')).toBe(true);
    expect(observations.some(o => o.category === 'Officers')).toBe(true);
    expect(result.structuredContent?.checks_performed).toBeDefined();
    expect(result.structuredContent?.observation_counts).toBeDefined();
  });

  it('due_diligence_check never presents a verdict about the company', async () => {
    const text = textOf(
      await getTool('due_diligence_check')!.execute(client, { company_number: '12345678' })
    ).toLowerCase();

    // Verdict language, not the word "clearance" in the disclaimer that
    // explicitly denies giving one.
    const forbidden = [
      /good standing/,
      /risk level/,
      /\bno red flags\b/,
      /\brisk[:\s]+(high|medium|low|clear)\b/,
      /appears to be (sound|safe|legitimate|in good)/,
      /\bcleared\b/,
      /\bwe verified\b/,
    ];
    for (const pattern of forbidden) {
      expect(text, `output should not match ${pattern}`).not.toMatch(pattern);
    }

    // And it must actively say what it is not.
    expect(text).toContain('not a verification');
  });

  it('due_diligence_check counts outstanding charges from the aggregate totals', async () => {
    const result = await getTool('due_diligence_check')!.execute(client, {
      company_number: '12345678',
    });
    const observations = result.structuredContent?.observations as Array<{ detail: string }>;
    // 2 charges, 1 satisfied, 0 part-satisfied leaves 1 outstanding.
    expect(observations.some(o => o.detail.startsWith('1 outstanding charge'))).toBe(true);
  });

  it('officer_network maps appointments by id', async () => {
    const tool = getTool('officer_network')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('Appointments for');
    expect(text).toContain('ACME LTD');
    expect(text).toContain('OLD CO LTD');
    expect(result.structuredContent?.current_count).toBe(1);
    expect(result.structuredContent?.past_count).toBe(1);
  });

  it('officer_network resolves an unambiguous name', async () => {
    const result = await getTool('officer_network')!.execute(client, { officer_name: 'Smith' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Appointments for');
    expect(result.structuredContent?.officer_id).toBe('abc123');
  });

  it('get_officer_disqualifications reports an empty register without claiming clearance', async () => {
    const tool = getTool('get_officer_disqualifications')!;
    const result = await tool.execute(client, { officer_id: 'abc123' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('No disqualification is recorded');
    expect(text).toContain('not a confirmation');
  });

  it('get_uk_establishments handles empty list', async () => {
    const tool = getTool('get_uk_establishments')!;
    const result = await tool.execute(client, { company_number: '12345678' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('No UK establishments');
  });
});
