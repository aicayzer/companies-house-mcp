import { describe, it, expect, vi } from 'vitest';
import { APIClient, CompaniesHouseAPIError } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';
import { normaliseCompanyNumber } from '../../../src/tools/shared.js';
import { chargeCounts, formatPagination } from '../../../src/formatters/index.js';
import { textOf } from '../../helpers.js';

import '../../../src/tools/all.js';

describe('normaliseCompanyNumber', () => {
  it('pads short all-digit numbers to eight characters', () => {
    expect(normaliseCompanyNumber('445790')).toBe('00445790');
  });

  it('leaves prefixed numbers alone but uppercases them', () => {
    expect(normaliseCompanyNumber('sc311560')).toBe('SC311560');
  });

  it('strips surrounding whitespace', () => {
    expect(normaliseCompanyNumber('  00445790 ')).toBe('00445790');
  });
});

describe('chargeCounts', () => {
  it('derives outstanding charges from the aggregate totals, not a page', () => {
    expect(chargeCounts({ total_count: 22, satisfied_count: 3, part_satisfied_count: 1 })).toEqual({
      total: 22,
      satisfied: 3,
      part_satisfied: 1,
      outstanding: 18,
    });
  });

  it('leaves outstanding undefined when the API reported no breakdown', () => {
    expect(chargeCounts({ total_count: 5 }).outstanding).toBeUndefined();
  });

  it('never reports a negative outstanding count', () => {
    expect(chargeCounts({ total_count: 1, satisfied_count: 4 }).outstanding).toBe(0);
  });
});

describe('formatPagination', () => {
  it('tells the caller how to request the next page', () => {
    expect(
      formatPagination({ start_index: 0, items_per_page: 20, returned: 20, total: 143 })
    ).toContain('start_index: 20');
  });

  it('says when a page is the last one', () => {
    expect(
      formatPagination({ start_index: 140, items_per_page: 20, returned: 3, total: 143 })
    ).toContain('last page');
  });

  it('says nothing for an empty result', () => {
    expect(formatPagination({ start_index: 0, items_per_page: 20, returned: 0, total: 0 })).toBe(
      ''
    );
  });
});

describe('get_officers coverage', () => {
  /** 120 officers where every active one sits past the first page. */
  function createLateActiveClient(): APIClient {
    const client = new APIClient({ api_key: 'test', cache_enabled: false });
    const officers = Array.from({ length: 120 }, (_, index) => ({
      name: `OFFICER ${index}`,
      officer_role: 'director',
      appointed_on: '2020-01-01',
      // Only the last two are still in post.
      ...(index < 118 ? { resigned_on: '2021-01-01' } : {}),
    }));

    vi.spyOn(client, 'get').mockImplementation(
      async (path: string, params?: Record<string, string | number | undefined>) => {
        if (!path.includes('/officers')) throw new Error(`Unexpected path: ${path}`);
        const start = Number(params?.start_index ?? 0);
        const size = Number(params?.items_per_page ?? 50);
        return {
          items: officers.slice(start, start + size),
          total_results: officers.length,
          active_count: 2,
          resigned_count: 118,
          items_per_page: size,
          start_index: start,
          kind: 'officer-list',
        } as never;
      }
    );
    return client;
  }

  it('pages past a wall of resigned officers to find the active ones', async () => {
    const client = createLateActiveClient();
    const result = await getTool('get_officers')!.execute(client, { company_number: '12345678' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.returned_count).toBe(2);
    expect(textOf(result)).toContain('OFFICER 118');
    expect((result.structuredContent?.coverage as { complete: boolean }).complete).toBe(true);
    expect(vi.mocked(client.get).mock.calls.length).toBeGreaterThan(1);
  });

  it('reports the officer counts the API gave, not the size of one page', async () => {
    const client = createLateActiveClient();
    const result = await getTool('get_officers')!.execute(client, { company_number: '12345678' });

    const text = textOf(result);
    expect(text).toContain('120 on the register');
    expect(text).toContain('2 active');
    expect(text).toContain('118 resigned');
  });

  it('says so plainly when the page budget ran out before every active officer', async () => {
    const client = new APIClient({ api_key: 'test', cache_enabled: false });
    vi.spyOn(client, 'get').mockImplementation(
      async (_path: string, params?: Record<string, string | number | undefined>) => {
        const start = Number(params?.start_index ?? 0);
        return {
          items: Array.from({ length: 50 }, (_, index) => ({
            name: `OFFICER ${start + index}`,
            officer_role: 'director',
            resigned_on: '2021-01-01',
          })),
          total_results: 10_000,
          active_count: 5,
          resigned_count: 9_995,
          items_per_page: 50,
          start_index: start,
          kind: 'officer-list',
        } as never;
      }
    );

    const result = await getTool('get_officers')!.execute(client, { company_number: '12345678' });
    expect((result.structuredContent?.coverage as { complete: boolean }).complete).toBe(false);
    expect(textOf(result)).toContain('Coverage');
    expect(textOf(result)).toContain('0 of 5 active officers found');
  });
});

describe('officer_network disambiguation', () => {
  it('refuses to guess when a name matches more than one officer', async () => {
    const client = new APIClient({ api_key: 'test', cache_enabled: false });
    vi.spyOn(client, 'get').mockImplementation(async (path: string) => {
      if (path.includes('/search/officers')) {
        return {
          items: [
            { title: 'SMITH, John', links: { self: '/officers/aaa/appointments' } },
            { title: 'SMITH, John', links: { self: '/officers/bbb/appointments' } },
          ],
          total_results: 2,
          items_per_page: 10,
          start_index: 0,
          kind: 'search#officers',
        } as never;
      }
      throw new CompaniesHouseAPIError('should not be called', 500, path);
    });

    const result = await getTool('officer_network')!.execute(client, {
      officer_name: 'John Smith',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.ambiguous).toBe(true);
    expect(textOf(result)).toContain('no network was produced');
    // It must not have gone on to fetch appointments for an arbitrary match.
    expect(
      vi
        .mocked(client.get)
        .mock.calls.every(([path]) => !(path as string).includes('/appointments'))
    ).toBe(true);
  });
});
