import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CompaniesHouseAPIError, CompaniesHouseNetworkError } from '../../../src/api/client.js';
import '../../../src/tools/all.js';
import { getAllTools, getTool, makeErrorResult } from '../../../src/tools/registry.js';

/** The canonical tool set, in the deterministic order the registry returns. */
const EXPECTED_TOOLS = [
  'company_report',
  'download_filing_document',
  'due_diligence_check',
  'get_appointments',
  'get_charges',
  'get_company_profile',
  'get_company_registers',
  'get_exemptions',
  'get_filing_document',
  'get_filings',
  'get_insolvency',
  'get_officer_disqualifications',
  'get_officers',
  'get_ownership',
  'get_uk_establishments',
  'officer_network',
  'search_companies',
  'search_officers',
];

describe('Tool Registry', () => {
  it('registers the complete canonical tool set', () => {
    const names = getAllTools().map(tool => tool.name);
    expect(names).toEqual(EXPECTED_TOOLS);
    expect(new Set(names)).toHaveLength(EXPECTED_TOOLS.length);
  });

  it('lists tools in a stable order across calls', () => {
    expect(getAllTools().map(tool => tool.name)).toEqual(getAllTools().map(tool => tool.name));
  });

  it('every tool has a title, group, object schema, and accurate annotations', () => {
    const tools = getAllTools();
    const titles = tools.map(tool => tool.title);

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.title).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.group).toBeTruthy();
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
      // Every tool only reads from Companies House. Nothing writes anywhere.
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(typeof tool.execute).toBe('function');
    }

    expect(new Set(titles)).toHaveLength(tools.length);
  });

  it('exposes no tool that can write to the filesystem', () => {
    // Document content is attacker-supplyable, so a write parameter would be a
    // prompt-injection primitive. Local writes belong to the CLI.
    const writeLike = /^(save|write|output|out|dest|path|file)_?/;
    for (const tool of getAllTools()) {
      const offending = Object.keys(tool.inputSchema.shape).filter(name => writeLike.test(name));
      expect(offending, `${tool.name} exposes a write-shaped parameter`).toEqual([]);
    }
  });

  it('describes every tool parameter, so generated help cannot be blank', () => {
    for (const tool of getAllTools()) {
      for (const [name, field] of Object.entries(tool.inputSchema.shape)) {
        expect(
          (field as { description?: string }).description,
          `${tool.name}.${name} has no description`
        ).toBeTruthy();
      }
    }
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
