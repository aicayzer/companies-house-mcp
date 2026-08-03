import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CompaniesHouseAPIError, CompaniesHouseNetworkError } from '../../../src/api/client.js';
import '../../../src/tools/all.js';
import { getAllTools, getTool, makeErrorResult } from '../../../src/tools/registry.js';

describe('Tool Registry', () => {
  it('registers the complete canonical tool set', () => {
    const tools = getAllTools();
    expect(tools).toHaveLength(18);

    const names = tools.map(tool => tool.name);
    expect(names).toEqual([
      'search_companies',
      'search_officers',
      'get_company_profile',
      'get_officers',
      'get_appointments',
      'get_ownership',
      'get_filings',
      'get_charges',
      'get_insolvency',
      'get_company_registers',
      'get_exemptions',
      'get_uk_establishments',
      'get_officer_disqualifications',
      'get_filing_document',
      'company_report',
      'due_diligence_check',
      'officer_network',
      'download_filing_document',
    ]);
    expect(new Set(names)).toHaveLength(18);
  });

  it('every tool has a title, object schema, and accurate annotations', () => {
    const tools = getAllTools();
    const titles = tools.map(tool => tool.title);

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.title).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
      expect(tool.annotations).toEqual(
        tool.name === 'download_filing_document'
          ? {
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true,
            }
          : {
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true,
            }
      );
      expect(typeof tool.execute).toBe('function');
    }

    expect(new Set(titles)).toHaveLength(18);
  });

  it('getTool returns specific tool', () => {
    const tool = getTool('company_report');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('company_report');
  });

  it('getTool returns undefined for unknown tool', () => {
    expect(getTool('nonexistent')).toBeUndefined();
  });
});

describe('Tool Errors', () => {
  it('preserves Companies House API details and retryability', () => {
    const result = makeErrorResult(
      new CompaniesHouseAPIError('Rate limit exceeded. Try again later.', 429, '/company/123')
    );

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          kind: 'companies_house_api',
          message: 'Rate limit exceeded. Try again later.',
          status_code: 429,
          endpoint: '/company/123',
          retryable: true,
        },
      },
    });
  });

  it('marks non-retryable API and internal failures correctly', () => {
    const apiResult = makeErrorResult(
      new CompaniesHouseAPIError('Invalid API key.', 401, '/company/123')
    );
    const internalResult = makeErrorResult(new Error('Formatting failed'));

    expect(apiResult.structuredContent?.error).toMatchObject({
      kind: 'companies_house_api',
      status_code: 401,
      retryable: false,
    });
    expect(internalResult.structuredContent?.error).toEqual({
      kind: 'internal',
      message: 'Formatting failed',
      retryable: false,
    });
    expect(JSON.stringify(internalResult)).not.toContain('at ');
  });

  it('marks typed Companies House network failures as retryable', () => {
    const result = makeErrorResult(
      new CompaniesHouseNetworkError('Unable to reach Companies House. fetch failed', '/test')
    );

    expect(result.structuredContent?.error).toEqual({
      kind: 'network',
      message: 'Unable to reach Companies House. fetch failed',
      endpoint: '/test',
      retryable: true,
    });
  });

  it('keeps unrelated TypeErrors classified as internal failures', () => {
    expect(makeErrorResult(new TypeError('formatter bug')).structuredContent?.error).toEqual({
      kind: 'internal',
      message: 'formatter bug',
      retryable: false,
    });
  });
});
