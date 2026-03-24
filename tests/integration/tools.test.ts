import { describe, it, expect, beforeAll } from 'vitest';
import { APIClient } from '../../src/api/client.js';
import { getTool, getAllTools } from '../../src/tools/registry.js';

// Import all tools to trigger registration
import '../../src/tools/search.js';
import '../../src/tools/company.js';
import '../../src/tools/officers.js';
import '../../src/tools/ownership.js';
import '../../src/tools/filings.js';
import '../../src/tools/financial.js';
import '../../src/tools/extended.js';
import '../../src/tools/composite.js';

const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

// Skip integration tests if no API key
const describeIntegration = API_KEY ? describe : describe.skip;

describeIntegration('Integration: Tools against real API', () => {
  let client: APIClient;

  beforeAll(() => {
    client = new APIClient({ api_key: API_KEY! });
  });

  // Test companies
  const TESCO = '00445790';        // Large PLC, many officers, charges
  const ANTHROPIC = '13861484';    // Active tech company

  it('search_companies finds Tesco', async () => {
    const tool = getTool('search_companies')!;
    const result = await tool.execute(client, { query: 'Tesco' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('TESCO');
    expect(result.structuredContent).toBeDefined();
  });

  it('get_company_profile returns Tesco profile', async () => {
    const tool = getTool('get_company_profile')!;
    const result = await tool.execute(client, { company_number: TESCO });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('TESCO');
    expect(result.content[0]!.text).toContain('00445790');
    expect(result.structuredContent).toBeDefined();
  });

  it('get_officers returns Tesco officers', async () => {
    const tool = getTool('get_officers')!;
    const result = await tool.execute(client, { company_number: TESCO });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('officer');
  });

  it('get_ownership returns Anthropic PSCs', async () => {
    const tool = getTool('get_ownership')!;
    const result = await tool.execute(client, { company_number: ANTHROPIC });
    expect(result.isError).toBeFalsy();
    // Anthropic UK should have PSC data
    expect(result.structuredContent).toBeDefined();
  });

  it('get_filings returns Tesco filings', async () => {
    const tool = getTool('get_filings')!;
    const result = await tool.execute(client, { company_number: TESCO });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('filing');
  });

  it('get_filings filters by category', async () => {
    const tool = getTool('get_filings')!;
    const result = await tool.execute(client, {
      company_number: TESCO,
      category: 'accounts',
      items_per_page: 5,
    });
    expect(result.isError).toBeFalsy();
  });

  it('get_charges returns Tesco charges', async () => {
    const tool = getTool('get_charges')!;
    const result = await tool.execute(client, { company_number: TESCO });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('charge');
  });

  it('get_insolvency handles company with no insolvency gracefully', async () => {
    const tool = getTool('get_insolvency')!;
    const result = await tool.execute(client, { company_number: ANTHROPIC });
    expect(result.isError).toBeFalsy();
    // Should not error even if no insolvency data
  });

  it('search_officers finds officers', async () => {
    const tool = getTool('search_officers')!;
    const result = await tool.execute(client, { query: 'Smith' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('officer');
  });

  it('company_report generates full report', async () => {
    const tool = getTool('company_report')!;
    const result = await tool.execute(client, { company_number: ANTHROPIC });
    expect(result.isError).toBeFalsy();
    const text = result.content[0]!.text;
    // Should contain all sections
    expect(text).toContain('Officers');
    expect(text).toContain('Ownership');
    expect(text).toContain('Charges');
    expect(text).toContain('Filings');
    expect(text).toContain('Insolvency');
    // Structured content should have sections
    expect(result.structuredContent?.profile).toBeDefined();
  });

  it('due_diligence_check runs scan', async () => {
    const tool = getTool('due_diligence_check')!;
    const result = await tool.execute(client, { company_number: ANTHROPIC });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('Due Diligence Report');
    expect(result.structuredContent?.risk_level).toBeDefined();
  });

  it('get_company_profile handles invalid company number', async () => {
    const tool = getTool('get_company_profile')!;
    const result = await tool.execute(client, { company_number: 'INVALID' });
    expect(result.isError).toBeTruthy();
    expect(result.content[0]!.text).toContain('Error');
  });
});
