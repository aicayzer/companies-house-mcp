import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getCompanyOfficers, getOfficerAppointments } from '../api/endpoints/officers.js';
import { formatOfficers, formatAppointments } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

// ── get_officers ────────────────────────────────────────────────────────
const getOfficersShape = {
  company_number: z.string().describe('Companies House company number'),
  include_resigned: z.boolean().default(false).describe('Include resigned officers (default: active only)'),
  items_per_page: z.number().min(1).max(100).default(50).describe('Results per page'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const getOfficersSchema = z.object(getOfficersShape);

registerTool({
  name: 'get_officers',
  description:
    'Get the officers (directors, secretaries) of a UK company. By default returns active officers only. Set include_resigned=true to see all officers including those who have resigned.',
  inputSchema: getOfficersShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = getOfficersSchema.parse(params);
    try {
      const result = await getCompanyOfficers(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      let items = result.items ?? [];
      if (!input.include_resigned) {
        items = items.filter(o => !o.resigned_on);
      }
      return makeTextResult(
        formatOfficers(items, input.include_resigned ? (result.total_results ?? items.length) : items.length),
        {
          ...result as unknown as Record<string, unknown>,
          items,
        }
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_appointments ────────────────────────────────────────────────────
const getAppointmentsShape = {
  officer_id: z.string().describe('Officer ID (from search_officers or get_officers links)'),
  items_per_page: z.number().min(1).max(100).default(50).describe('Results per page'),
  start_index: z.number().min(0).default(0).describe('Pagination offset'),
};
const getAppointmentsSchema = z.object(getAppointmentsShape);

registerTool({
  name: 'get_appointments',
  description:
    'Get all company appointments for a specific officer. Shows every company where this person is or was a director/secretary. Use the officer ID from search_officers or from officer links in get_officers.',
  inputSchema: getAppointmentsShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = getAppointmentsSchema.parse(params);
    try {
      const result = await getOfficerAppointments(client, input.officer_id, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      return makeTextResult(
        formatAppointments(result.items ?? [], result.total_results ?? 0, result.name),
        result as unknown as Record<string, unknown>
      );
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
