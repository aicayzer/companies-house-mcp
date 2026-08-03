import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APIClient,
  CompaniesHouseAPIError,
  CompaniesHouseNetworkError,
} from '../../../src/api/client.js';
import '../../../src/tools/all.js';
import { getTool } from '../../../src/tools/registry.js';

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
      expect(result.content[0]!.text).toContain(`Companies House returned ${statusCode}`);
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
      structured: {},
    },
    {
      toolName: 'get_exemptions',
      params: { company_number: '12345678' },
      structured: {},
    },
    {
      toolName: 'get_officer_disqualifications',
      params: { officer_id: 'abc123' },
      structured: {},
    },
  ])('keeps $toolName empty-data 404s successful', async ({ toolName, params, structured }) => {
    const result = await getTool(toolName)!.execute(
      createRejectingClient(new CompaniesHouseAPIError('Not found', 404, '/empty-data-endpoint')),
      params
    );

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(structured);
  });
});
