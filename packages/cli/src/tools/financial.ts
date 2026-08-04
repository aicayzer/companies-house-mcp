import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  isNotFound,
} from './registry.js';
import { getCompanyCharges } from '../api/endpoints/charges.js';
import { getCompanyInsolvency } from '../api/endpoints/insolvency.js';
import {
  formatCharges,
  formatInsolvency,
  formatPagination,
  chargeCounts,
  formatChargeCounts,
  emptyPageText,
} from '../formatters/index.js';
import { companyNumberSchema, pageSizeSchema, startIndexSchema } from './shared.js';
import type { APIClient } from '../api/client.js';

// ── get_charges ─────────────────────────────────────────────────────────
const chargesShape = {
  company_number: companyNumberSchema,
  items_per_page: pageSizeSchema(25),
  start_index: startIndexSchema,
};
const chargesSchema = z.object(chargesShape);

registerTool({
  name: 'get_charges',
  title: 'Get Company Charges',
  description:
    'List the charges — mortgages, debentures and other security — registered against a UK company, with the persons entitled, creation and delivery dates, particulars and satisfaction status. Outstanding, part-satisfied and satisfied totals come from Companies House aggregate counts, so they stay correct even when the list is longer than one page. A registered charge records that security was granted; it says nothing about the current balance owed.',
  inputSchema: chargesSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const input = chargesSchema.parse(params);
    try {
      const result = await getCompanyCharges(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      const items = result.items ?? [];
      const counts = chargeCounts(result);

      const text = [
        formatChargeCounts(counts),
        '',
        items.length
          ? formatCharges(items, counts.total)
          : emptyPageText('charges', input.start_index, counts.total),
        formatPagination({
          start_index: input.start_index,
          items_per_page: input.items_per_page,
          returned: items.length,
          total: counts.total,
        }),
      ]
        .filter(Boolean)
        .join('\n');

      return makeTextResult(text, {
        ...(result as unknown as Record<string, unknown>),
        charge_counts: counts,
      });
    } catch (err) {
      // Companies House returns 404 for a valid company that has no charges.
      if (isNotFound(err)) {
        return makeTextResult('No charges are registered against this company.', {
          items: [],
          total_count: 0,
          charge_counts: { total: 0, outstanding: 0, satisfied: 0, part_satisfied: 0 },
        });
      }
      return makeErrorResult(err);
    }
  },
});

// ── get_insolvency ──────────────────────────────────────────────────────
const insolvencyShape = {
  company_number: companyNumberSchema,
};
const insolvencySchema = z.object(insolvencyShape);

registerTool({
  name: 'get_insolvency',
  title: 'Get Company Insolvency',
  description:
    'Read the insolvency record for a UK company: cases, case type, key dates, appointed practitioners and notes. Companies House returns no record for a company that has never been subject to insolvency proceedings, which the response reports as an absence rather than an error.',
  inputSchema: insolvencySchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = insolvencySchema.parse(params);
    try {
      const result = await getCompanyInsolvency(client, company_number);
      const cases = result.cases ?? [];
      if (!cases.length) {
        return makeTextResult('No insolvency cases are recorded for this company.', {
          ...(result as unknown as Record<string, unknown>),
          cases: [],
        });
      }
      return makeTextResult(formatInsolvency(cases), result as unknown as Record<string, unknown>);
    } catch (err) {
      // Companies House returns 404 for a valid company with no insolvency history.
      if (isNotFound(err)) {
        return makeTextResult('No insolvency history is recorded for this company.', { cases: [] });
      }
      return makeErrorResult(err);
    }
  },
});
