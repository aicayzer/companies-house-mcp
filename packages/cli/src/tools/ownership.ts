import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getPersonsWithSignificantControl } from '../api/endpoints/psc.js';
import { formatPSCs } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

const shape = {
  company_number: z.string().describe('Companies House company number'),
  items_per_page: z.number().min(1).max(100).default(25).describe('Results per page'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const schema = z.object(shape);

registerTool({
  name: 'get_ownership',
  description:
    'Get Persons with Significant Control (PSCs) for a UK company — the individuals or entities that own or control the company. Shows ownership percentages, voting rights, and right to appoint/remove directors. Covers individual PSCs, corporate PSCs, and legal person PSCs in a single consolidated view.',
  inputSchema: shape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = schema.parse(params);
    try {
      const result = await getPersonsWithSignificantControl(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      return makeTextResult(
        formatPSCs(result.items ?? [], result.total_results ?? 0),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
