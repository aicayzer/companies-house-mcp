/**
 * The adverse and degraded paths through the composite summaries.
 *
 * These tools carry the product's truthfulness burden, so the branches that
 * only fire for a company in trouble — and the ones that fire when a request
 * fails — need coverage as much as the happy path does.
 */

import { describe, it, expect, vi } from 'vitest';
import { APIClient, CompaniesHouseAPIError } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';
import { textOf } from '../../helpers.js';

import '../../../src/tools/all.js';

type Overrides = Partial<Record<string, unknown>>;

interface Scenario {
  profile?: Overrides;
  officers?: Overrides | Error;
  pscs?: Overrides | Error;
  charges?: Overrides | Error;
  insolvency?: Overrides | Error;
  filings?: Overrides | Error;
  exemptions?: Overrides;
  statements?: Overrides;
}

const BASE_PROFILE = {
  company_name: 'ACME LTD',
  company_number: '12345678',
  company_status: 'active',
  type: 'ltd',
  date_of_creation: '2010-01-01',
  links: { self: '/company/12345678' },
};

const EMPTY_OFFICERS = {
  items: [],
  total_results: 0,
  active_count: 0,
  resigned_count: 0,
  items_per_page: 100,
  start_index: 0,
  kind: 'officer-list',
};

const EMPTY_PSCS = {
  items: [],
  total_results: 0,
  active_count: 0,
  ceased_count: 0,
  items_per_page: 50,
  start_index: 0,
  kind: 'psc-list',
};

function clientFor(scenario: Scenario): APIClient {
  const client = new APIClient({ api_key: 'test', cache_enabled: false });
  const profile = { ...BASE_PROFILE, ...(scenario.profile ?? {}) };

  const resolve = (value: Overrides | Error | undefined, fallback: unknown) => {
    if (value instanceof Error) throw value;
    return { ...(fallback as object), ...(value ?? {}) };
  };

  vi.spyOn(client, 'get').mockImplementation(async (path: string) => {
    if (path.includes('persons-with-significant-control-statements')) {
      return resolve(scenario.statements, { items: [], total_results: 0 }) as never;
    }
    if (path.includes('/exemptions')) {
      return resolve(scenario.exemptions, { exemptions: {} }) as never;
    }
    if (path.includes('persons-with-significant-control')) {
      return resolve(scenario.pscs, EMPTY_PSCS) as never;
    }
    if (path.includes('/officers')) return resolve(scenario.officers, EMPTY_OFFICERS) as never;
    if (path.includes('/charges')) {
      return resolve(scenario.charges, { items: [], total_count: 0, satisfied_count: 0 }) as never;
    }
    if (path.includes('/insolvency')) return resolve(scenario.insolvency, { cases: [] }) as never;
    if (path.includes('/filing-history')) {
      return resolve(scenario.filings, { items: [], total_count: 0 }) as never;
    }
    if (/\/company\/[^/]+$/.test(path)) return profile as never;
    throw new CompaniesHouseAPIError('Unexpected path', 500, path);
  });
  return client;
}

async function screen(scenario: Scenario) {
  const result = await getTool('due_diligence_check')!.execute(clientFor(scenario), {
    company_number: '12345678',
  });
  return {
    text: textOf(result),
    observations: (result.structuredContent?.observations ?? []) as Array<{
      category: string;
      severity: string;
      detail: string;
    }>,
    checks: (result.structuredContent?.checks_performed ?? []) as Array<{
      check: string;
      status: string;
    }>,
    coverage: (result.structuredContent?.coverage ?? []) as Array<{
      resource: string;
      status: string;
    }>,
    incomplete: result.structuredContent?.checks_incomplete,
  };
}

describe('due_diligence_check adverse findings', () => {
  it.each([
    ['dissolved', 'Dissolved'],
    ['liquidation', 'In Liquidation'],
    ['administration', 'In Administration'],
    ['receivership', 'In Receivership'],
    ['insolvency-proceedings', 'Insolvency Proceedings'],
  ])('raises a higher-significance entry for a company in %s', async (status, label) => {
    const { observations } = await screen({ profile: { company_status: status } });
    const entry = observations.find(o => o.category === 'Register status');
    expect(entry).toBeDefined();
    expect(entry!.severity).toBe('high');
    expect(entry!.detail).toContain(label);
  });

  it('treats a voluntary arrangement as moderate rather than higher', async () => {
    const { observations } = await screen({ profile: { company_status: 'voluntary-arrangement' } });
    expect(observations.find(o => o.category === 'Register status')!.severity).toBe('medium');
  });

  // A company can be `active` and simultaneously being struck off, which is
  // the case a status-only check misses entirely.
  it('raises a strike-off proposal on an otherwise active company', async () => {
    const { observations, text } = await screen({
      profile: { company_status_detail: 'active-proposal-to-strike-off' },
    });
    const entry = observations.find(o => o.detail.includes('strike off'));
    expect(entry?.severity).toBe('high');
    expect(text).toContain('proposal to strike off');
  });

  it('reports insolvency cases with their type', async () => {
    const { observations } = await screen({
      profile: { links: { self: '/x', insolvency: '/x/insolvency' } },
      insolvency: { cases: [{ type: 'in-administration' }, { type: 'creditors-voluntary' }] },
    });
    const entry = observations.find(o => o.category === 'Insolvency');
    expect(entry?.severity).toBe('high');
    expect(entry?.detail).toContain('2 insolvency case');
    expect(entry?.detail).toContain('in-administration');
  });

  it('reads overdue accounts from the current field, not the deprecated one', async () => {
    const { observations } = await screen({
      profile: { accounts: { next_accounts: { overdue: true, due_on: '2026-01-31' } } },
    });
    const entry = observations.find(o => o.category === 'Accounts');
    expect(entry?.severity).toBe('high');
    expect(entry?.detail).toContain('31 January 2026');
  });

  it('reports an overdue confirmation statement', async () => {
    const { observations } = await screen({
      profile: { confirmation_statement: { overdue: true, next_due: '2025-12-09' } },
    });
    expect(observations.find(o => o.category === 'Confirmation statement')?.severity).toBe(
      'medium'
    );
  });

  it('reports outstanding and part-satisfied charges separately', async () => {
    const { observations } = await screen({
      profile: { links: { self: '/x', charges: '/x/charges' } },
      charges: { items: [], total_count: 22, satisfied_count: 3, part_satisfied_count: 1 },
    });
    const outstanding = observations.find(o => o.detail.startsWith('18 outstanding'));
    const part = observations.find(o => o.detail.includes('part-satisfied'));
    expect(outstanding?.severity).toBe('medium');
    expect(part?.severity).toBe('low');
  });

  it.each([
    ['registered_office_is_in_dispute', 'in dispute'],
    ['undeliverable_registered_office_address', 'undeliverable'],
  ])('reports the registered office flag %s', async (flag, phrase) => {
    const { observations } = await screen({ profile: { [flag]: true } });
    const entry = observations.find(o => o.category === 'Registered office');
    expect(entry?.detail).toContain(phrase);
  });

  it('reports an active company with nobody in post', async () => {
    const { observations } = await screen({});
    const entry = observations.find(
      o => o.category === 'Officers' && o.detail.includes('No officers are currently in post')
    );
    expect(entry?.severity).toBe('high');
  });

  it('reports officers who resigned recently', async () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const { observations } = await screen({
      officers: {
        items: [
          { name: 'A', officer_role: 'director' },
          { name: 'B', officer_role: 'director', resigned_on: recent.toISOString().slice(0, 10) },
        ],
        total_results: 2,
        active_count: 1,
        resigned_count: 1,
      },
    });
    expect(observations.some(o => o.detail.includes('resigned in the last six months'))).toBe(true);
  });

  it('notes a sole officer as contextual, not as a concern', async () => {
    const { observations } = await screen({
      officers: {
        items: [{ name: 'A', officer_role: 'director' }],
        total_results: 1,
        active_count: 1,
        resigned_count: 0,
      },
    });
    expect(
      observations.find(o => o.detail.includes('One officer currently in post'))?.severity
    ).toBe('low');
  });

  it('notes a very young company as contextual', async () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const { observations } = await screen({
      profile: { date_of_creation: recent.toISOString().slice(0, 10) },
    });
    expect(observations.find(o => o.category === 'Company age')?.severity).toBe('low');
  });

  it('reports every ceased PSC on an active company', async () => {
    const { observations } = await screen({
      pscs: {
        items: [{ name: 'Former Owner', kind: 'individual', ceased_on: '2024-01-01' }],
        total_results: 1,
        active_count: 0,
        ceased_count: 1,
      },
    });
    expect(
      observations.some(o => o.detail.includes('Every PSC entry on the register has ceased'))
    ).toBe(true);
  });
});

describe('due_diligence_check when a request fails', () => {
  const failure = new CompaniesHouseAPIError(
    'Companies House is temporarily unavailable.',
    503,
    '/x'
  );

  it('says which check it could not perform rather than silently skipping it', async () => {
    const { text, checks, incomplete } = await screen({ officers: failure });

    const officers = checks.find(check => check.check === 'Officers');
    expect(officers?.status).toBe('unavailable');
    expect(text).toContain('**not performed**');
    expect(text).toContain('check(s) could not be performed');
    expect(incomplete).toBe(true);
  });

  it('distinguishes a failed request from a record that does not exist', async () => {
    // These mean opposite things: one is "we do not know", the other is
    // "the register has nothing".
    const failed = await screen({ pscs: failure });
    const absent = await screen({});

    expect(failed.coverage.find(c => c.resource.startsWith('Persons'))?.status).toBe('unavailable');
    expect(absent.coverage.find(c => c.resource.startsWith('Persons'))?.status).toBe(
      'not-applicable'
    );
  });

  it('still produces a usable summary when several requests fail', async () => {
    const { text, incomplete } = await screen({
      officers: failure,
      pscs: failure,
      charges: failure,
    });
    expect(text).toContain('Public register screening');
    expect(incomplete).toBe(true);
  });
});

describe('company_report when a request fails', () => {
  async function report(scenario: Scenario) {
    const result = await getTool('company_report')!.execute(clientFor(scenario), {
      company_number: '12345678',
    });
    return {
      text: textOf(result),
      coverage: (result.structuredContent?.coverage ?? []) as Array<{
        resource: string;
        status: string;
      }>,
    };
  }

  const failure = new CompaniesHouseAPIError('Upstream failure', 503, '/x');

  it('reports an unavailable section without failing the whole report', async () => {
    const { text, coverage } = await report({ officers: failure });

    expect(text).toContain('Officer records could not be retrieved');
    expect(text).toContain('Ownership');
    expect(coverage.find(entry => entry.resource === 'Officers')?.status).toBe('unavailable');
  });

  it('fails the whole call only when the company profile itself cannot be read', async () => {
    const client = new APIClient({ api_key: 'test', cache_enabled: false });
    vi.spyOn(client, 'get').mockRejectedValue(new CompaniesHouseAPIError('No record', 404, '/x'));

    const result = await getTool('company_report')!.execute(client, { company_number: '12345678' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Could not read the company profile');
  });
});

describe('empty pages', () => {
  it.each([
    ['get_filings', { company_number: '12345678', start_index: 9000 }, 'filings'],
    ['get_ownership', { company_number: '12345678', start_index: 100 }, 'persons with significant'],
    ['get_charges', { company_number: '12345678', start_index: 50 }, 'charges'],
  ])(
    '%s says where the caller is rather than that nothing exists',
    async (tool, params, phrase) => {
      const client = clientFor({
        pscs: { items: [], total_results: 4, active_count: 1, ceased_count: 3 },
        charges: { items: [], total_count: 9, satisfied_count: 7, part_satisfied_count: 0 },
        filings: { items: [], total_count: 8355 },
        profile: { links: { self: '/x', charges: '/x/charges' } },
      });

      const text = textOf(await getTool(tool)!.execute(client, params));
      expect(text).toContain(phrase);
      expect(text).toContain('offset');
      // The register total must appear, so the caller knows records exist.
      expect(text).toMatch(/This company has \d+ on the register/);
    }
  );

  it('does not claim a company has no officers when the offset is past the end', async () => {
    const client = clientFor({
      officers: { items: [], total_results: 0, active_count: 0, resigned_count: 0 },
    });
    const text = textOf(
      await getTool('get_officers')!.execute(client, {
        company_number: '12345678',
        include_resigned: true,
        start_index: 500,
      })
    );

    expect(text).not.toContain('0 on the register');
    expect(text).toContain('offset 500');
  });
});
