import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getCompanyProfile } from '../api/endpoints/company.js';
import { formatCompanyProfile } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

const shape = {
  company_number: z
    .string()
    .describe('Companies House company number (e.g. "00445790", "SC123456", "OC301234")'),
};
const schema = z.object(shape);

registerTool({
  name: 'get_company_profile',
  description:
    'Get the full profile for a UK company: name, status, type, registered address, SIC codes, accounts dates, confirmation statement dates, previous names, and flags (insolvency, charges, liquidation). Use the company number from search_companies.',
  inputSchema: shape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = schema.parse(params);
    try {
      const profile = await getCompanyProfile(client, company_number);
      return makeTextResult(
        formatCompanyProfile(profile),
        profile as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult(
        `${(err as Error).message}. Try search_companies to find the correct company number.`
      );
    }
  },
});
