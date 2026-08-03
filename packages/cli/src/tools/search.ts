import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import {
  searchCompanies,
  advancedSearchCompanies,
  searchOfficers,
} from '../api/endpoints/search.js';
import {
  formatCompanySearchResults,
  formatOfficerSearchResults,
  formatAddress,
  formatPagination,
} from '../formatters/index.js';
import { pageSizeSchema, searchStartIndexSchema } from './shared.js';
import type { APIClient } from '../api/client.js';
import type { CompanySearchResponse } from '../types/index.js';

// ── search_companies ────────────────────────────────────────────────────
const searchCompaniesShape = {
  query: z.string().min(1).describe('Company name, or part of one. Also accepts a company number.'),
  items_per_page: pageSizeSchema(20),
  start_index: searchStartIndexSchema,
  company_status: z
    .string()
    .optional()
    .describe(
      'Restrict to a register status: active, dissolved, liquidation, receivership, administration, voluntary-arrangement, converted-closed, insolvency-proceedings.'
    ),
  company_type: z
    .string()
    .optional()
    .describe('Restrict to a company type: ltd, plc, llp, and so on.'),
  incorporated_from: z.string().optional().describe('Earliest incorporation date, YYYY-MM-DD.'),
  incorporated_to: z.string().optional().describe('Latest incorporation date, YYYY-MM-DD.'),
  location: z.string().optional().describe('Restrict to a registered office location.'),
  sic_codes: z.string().optional().describe('Restrict to SIC code(s), comma-separated.'),
};
const searchCompaniesSchema = z.object(searchCompaniesShape);

registerTool({
  name: 'search_companies',
  title: 'Search Companies',
  description:
    'Find UK companies by name and return their company numbers. Supplying any of the status, type, incorporation date, location or SIC filters switches to the advanced search endpoint. This is a name lookup, not a bulk export: narrow the query rather than paging deeply.',
  inputSchema: searchCompaniesSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'search',
  async execute(client: APIClient, params: unknown) {
    const input = searchCompaniesSchema.parse(params);
    const hasAdvancedFilters = Boolean(
      input.company_status ||
      input.company_type ||
      input.incorporated_from ||
      input.incorporated_to ||
      input.location ||
      input.sic_codes
    );

    try {
      let result: CompanySearchResponse;
      let raw: Record<string, unknown>;

      if (hasAdvancedFilters) {
        // Advanced search returns different field names to basic search.
        // Normalise to the basic shape so callers see one contract.
        const advanced = await advancedSearchCompanies(client, {
          company_name_includes: input.query,
          company_status: input.company_status,
          company_type: input.company_type,
          incorporated_from: input.incorporated_from,
          incorporated_to: input.incorporated_to,
          location: input.location,
          sic_codes: input.sic_codes,
          items_per_page: input.items_per_page,
          start_index: input.start_index,
        });
        raw = advanced as unknown as Record<string, unknown>;
        const totalResults = (raw.hits as number | undefined) ?? advanced.total_results ?? 0;
        const items = (advanced.items ?? []).map(item => {
          const itemRecord = item as unknown as Record<string, unknown>;
          return {
            ...item,
            title: item.title || (itemRecord.company_name as string) || 'Unknown',
            address_snippet:
              item.address_snippet ||
              formatAddress(
                itemRecord.registered_office_address as Record<string, string> | undefined
              ),
          };
        });
        result = { ...advanced, items, total_results: totalResults };
      } else {
        const basic = await searchCompanies(client, {
          q: input.query,
          items_per_page: input.items_per_page,
          start_index: input.start_index,
        });
        raw = basic as unknown as Record<string, unknown>;
        result = basic;
      }

      const items = result.items ?? [];
      const text = [
        formatCompanySearchResults(items, result.total_results ?? 0),
        formatPagination({
          start_index: input.start_index,
          items_per_page: input.items_per_page,
          returned: items.length,
          total: result.total_results,
        }),
      ]
        .filter(Boolean)
        .join('\n');

      return makeTextResult(text, {
        ...raw,
        items,
        total_results: result.total_results,
        search_mode: hasAdvancedFilters ? 'advanced' : 'basic',
      });
    } catch (err) {
      return makeErrorResult(err);
    }
  },
});

// ── search_officers ─────────────────────────────────────────────────────
const searchOfficersShape = {
  query: z.string().min(1).describe('Officer name, or part of one.'),
  items_per_page: pageSizeSchema(20),
  start_index: searchStartIndexSchema,
};
const searchOfficersSchema = z.object(searchOfficersShape);

registerTool({
  name: 'search_officers',
  title: 'Search Officers',
  description:
    'Find company officers by name across the whole UK register. Returns each match with its officer id, service address, month and year of birth where published, and total appointment count. Use the officer id with get_appointments or officer_network. Names are not unique — check the birth date and address before treating two results as the same person.',
  inputSchema: searchOfficersSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'search',
  async execute(client: APIClient, params: unknown) {
    const input = searchOfficersSchema.parse(params);
    try {
      const result = await searchOfficers(client, {
        q: input.query,
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      const items = result.items ?? [];
      const text = [
        formatOfficerSearchResults(items, result.total_results ?? 0),
        formatPagination({
          start_index: input.start_index,
          items_per_page: input.items_per_page,
          returned: items.length,
          total: result.total_results,
        }),
      ]
        .filter(Boolean)
        .join('\n');

      return makeTextResult(text, result as unknown as Record<string, unknown>);
    } catch (err) {
      return makeErrorResult(err);
    }
  },
});
