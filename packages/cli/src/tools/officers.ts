import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  coverageLines,
  type CoverageEntry,
} from './registry.js';
import { getCompanyOfficers, getOfficerAppointments } from '../api/endpoints/officers.js';
import {
  formatOfficers,
  formatOfficerCounts,
  formatAppointments,
  formatPagination,
} from '../formatters/index.js';
import { collectPages } from '../api/paginate.js';
import {
  companyNumberSchema,
  officerIdSchema,
  pageSizeSchema,
  startIndexSchema,
  MAX_AUTO_PAGES,
} from './shared.js';
import type { APIClient } from '../api/client.js';
import type { CompanyOfficer, OfficersList } from '../types/index.js';

// ── get_officers ────────────────────────────────────────────────────────
const getOfficersShape = {
  company_number: companyNumberSchema,
  include_resigned: z
    .boolean()
    .default(false)
    .describe(
      'Include officers who have resigned. Default false returns only officers currently in post.'
    ),
  items_per_page: pageSizeSchema(50),
  start_index: startIndexSchema,
  order_by: z
    .enum(['appointed_on', 'resigned_on', 'surname'])
    .optional()
    .describe('Sort order applied by Companies House.'),
};
const getOfficersSchema = z.object(getOfficersShape);

registerTool({
  name: 'get_officers',
  title: 'Get Company Officers',
  description:
    "List a company's officers — directors, secretaries, LLP members and equivalents — with role, appointment date, resignation date, nationality, occupation and service address. Returns officers currently in post by default. Companies House does not offer a server-side active filter, so requesting active officers pages through the list until every active officer has been found; the response states how much of the register was read.",
  inputSchema: getOfficersSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'people',
  async execute(client: APIClient, params: unknown) {
    const input = getOfficersSchema.parse(params);
    try {
      if (input.include_resigned) {
        const result = await getCompanyOfficers(client, input.company_number, {
          items_per_page: input.items_per_page,
          start_index: input.start_index,
          order_by: input.order_by,
        });
        const items = result.items ?? [];
        const text = [
          formatOfficerCounts({
            total: result.total_results,
            active: result.active_count,
            resigned: result.resigned_count,
          }),
          '',
          formatOfficers(items, result.total_results ?? items.length),
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
          ...(result as unknown as Record<string, unknown>),
          items,
          coverage: { complete: items.length >= (result.total_results ?? 0) - input.start_index },
        });
      }

      // Active-only: a single page can legitimately contain no active officers
      // for a company with a long resignation history, so pages are collected
      // until every officer the API counts as active has been seen.
      let listMeta: OfficersList | undefined;
      const collected = await collectPages<CompanyOfficer>(
        async (startIndex, itemsPerPage) => {
          const page = await getCompanyOfficers(client, input.company_number, {
            items_per_page: itemsPerPage,
            start_index: startIndex,
            order_by: input.order_by,
          });
          listMeta ??= page;
          return { items: page.items ?? [], total: page.total_results };
        },
        {
          pageSize: input.items_per_page,
          maxPages: MAX_AUTO_PAGES,
          startIndex: input.start_index,
          isSatisfied: items =>
            listMeta?.active_count !== undefined &&
            items.filter(officer => !officer.resigned_on).length >= listMeta.active_count,
        }
      );

      const active = collected.items.filter(officer => !officer.resigned_on);
      const expectedActive = listMeta?.active_count;
      const foundAll = expectedActive === undefined || active.length >= expectedActive;

      const coverage: CoverageEntry[] = [
        {
          resource: 'Officers',
          status: foundAll ? 'complete' : 'partial',
          retrieved: collected.items.length,
          total: collected.total,
          note: foundAll
            ? undefined
            : `stopped after ${collected.pagesFetched} page(s); ${active.length} of ${expectedActive} active officers found. Raise start_index to continue, or set include_resigned to page through the full list.`,
        },
      ];

      const text = [
        formatOfficerCounts({
          total: listMeta?.total_results,
          active: expectedActive,
          resigned: listMeta?.resigned_count,
        }),
        '',
        formatOfficers(active, active.length),
        ...(foundAll ? [] : coverageLines(coverage)),
      ]
        .filter(Boolean)
        .join('\n');

      return makeTextResult(text, {
        ...(listMeta ? (listMeta as unknown as Record<string, unknown>) : {}),
        items: active,
        returned_count: active.length,
        coverage: {
          complete: foundAll,
          pages_fetched: collected.pagesFetched,
          officers_read: collected.items.length,
        },
      });
    } catch (err) {
      return makeErrorResult(err);
    }
  },
});

// ── get_appointments ────────────────────────────────────────────────────
const getAppointmentsShape = {
  officer_id: officerIdSchema,
  items_per_page: pageSizeSchema(50),
  start_index: startIndexSchema,
};
const getAppointmentsSchema = z.object(getAppointmentsShape);

registerTool({
  name: 'get_appointments',
  title: 'Get Officer Appointments',
  description:
    'List every company appointment held by one officer id, current and past, with the company name, number, status, role and dates. An officer id identifies one person as recorded by Companies House; the same individual can hold more than one id if their details were filed differently. Use search_officers to obtain the id.',
  inputSchema: getAppointmentsSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'people',
  async execute(client: APIClient, params: unknown) {
    const input = getAppointmentsSchema.parse(params);
    try {
      const result = await getOfficerAppointments(client, input.officer_id, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      const items = result.items ?? [];
      const text = [
        formatAppointments(items, result.total_results ?? items.length, result.name),
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
      return makeErrorResult(err, {
        suffix: 'Use search_officers to confirm the officer id.',
      });
    }
  },
});
