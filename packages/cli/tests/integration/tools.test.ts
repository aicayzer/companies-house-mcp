/**
 * Integration tests against the live Companies House API.
 *
 * These assert on structure and invariants rather than on values that move as
 * companies file. Anything that changes week to week — a specific officer, a
 * charge total, a register status — is checked for shape, not for content.
 *
 * Requires COMPANIES_HOUSE_API_KEY. Skipped when it is absent.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { APIClient } from '../../src/api/client.js';
import { getTool, getAllTools } from '../../src/tools/registry.js';
import { textOf } from '../helpers.js';

import '../../src/tools/all.js';

const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const describeIntegration = API_KEY ? describe : describe.skip;

/** Companies chosen for stable, deliberately different register shapes. */
const TESCO = '00445790'; // large PLC, PSC-exempt as a listed company
const ANTHROPIC = '14604577'; // active private company with a PSC statement
const DISSOLVED = '13861484'; // dissolved, for the absent-record paths

describeIntegration('Integration: tools against the live API', () => {
  let client: APIClient;

  beforeAll(() => {
    client = new APIClient({ api_key: API_KEY! });
  });

  describe('search', () => {
    it('finds a company by name and returns its number', async () => {
      const result = await getTool('search_companies')!.execute(client, { query: 'Tesco plc' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('TESCO PLC');
      expect(result.structuredContent?.total_results).toBeGreaterThan(0);
    });

    it('applies filters through the advanced search endpoint', async () => {
      const result = await getTool('search_companies')!.execute(client, {
        query: 'tesco',
        company_status: 'active',
        items_per_page: 5,
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.search_mode).toBe('advanced');
    });

    it('tells the caller how to get the next page', async () => {
      const result = await getTool('search_companies')!.execute(client, {
        query: 'limited',
        items_per_page: 5,
      });
      expect(textOf(result)).toMatch(/start_index: 5|last page/);
    });

    it('finds officers by name', async () => {
      const result = await getTool('search_officers')!.execute(client, { query: 'Smith' });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.items).toBeDefined();
    });
  });

  describe('company records', () => {
    it('reads a company profile', async () => {
      const result = await getTool('get_company_profile')!.execute(client, {
        company_number: TESCO,
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('TESCO PLC');
      expect(result.structuredContent?.company_number).toBe(TESCO);
    });

    it('pads a short company number rather than failing', async () => {
      const result = await getTool('get_company_profile')!.execute(client, {
        company_number: '445790',
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.company_number).toBe(TESCO);
    });

    it('reports an unknown company number as an error', async () => {
      const result = await getTool('get_company_profile')!.execute(client, {
        company_number: 'ZZ999999',
      });
      expect(result.isError).toBe(true);
      expect((result.structuredContent?.error as { status_code: number }).status_code).toBe(404);
    });

    it('reports officer counts from the API totals', async () => {
      const result = await getTool('get_officers')!.execute(client, { company_number: TESCO });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toMatch(/\d+ on the register/);
      const coverage = result.structuredContent?.coverage as { complete: boolean };
      expect(coverage.complete).toBe(true);
    });

    it('derives outstanding charges from the aggregate counts', async () => {
      const result = await getTool('get_charges')!.execute(client, { company_number: TESCO });
      expect(result.isError).toBeFalsy();
      const counts = result.structuredContent?.charge_counts as {
        total: number;
        outstanding?: number;
      };
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.outstanding).toBeLessThanOrEqual(counts.total);
    });
  });

  describe('absent records', () => {
    it('treats a company with no insolvency history as a normal answer', async () => {
      const result = await getTool('get_insolvency')!.execute(client, { company_number: TESCO });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('No insolvency');
    });

    it('treats a company with no registers record as a normal answer', async () => {
      const result = await getTool('get_company_registers')!.execute(client, {
        company_number: TESCO,
      });
      expect(result.isError).toBeFalsy();
    });

    it('still reads a dissolved company', async () => {
      const result = await getTool('get_company_profile')!.execute(client, {
        company_number: DISSOLVED,
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.company_status).toBe('dissolved');
    });
  });

  describe('ownership explanations', () => {
    it('explains an empty PSC register caused by a market-listing exemption', async () => {
      const result = await getTool('get_ownership')!.execute(client, { company_number: TESCO });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.psc_exempt).toBe(true);
      expect(textOf(result)).toContain('exempt');
    });

    it('explains an empty PSC register caused by a filed statement', async () => {
      const result = await getTool('get_ownership')!.execute(client, { company_number: ANTHROPIC });
      expect(result.isError).toBeFalsy();
      const statements = result.structuredContent?.psc_statements as unknown[];
      expect(statements.length).toBeGreaterThan(0);
      expect(textOf(result)).toContain('statement has been filed');
    });
  });

  describe('summaries', () => {
    it('produces a company report with coverage and limitations', async () => {
      const result = await getTool('company_report')!.execute(client, { company_number: TESCO });
      expect(result.isError).toBeFalsy();
      const text = textOf(result);
      expect(text).toContain('Officers currently in post');
      expect(text).toContain('Coverage');
      expect(text).toContain('What this does not tell you');
      expect(result.structuredContent?.coverage).toBeDefined();
    });

    it('screens a company without issuing a verdict', async () => {
      const result = await getTool('due_diligence_check')!.execute(client, {
        company_number: TESCO,
      });
      expect(result.isError).toBeFalsy();
      const text = textOf(result);
      expect(text).toContain('Public register screening');
      expect(text).toContain('Checks performed');
      expect(text).not.toMatch(/good standing|risk level/i);
      expect(result.structuredContent?.checks_performed).toBeDefined();
    });

    it('does not treat an exempt company as missing its PSC register', async () => {
      const result = await getTool('due_diligence_check')!.execute(client, {
        company_number: TESCO,
      });
      const observations = result.structuredContent?.observations as Array<{ category: string }>;
      expect(observations.some(observation => observation.category === 'Ownership')).toBe(false);
    });
  });

  describe('documents', () => {
    async function findDocumentId(): Promise<string> {
      const filings = await getTool('get_filings')!.execute(client, {
        company_number: ANTHROPIC,
        items_per_page: 20,
      });
      const items = (filings.structuredContent?.items ?? []) as Array<{
        links?: { document_metadata?: string };
      }>;
      const withDocument = items.find(item => item.links?.document_metadata);
      expect(withDocument, 'expected at least one filing with a document').toBeDefined();
      return withDocument!.links!.document_metadata!.split('/').pop()!;
    }

    it('inspects a document without transferring it, then retrieves it', async () => {
      const documentId = await findDocumentId();

      const metadata = await getTool('download_filing_document')!.execute(client, {
        document_id: documentId,
        metadata_only: true,
      });
      expect(metadata.isError).toBeFalsy();
      expect(metadata.structuredContent?.retrieved).toBe(false);
      expect(metadata.structuredContent?.available_formats).toContain('application/pdf');

      const document = await getTool('download_filing_document')!.execute(client, {
        document_id: documentId,
      });
      expect(document.isError).toBeFalsy();

      const resource = document.content.find(block => block.type === 'resource');
      expect(resource, 'the document should come back as an embedded resource').toBeDefined();
      if (resource?.type !== 'resource' || !('blob' in resource.resource)) {
        throw new Error('expected a binary resource');
      }
      expect(resource.resource.mimeType).toBe('application/pdf');
      expect(Buffer.from(resource.resource.blob, 'base64').subarray(0, 4).toString()).toBe('%PDF');
    });

    it('refuses an oversized document before transferring it', async () => {
      const result = await getTool('download_filing_document')!.execute(client, {
        document_id: await findDocumentId(),
        max_bytes: 100,
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.retrieved).toBe(false);
      expect(result.structuredContent?.reason).toBe('too_large');
    });
  });

  it('exposes every registered tool with a callable executor', () => {
    const tools = getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) expect(typeof tool.execute).toBe('function');
  });
});
