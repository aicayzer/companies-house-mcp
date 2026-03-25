import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { searchCompanies, advancedSearchCompanies, searchOfficers } from '../api/endpoints/search.js';
import { formatCompanySearchResults, formatOfficerSearchResults, formatAddress } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';
import type { CompanySearchResponse } from '../types/index.js';

// ── search_companies ────────────────────────────────────────────────────
const searchCompaniesShape = {
  query: z.string().describe('Company name or number to search for'),
  items_per_page: z.number().min(1).max(100).default(20).describe('Results per page (max 100)'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
  company_status: z.string().optional().describe('Filter by status: active, dissolved, liquidation, receivership, etc.'),
  company_type: z.string().optional().describe('Filter by type: ltd, plc, llp, etc.'),
  incorporated_from: z.string().optional().describe('Incorporation date from (YYYY-MM-DD)'),
  incorporated_to: z.string().optional().describe('Incorporation date to (YYYY-MM-DD)'),
  location: z.string().optional().describe('Filter by registered office location'),
  sic_codes: z.string().optional().describe('Filter by SIC code(s), comma-separated'),
};
const searchCompaniesSchema = z.object(searchCompaniesShape);

registerTool({
  name: 'search_companies',
  description:
    'Search for UK companies by name. Supports optional filters for status, type, incorporation date, location, and SIC codes. When filters are provided, uses the advanced search endpoint for more precise results.',
  inputSchema: searchCompaniesShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = searchCompaniesSchema.parse(params);
    const hasAdvancedFilters =
      input.company_status || input.company_type || input.incorporated_from ||
      input.incorporated_to || input.location || input.sic_codes;

    try {
      if (hasAdvancedFilters) {
        // Advanced search returns different field names than basic search.
        // Normalise to match CompanySearchResponse/CompanySearchItem shape.
        const raw = await advancedSearchCompanies(client, {
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
        const rawAny = raw as unknown as Record<string, unknown>;
        const totalResults = (rawAny.hits as number | undefined) ?? raw.total_results ?? 0;
        const items = (raw.items ?? []).map((item) => {
          const itemAny = item as unknown as Record<string, unknown>;
          return {
            ...item,
            title: item.title || (itemAny.company_name as string) || 'Unknown',
            address_snippet: item.address_snippet || formatAddress(itemAny.registered_office_address as Record<string, string> | undefined),
          };
        });
        const result: CompanySearchResponse = { ...raw, items, total_results: totalResults };
        return makeTextResult(
          formatCompanySearchResults(result.items, result.total_results),
          rawAny
        );
      }

      const result = await searchCompanies(client, {
        q: input.query,
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      return makeTextResult(
        formatCompanySearchResults(result.items ?? [], result.total_results ?? 0),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── search_officers ─────────────────────────────────────────────────────
const searchOfficersShape = {
  query: z.string().describe('Officer name to search for'),
  items_per_page: z.number().min(1).max(100).default(20).describe('Results per page (max 100)'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const searchOfficersSchema = z.object(searchOfficersShape);

registerTool({
  name: 'search_officers',
  description:
    'Search for company officers (directors, secretaries) by name across all UK companies. Returns name, address, appointment count, date of birth, and officer ID for use with get_appointments.',
  inputSchema: searchOfficersShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = searchOfficersSchema.parse(params);
    try {
      const result = await searchOfficers(client, {
        q: input.query,
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      return makeTextResult(
        formatOfficerSearchResults(result.items ?? [], result.total_results ?? 0),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
