import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APIClient,
  CompaniesHouseAPIError,
  CompaniesHouseNetworkError,
} from '../../../src/api/client.js';
import '../../../src/tools/all.js';
import { getTool } from '../../../src/tools/registry.js';
import { textOf } from '../../helpers.js';

function createRejectingClient(error: unknown): APIClient {
  const client = new APIClient({ api_key: 'test', cache_enabled: false });
  vi.spyOn(client, 'get').mockRejectedValue(error);
  return client;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tool execution errors', () => {
  it.each([
    { statusCode: 401, retryable: false },
    { statusCode: 404, retryable: false },
    { statusCode: 429, retryable: true },
    { statusCode: 503, retryable: true },
  ])(
    'returns a structured Companies House error for HTTP $statusCode',
    async ({ statusCode, retryable }) => {
      const error = new CompaniesHouseAPIError(
        `Companies House returned ${statusCode}`,
        statusCode,
        '/company/12345678'
      );
      const result = await getTool('get_company_profile')!.execute(createRejectingClient(error), {
        company_number: '12345678',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent?.error).toMatchObject({
        kind: 'companies_house_api',
        status_code: statusCode,
        endpoint: '/company/12345678',
        retryable,
      });
      expect(textOf(result)).toContain(`Companies House returned ${statusCode}`);
    }
  );

  it('returns a retryable structured network error', async () => {
    const result = await getTool('get_company_profile')!.execute(
      createRejectingClient(
        new CompaniesHouseNetworkError(
          'Unable to reach Companies House. fetch failed',
          '/company/12345678'
        )
      ),
      { company_number: '12345678' }
    );

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          kind: 'network',
          endpoint: '/company/12345678',
          retryable: true,
        },
      },
    });
  });

  // Companies House returns 404 for a valid company that simply has no record
  // of this kind. Reporting that as a failure would make an ordinary answer
  // look like a broken request.
  it.each([
    {
      toolName: 'get_charges',
      params: { company_number: '12345678' },
      structured: { items: [], total_count: 0 },
    },
    {
      toolName: 'get_insolvency',
      params: { company_number: '12345678' },
      structured: { cases: [] },
    },
    {
      toolName: 'get_company_registers',
      params: { company_number: '12345678' },
      structured: { registers: {} },
    },
    {
      toolName: 'get_exemptions',
      params: { company_number: '12345678' },
      structured: { exemptions: {} },
    },
    {
      toolName: 'get_uk_establishments',
      params: { company_number: '12345678' },
      structured: { items: [] },
    },
    {
      toolName: 'get_officer_disqualifications',
      params: { officer_id: 'abc123' },
      structured: { disqualifications: [] },
    },
    {
      toolName: 'get_filings',
      params: { company_number: '12345678' },
      structured: { items: [], total_count: 0 },
    },
  ])('keeps $toolName empty-data 404s successful', async ({ toolName, params, structured }) => {
    const result = await getTool(toolName)!.execute(
      createRejectingClient(new CompaniesHouseAPIError('Not found', 404, '/empty-data-endpoint')),
      params
    );

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject(structured);
  });

  it('only gives identifier advice when the record was genuinely not found', async () => {
    const notFound = await getTool('get_company_profile')!.execute(
      createRejectingClient(new CompaniesHouseAPIError('No such record.', 404, '/company/1')),
      { company_number: '12345678' }
    );
    expect(textOf(notFound)).toContain('search_companies');

    // "Check the company number" is misleading when the key was rejected.
    for (const status of [401, 403, 429, 500]) {
      const other = await getTool('get_company_profile')!.execute(
        createRejectingClient(new CompaniesHouseAPIError('Upstream said no.', status, '/company/1')),
        { company_number: '12345678' }
      );
      expect(textOf(other), `status ${status} should not suggest checking the number`).not.toContain(
        'search_companies'
      );
    }
  });

  it('surfaces the wait Companies House asked for after a rate limit', async () => {
    const result = await getTool('get_company_profile')!.execute(
      createRejectingClient(
        new CompaniesHouseAPIError('Companies House rate limit reached.', 429, '/company/1', 42)
      ),
      { company_number: '12345678' }
    );

    expect(result.structuredContent?.error).toMatchObject({
      retryable: true,
      retry_after_seconds: 42,
    });
  });
});
