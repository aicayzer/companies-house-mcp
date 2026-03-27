import { describe, it, expect, beforeEach } from 'vitest';

// We need to test the registry in isolation, so we'll import directly
// and test the core functions
describe('Tool Registry', () => {
  it('getAllTools returns registered tools', async () => {
    // Import the modules to trigger registration
    const { getAllTools } = await import('../../../src/tools/registry.js');
    await import('../../../src/tools/search.js');
    await import('../../../src/tools/company.js');
    await import('../../../src/tools/officers.js');
    await import('../../../src/tools/ownership.js');
    await import('../../../src/tools/filings.js');
    await import('../../../src/tools/financial.js');
    await import('../../../src/tools/extended.js');
    await import('../../../src/tools/composite.js');

    const tools = getAllTools();
    expect(tools.length).toBe(17);

    const names = tools.map(t => t.name);
    expect(names).toContain('search_companies');
    expect(names).toContain('search_officers');
    expect(names).toContain('get_company_profile');
    expect(names).toContain('get_officers');
    expect(names).toContain('get_appointments');
    expect(names).toContain('get_ownership');
    expect(names).toContain('get_filings');
    expect(names).toContain('get_charges');
    expect(names).toContain('get_insolvency');
    expect(names).toContain('get_company_registers');
    expect(names).toContain('get_exemptions');
    expect(names).toContain('get_uk_establishments');
    expect(names).toContain('get_officer_disqualifications');
    expect(names).toContain('get_filing_document');
    expect(names).toContain('company_report');
    expect(names).toContain('due_diligence_check');
    expect(names).toContain('officer_network');
  });

  it('every tool has required properties', async () => {
    const { getAllTools } = await import('../../../src/tools/registry.js');
    const tools = getAllTools();

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('getTool returns specific tool', async () => {
    const { getTool } = await import('../../../src/tools/registry.js');
    const tool = getTool('company_report');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('company_report');
  });

  it('getTool returns undefined for unknown tool', async () => {
    const { getTool } = await import('../../../src/tools/registry.js');
    expect(getTool('nonexistent')).toBeUndefined();
  });
});
