import { describe, it, expect, vi } from 'vitest';
import { APIClient, CompaniesHouseAPIError } from '../../../src/api/client.js';
import { explainAbsentPSCs } from '../../../src/tools/ownership.js';
import { describeAbsentPSCs } from '../../../src/tools/psc-explanation.js';
import { getTool } from '../../../src/tools/registry.js';
import { textOf } from '../../helpers.js';

import '../../../src/tools/all.js';

const NOW = new Date('2026-08-04T00:00:00Z');

interface Fixture {
  exemptions?: Record<string, { exemption_type?: string; items?: Array<Record<string, string>> }>;
  statements?: Array<{ statement: string; ceased_on?: string }>;
  exemptionsFail?: boolean;
  statementsFail?: boolean;
}

function clientFor({ exemptions, statements, exemptionsFail, statementsFail }: Fixture): APIClient {
  const client = new APIClient({ api_key: 'test', cache_enabled: false });
  vi.spyOn(client, 'get').mockImplementation(async (path: string) => {
    if (path.includes('persons-with-significant-control-statements')) {
      if (statementsFail) throw new CompaniesHouseAPIError('Not found', 404, path);
      return { items: statements ?? [], total_results: (statements ?? []).length } as never;
    }
    if (path.includes('/exemptions')) {
      if (exemptionsFail) throw new CompaniesHouseAPIError('Not found', 404, path);
      return { exemptions: exemptions ?? {} } as never;
    }
    if (path.includes('persons-with-significant-control')) {
      return { items: [], total_results: 0, active_count: 0, ceased_count: 0 } as never;
    }
    throw new CompaniesHouseAPIError('Unexpected path', 500, path);
  });
  return client;
}

const CURRENT_UK_EXEMPTION = {
  psc_exempt_as_trading_on_uk_regulated_market: {
    exemption_type: 'psc-exempt-as-trading-on-uk-regulated-market',
    items: [{ exempt_from: '2018-06-18' }],
  },
};

const EXPIRED_UK_EXEMPTION = {
  psc_exempt_as_trading_on_uk_regulated_market: {
    exemption_type: 'psc-exempt-as-trading-on-uk-regulated-market',
    items: [{ exempt_from: '2018-06-28', exempt_to: '2022-06-28' }],
  },
};

const NO_PSC_STATEMENT = [{ statement: 'no-individual-or-entity-with-signficant-control' }];

describe('explainAbsentPSCs', () => {
  it('treats an exemption with no end date as in force', async () => {
    const result = await explainAbsentPSCs(
      clientFor({ exemptions: CURRENT_UK_EXEMPTION }),
      '1',
      NOW
    );
    expect(result.exempt).toBe(true);
    expect(result.expired_exemptions).toEqual([]);
  });

  // The failure this guards against: a company that lost its exemption and
  // stopped filing being presented as legitimately exempt.
  it('does not treat an exemption that has ended as in force', async () => {
    const result = await explainAbsentPSCs(
      clientFor({ exemptions: EXPIRED_UK_EXEMPTION }),
      '1',
      NOW
    );
    expect(result.exempt).toBe(false);
    expect(result.expired_exemptions).toHaveLength(1);
    expect(result.expired_exemptions[0]!.exempt_to).toBe('2022-06-28');
  });

  it('recognises the EU regulated-market exemption key', async () => {
    const result = await explainAbsentPSCs(
      clientFor({
        exemptions: {
          psc_exempt_as_trading_on_eu_regulated_market: {
            exemption_type: 'psc-exempt-as-trading-on-eu-regulated-market',
            items: [{ exempt_from: '2021-09-30' }],
          },
        },
      }),
      '1',
      NOW
    );
    expect(result.exempt).toBe(true);
    expect(result.exemption_types).toEqual(['psc-exempt-as-trading-on-eu-regulated-market']);
  });

  it('reports a company that moved between exemption keys as still exempt', async () => {
    const result = await explainAbsentPSCs(
      clientFor({
        exemptions: {
          psc_exempt_as_trading_on_regulated_market: {
            exemption_type: 'psc-exempt-as-trading-on-regulated-market',
            items: [{ exempt_from: '2018-09-30', exempt_to: '2021-09-30' }],
          },
          psc_exempt_as_trading_on_eu_regulated_market: {
            exemption_type: 'psc-exempt-as-trading-on-eu-regulated-market',
            items: [{ exempt_from: '2021-09-30' }],
          },
        },
      }),
      '1',
      NOW
    );
    expect(result.exempt).toBe(true);
    expect(result.exemption_types).toEqual(['psc-exempt-as-trading-on-eu-regulated-market']);
    expect(result.expired_exemptions).toHaveLength(1);
  });

  it('ignores exemptions that have nothing to do with PSCs', async () => {
    const result = await explainAbsentPSCs(
      clientFor({
        exemptions: {
          disclosure_transparency_rules_chapter_five_applies: {
            exemption_type: 'disclosure-transparency-rules-chapter-five-applies',
            items: [{ exempt_from: '2017-06-07' }],
          },
        },
      }),
      '1',
      NOW
    );
    expect(result.exempt).toBe(false);
    expect(result.exemptions).toEqual([]);
  });

  it('separates a withdrawn statement from a live one', async () => {
    const result = await explainAbsentPSCs(
      clientFor({
        statements: [
          { statement: 'no-individual-or-entity-with-signficant-control', ceased_on: '2024-01-01' },
        ],
      }),
      '1',
      NOW
    );
    expect(result.statements).toHaveLength(1);
    expect(result.active_statements).toHaveLength(0);
  });

  it('copes when the exemptions and statements records do not exist', async () => {
    const result = await explainAbsentPSCs(
      clientFor({ exemptionsFail: true, statementsFail: true }),
      '1',
      NOW
    );
    expect(result).toMatchObject({ exempt: false, statements: [], exemptions: [] });
  });
});

describe('describeAbsentPSCs', () => {
  async function narrate(fixture: Fixture) {
    return describeAbsentPSCs(await explainAbsentPSCs(clientFor(fixture), '1', NOW));
  }

  it('says a current exemption is current', async () => {
    const narrative = await narrate({ exemptions: CURRENT_UK_EXEMPTION });
    expect(narrative.lines.join('\n')).toContain('currently exempt');
    expect(narrative.unexplained).toBe(false);
  });

  it('says an ended exemption has ended, and does not call the company exempt', async () => {
    const narrative = await narrate({ exemptions: EXPIRED_UK_EXEMPTION });
    const text = narrative.lines.join('\n');

    expect(text).toContain('has ended');
    expect(text).toContain('it is not exempt now');
    expect(text).not.toMatch(/is recorded as currently exempt/);
  });

  it('still surfaces a filed statement when an exemption has ended', async () => {
    // The old behaviour branched exemption-else-statement, so an expired
    // exemption hid the statement that actually explained the empty register.
    const narrative = await narrate({
      exemptions: EXPIRED_UK_EXEMPTION,
      statements: NO_PSC_STATEMENT,
    });
    const text = narrative.lines.join('\n');

    expect(text).toContain('has ended');
    expect(text).toContain('knows of no individual or entity with significant control');
    expect(narrative.unexplained).toBe(false);
  });

  it('flags an ended exemption with nothing filed since as unexplained', async () => {
    const narrative = await narrate({ exemptions: EXPIRED_UK_EXEMPTION });
    expect(narrative.unexplained).toBe(true);
    expect(narrative.coverageNote).toContain('exemption ended');
  });

  it('flags an entirely empty register as unexplained', async () => {
    const narrative = await narrate({});
    expect(narrative.unexplained).toBe(true);
    expect(narrative.lines.join('\n')).toContain('absence of data');
  });
});

describe('due_diligence_check ownership observations', () => {
  function activeCompanyClient(fixture: Fixture): APIClient {
    const client = clientFor(fixture);
    const inner = vi.mocked(client.get).getMockImplementation()!;
    vi.mocked(client.get).mockImplementation(
      async (path: string, params?: Record<string, string | number | undefined>) => {
        if (/\/company\/[^/]+$/.test(path)) {
          return {
            company_name: 'ACME LTD',
            company_number: '12345678',
            company_status: 'active',
            type: 'ltd',
            links: { self: '/company/12345678' },
          } as never;
        }
        if (path.includes('/officers')) {
          return {
            items: [],
            total_results: 0,
            active_count: 0,
            resigned_count: 0,
            items_per_page: 100,
            start_index: 0,
            kind: 'officer-list',
          } as never;
        }
        return inner(path, params) as never;
      }
    );
    return client;
  }

  async function observations(fixture: Fixture) {
    const result = await getTool('due_diligence_check')!.execute(activeCompanyClient(fixture), {
      company_number: '12345678',
    });
    return {
      list: result.structuredContent?.observations as Array<{ category: string; detail: string }>,
      text: textOf(result),
    };
  }

  it('raises nothing about ownership for a currently exempt company', async () => {
    const { list } = await observations({ exemptions: CURRENT_UK_EXEMPTION });
    expect(list.some(o => o.category === 'Ownership')).toBe(false);
  });

  it('raises nothing about ownership when a live statement explains the absence', async () => {
    const { list } = await observations({ statements: NO_PSC_STATEMENT });
    expect(list.some(o => o.category === 'Ownership')).toBe(false);
  });

  it('raises an ownership observation when the exemption has lapsed', async () => {
    const { list } = await observations({ exemptions: EXPIRED_UK_EXEMPTION });
    const ownership = list.find(o => o.category === 'Ownership');
    expect(ownership).toBeDefined();
    expect(ownership!.detail).toContain('has ended');
  });

  it('raises an ownership observation when nothing at all is recorded', async () => {
    const { list } = await observations({});
    expect(list.some(o => o.category === 'Ownership')).toBe(true);
  });
});
