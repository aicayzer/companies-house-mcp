import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getFilingHistory } from '../api/endpoints/filing.js';
import { formatFilings } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

const shape = {
  company_number: z.string().describe('Companies House company number'),
  category: z
    .string()
    .optional()
    .describe(
      'Filter by category: accounts, annual-return, capital, change-of-name, confirmation-statement, incorporation, liquidation, miscellaneous, mortgage, officers, resolution'
    ),
  items_per_page: z.number().min(1).max(100).default(25).describe('Results per page'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const schema = z.object(shape);

registerTool({
  name: 'get_filings',
  description:
    'Get filing history for a UK company. Includes accounts, annual returns, officer changes, mortgage registrations, and all other filings. Use the category parameter to filter by type. Returns transaction IDs for retrieving specific documents.',
  inputSchema: shape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = schema.parse(params);
    try {
      const result = await getFilingHistory(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
        category: input.category,
      });
      return makeTextResult(
        formatFilings(result.items ?? [], result.total_count ?? 0),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
