import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  isNotFound,
} from './registry.js';
import { getFilingHistory } from '../api/endpoints/filing.js';
import { formatFilings, formatPagination } from '../formatters/index.js';
import { companyNumberSchema, pageSizeSchema, startIndexSchema } from './shared.js';
import type { APIClient } from '../api/client.js';

export const FILING_CATEGORIES = [
  'accounts',
  'address',
  'annual-return',
  'capital',
  'change-of-name',
  'confirmation-statement',
  'incorporation',
  'insolvency',
  'liquidation',
  'miscellaneous',
  'mortgage',
  'officers',
  'persons-with-significant-control',
  'resolution',
] as const;

const shape = {
  company_number: companyNumberSchema,
  category: z
    .string()
    .optional()
    .describe(`Restrict to one filing category: ${FILING_CATEGORIES.join(', ')}.`),
  items_per_page: pageSizeSchema(25),
  start_index: startIndexSchema,
};
const schema = z.object(shape);

registerTool({
  name: 'get_filings',
  title: 'Get Filing History',
  description:
    "Read a company's filing history: accounts, confirmation statements, officer changes, charge registrations, resolutions and everything else it has filed. Each entry carries a transaction id and, where a scanned or rendered document exists, a document id. Pass that document id to download_filing_document to retrieve the document itself.",
  inputSchema: schema,
  annotations: TOOL_ANNOTATIONS,
  group: 'filings',
  async execute(client: APIClient, params: unknown) {
    const input = schema.parse(params);
    try {
      const result = await getFilingHistory(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
        category: input.category,
      });
      const items = result.items ?? [];
      const text = [
        formatFilings(items, result.total_count ?? items.length),
        formatPagination({
          start_index: input.start_index,
          items_per_page: input.items_per_page,
          returned: items.length,
          total: result.total_count,
        }),
      ]
        .filter(Boolean)
        .join('\n');

      return makeTextResult(text, result as unknown as Record<string, unknown>);
    } catch (err) {
      if (isNotFound(err)) {
        return makeTextResult('Companies House holds no filing history for this company.', {
          items: [],
          total_count: 0,
        });
      }
      return makeErrorResult(err);
    }
  },
});
