import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getCompanyProfile } from '../api/endpoints/company.js';
import { formatCompanyProfile } from '../formatters/index.js';
import { companyNumberSchema } from './shared.js';
import type { APIClient } from '../api/client.js';

const shape = {
  company_number: companyNumberSchema,
};
const schema = z.object(shape);

registerTool({
  name: 'get_company_profile',
  title: 'Get Company Profile',
  description:
    'Read the Companies House register entry for one UK company: registered name, number, status and status detail, company type, incorporation date, registered office address, SIC codes, accounts and confirmation statement dates, and previous names. Use search_companies first if you only know the name.',
  inputSchema: schema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = schema.parse(params);
    try {
      const profile = await getCompanyProfile(client, company_number);
      return makeTextResult(
        formatCompanyProfile(profile),
        profile as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult(err, {
        suffix: 'Use search_companies to find the correct company number.',
      });
    }
  },
});
