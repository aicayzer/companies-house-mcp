import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  isNotFound,
} from './registry.js';
import { getPersonsWithSignificantControl, getPSCStatements } from '../api/endpoints/psc.js';
import { getExemptions } from '../api/endpoints/exemptions.js';
import { formatPSCs, formatPagination, formatDate } from '../formatters/index.js';
import { companyNumberSchema, pageSizeSchema, startIndexSchema } from './shared.js';
import type { APIClient } from '../api/client.js';
import type { ExemptionsData, PSCStatement } from '../types/index.js';

const shape = {
  company_number: companyNumberSchema,
  items_per_page: pageSizeSchema(25),
  start_index: startIndexSchema,
};
const schema = z.object(shape);

/** Exemption keys that remove the obligation to keep a PSC register. */
const PSC_EXEMPTION_KEYS = [
  'psc_exempt_as_trading_on_regulated_market',
  'psc_exempt_as_shares_admitted_on_market',
  'psc_exempt_as_trading_on_uk_regulated_market',
];

export interface PSCExplanation {
  exempt: boolean;
  exemption_types: string[];
  statements: PSCStatement[];
}

/**
 * Explain an empty PSC list. A company with no PSC entries may be exempt —
 * typically because it trades on a regulated market and discloses ownership
 * under market rules instead — or may have filed a statement in place of an
 * entry. Without this, an absent PSC register reads as a compliance gap when
 * it is usually neither.
 */
export async function explainAbsentPSCs(
  client: APIClient,
  companyNumber: string
): Promise<PSCExplanation> {
  const [exemptions, statements] = await Promise.allSettled([
    getExemptions(client, companyNumber),
    getPSCStatements(client, companyNumber, { items_per_page: 25 }),
  ]);

  const exemptionTypes: string[] = [];
  if (exemptions.status === 'fulfilled') {
    const data = exemptions.value as ExemptionsData;
    for (const [key, value] of Object.entries(data.exemptions ?? {})) {
      if (PSC_EXEMPTION_KEYS.includes(key)) {
        exemptionTypes.push(value.exemption_type ?? key);
      }
    }
  }

  return {
    exempt: exemptionTypes.length > 0,
    exemption_types: exemptionTypes,
    statements: statements.status === 'fulfilled' ? (statements.value.items ?? []) : [],
  };
}

/**
 * Readable text for the fixed set of PSC statement values. The register's own
 * identifiers include a long-standing spelling mistake, so they are mapped
 * rather than printed raw.
 */
const PSC_STATEMENT_LABELS: Record<string, string> = {
  'no-individual-or-entity-with-signficant-control':
    'The company knows of no individual or entity with significant control over it.',
  'steps-to-find-psc-not-yet-completed':
    'The company has not yet completed the steps required to identify its PSCs.',
  'psc-exists-but-not-identified': 'A PSC exists but has not been identified.',
  'psc-details-not-confirmed': "A PSC's details have not been confirmed.",
  'psc-contacted-but-no-response': 'A PSC has been contacted but has not responded.',
  'restrictions-notice-issued-to-psc': 'A restrictions notice has been issued to a PSC.',
  'psc-has-failed-to-confirm-changed-details':
    'A PSC has failed to confirm changed details.',
  'psc-details-not-confirmed-by-company': 'PSC details have not been confirmed by the company.',
  'all-beneficial-owners-identified': 'All beneficial owners have been identified.',
  'no-individual-or-entity-with-signficant-control-partnership':
    'The partnership knows of no individual or entity with significant control over it.',
};

export function describePSCStatement(statement: string): string {
  return PSC_STATEMENT_LABELS[statement] ?? statement.replace(/-/g, ' ');
}

export function formatPSCStatements(statements: PSCStatement[]): string[] {
  if (!statements.length) return [];
  const lines = ['### Statements filed in place of PSC entries', ''];
  for (const statement of statements) {
    const status = statement.ceased_on ? ` (withdrawn ${formatDate(statement.ceased_on)})` : '';
    lines.push(`- ${describePSCStatement(statement.statement)}${status}`);
  }
  lines.push('');
  return lines;
}

registerTool({
  name: 'get_ownership',
  title: 'Get Company Ownership',
  description:
    'List the persons with significant control (PSCs) recorded for a UK company — the individuals, corporate entities and legal persons that own or control it — with natures of control, notified date and ceased date. Ceased PSCs stay on the register and are returned alongside current ones, clearly marked. When no PSC is recorded the response explains why, distinguishing a market-listing exemption or a filed statement from a genuine gap.',
  inputSchema: schema,
  annotations: TOOL_ANNOTATIONS,
  group: 'people',
  async execute(client: APIClient, params: unknown) {
    const input = schema.parse(params);
    try {
      const result = await getPersonsWithSignificantControl(client, input.company_number, {
        items_per_page: input.items_per_page,
        start_index: input.start_index,
      });
      const items = result.items ?? [];

      if (items.length === 0 && (result.total_results ?? 0) === 0) {
        const explanation = await explainAbsentPSCs(client, input.company_number);
        const lines = ['## Ownership (persons with significant control)', ''];

        if (explanation.exempt) {
          lines.push(
            'No PSC entries. The company is recorded as exempt from the PSC requirements, which normally applies to companies whose shares are admitted to a regulated market and whose ownership is disclosed under market rules instead.',
            '',
            `Exemption(s) on record: ${explanation.exemption_types.join(', ')}.`,
            ''
          );
        } else if (explanation.statements.length) {
          lines.push('No PSC entries. A statement has been filed in place of an entry.', '');
          lines.push(...formatPSCStatements(explanation.statements));
        } else {
          lines.push(
            'No PSC entries, no exemption on record, and no statement filed in place of one. The company may not have filed PSC information. This is an absence of data, not evidence about who controls the company.',
            ''
          );
        }

        return makeTextResult(lines.join('\n'), {
          ...(result as unknown as Record<string, unknown>),
          items: [],
          psc_exempt: explanation.exempt,
          psc_exemption_types: explanation.exemption_types,
          psc_statements: explanation.statements,
        });
      }

      const text = [
        formatPSCs(items, result.total_results ?? items.length, {
          active: result.active_count,
          ceased: result.ceased_count,
        }),
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
      if (isNotFound(err)) {
        return makeTextResult(
          'Companies House holds no persons-with-significant-control record for this company. Confirm the company number with get_company_profile.',
          { items: [], total_results: 0, active_count: 0, ceased_count: 0 }
        );
      }
      return makeErrorResult(err);
    }
  },
});
