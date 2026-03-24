import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getCompanyCharges } from '../api/endpoints/charges.js';
import { getCompanyInsolvency } from '../api/endpoints/insolvency.js';
import { formatCharges, formatInsolvency } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

// ── get_charges ─────────────────────────────────────────────────────────
const chargesShape = {
  company_number: z.string().describe('Companies House company number'),
  items_per_page: z.number().min(1).max(100).default(25).describe('Results per page'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const chargesSchema = z.object(chargesShape);

registerTool({
  name: 'get_charges',
  description:
    'Get charges (mortgages, debentures) registered against a UK company. Shows outstanding and satisfied charges, chargee details, and particulars. Outstanding charges indicate active security interests.',
  inputSchema: chargesShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = chargesSchema.parse(params);
    try {
      const result = await getCompanyCharges(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      return makeTextResult(
        formatCharges(result.items ?? [], result.total_count ?? 0),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      // 404 is normal for companies with no charges
      if ((err as { statusCode?: number }).statusCode === 404) {
        return makeTextResult('No charges found for this company.', { items: [], total_count: 0 });
      }
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_insolvency ──────────────────────────────────────────────────────
const insolvencyShape = {
  company_number: z.string().describe('Companies House company number'),
};
const insolvencySchema = z.object(insolvencyShape);

registerTool({
  name: 'get_insolvency',
  description:
    'Get insolvency information for a UK company. Shows insolvency cases, proceedings, practitioners, dates, and status. Returns empty if the company has no insolvency history.',
  inputSchema: insolvencyShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = insolvencySchema.parse(params);
    try {
      const result = await getCompanyInsolvency(client, company_number);
      return makeTextResult(
        formatInsolvency(result.cases ?? []),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      // 404 is normal for companies with no insolvency
      if ((err as { statusCode?: number }).statusCode === 404) {
        return makeTextResult('No insolvency history for this company.', { cases: [] });
      }
      return makeErrorResult((err as Error).message);
    }
  },
});
