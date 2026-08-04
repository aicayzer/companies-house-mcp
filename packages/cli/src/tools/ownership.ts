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
import { formatPSCs, formatPagination, formatDate, emptyPageText } from '../formatters/index.js';
import { describeAbsentPSCs } from './psc-explanation.js';
import { companyNumberSchema, pageSizeSchema, startIndexSchema } from './shared.js';
import type { APIClient } from '../api/client.js';
import type { ExemptionsData, PSCStatement } from '../types/index.js';

const shape = {
  company_number: companyNumberSchema,
  items_per_page: pageSizeSchema(25),
  start_index: startIndexSchema,
};
const schema = z.object(shape);

/**
 * Exemption keys that remove the obligation to keep a PSC register.
 *
 * All five the exemptions resource can carry, including both the UK and EU
 * regulated-market keys. A company can move between them — several moved from
 * the EU key to the UK key after 2020 — so a missing key would make a
 * genuinely exempt company look like one that had simply stopped filing.
 */
const PSC_EXEMPTION_KEYS = [
  'psc_exempt_as_trading_on_regulated_market',
  'psc_exempt_as_trading_on_uk_regulated_market',
  'psc_exempt_as_trading_on_eu_regulated_market',
  'psc_exempt_as_shares_admitted_on_market',
  'psc_exempt_as_trading_on_us_regulated_market',
];

export interface PSCExemption {
  type: string;
  exempt_from?: string;
  exempt_to?: string;
  /** True when no end date has passed. */
  current: boolean;
}

export interface PSCExplanation {
  /** True only when at least one PSC exemption is still in force. */
  exempt: boolean;
  exemption_types: string[];
  /** Every PSC exemption on record, current or ended. */
  exemptions: PSCExemption[];
  /** Exemptions that have ended. Their expiry is what matters to a reader. */
  expired_exemptions: PSCExemption[];
  statements: PSCStatement[];
  active_statements: PSCStatement[];
}

/**
 * Explain an empty PSC list.
 *
 * A company with no PSC entries may be exempt — typically because it trades on
 * a regulated market and discloses ownership under market rules instead — or
 * may have filed a statement in place of an entry. Without this, an absent PSC
 * register reads as a compliance gap when it is usually neither.
 *
 * Exemptions expire. An exemption that ended is not a reason the register is
 * empty *now*, and reporting one as current would tell a reader a company is
 * legitimately exempt when in fact it lost the exemption and stopped filing —
 * the exact opposite of the truth. So the end dates are read, and statements
 * are evaluated independently rather than only when no exemption exists.
 */
export async function explainAbsentPSCs(
  client: APIClient,
  companyNumber: string,
  now: Date = new Date()
): Promise<PSCExplanation> {
  const [exemptionsResult, statementsResult] = await Promise.allSettled([
    getExemptions(client, companyNumber),
    getPSCStatements(client, companyNumber, { items_per_page: 25 }),
  ]);

  const exemptions: PSCExemption[] = [];
  if (exemptionsResult.status === 'fulfilled') {
    const data = exemptionsResult.value as ExemptionsData;
    for (const [key, value] of Object.entries(data.exemptions ?? {})) {
      if (!PSC_EXEMPTION_KEYS.includes(key)) continue;
      const type = value.exemption_type ?? key.replace(/_/g, '-');
      const items = value.items ?? [];

      if (!items.length) {
        // No dates at all: nothing says it has ended.
        exemptions.push({ type, current: true });
        continue;
      }
      for (const item of items) {
        // An end date that cannot be read is treated as ended. Guessing the
        // other way would report a company as exempt on the strength of a
        // value nobody could parse.
        const endsAt = item.exempt_to ? new Date(item.exempt_to) : undefined;
        const unreadableEnd = endsAt !== undefined && Number.isNaN(endsAt.getTime());
        // Companies House dates are calendar dates, so an exemption ending
        // today is in force for the whole of today.
        const endOfFinalDay =
          endsAt && !unreadableEnd ? endsAt.getTime() + 24 * 60 * 60 * 1000 : undefined;
        const ended =
          unreadableEnd || (endOfFinalDay !== undefined && endOfFinalDay <= now.getTime());
        exemptions.push({
          type,
          ...(item.exempt_from ? { exempt_from: item.exempt_from } : {}),
          ...(item.exempt_to ? { exempt_to: item.exempt_to } : {}),
          current: !ended,
        });
      }
    }
  }

  const current = exemptions.filter(exemption => exemption.current);
  const statements =
    statementsResult.status === 'fulfilled' ? (statementsResult.value.items ?? []) : [];

  return {
    exempt: current.length > 0,
    exemption_types: [...new Set(current.map(exemption => exemption.type))],
    exemptions,
    expired_exemptions: exemptions.filter(exemption => !exemption.current),
    statements,
    active_statements: statements.filter(statement => !statement.ceased_on),
  };
}

/** One line per exemption, with the dates that decide whether it still applies. */
export function describeExemptions(exemptions: PSCExemption[]): string {
  return exemptions
    .map(exemption => {
      const from = exemption.exempt_from ? ` from ${formatDate(exemption.exempt_from)}` : '';
      const to = exemption.exempt_to ? ` to ${formatDate(exemption.exempt_to)}` : '';
      return `${exemption.type}${from}${to}`;
    })
    .join('; ');
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
  'psc-has-failed-to-confirm-changed-details': 'A PSC has failed to confirm changed details.',
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
        const narrative = describeAbsentPSCs(explanation);
        const lines = ['## Ownership (persons with significant control)', '', ...narrative.lines];

        return makeTextResult(lines.join('\n'), {
          ...(result as unknown as Record<string, unknown>),
          items: [],
          psc_exempt: explanation.exempt,
          psc_exemption_types: explanation.exemption_types,
          psc_exemptions: explanation.exemptions,
          psc_expired_exemptions: explanation.expired_exemptions,
          psc_statements: explanation.statements,
          psc_absence_explained: !narrative.unexplained,
        });
      }

      const text = [
        items.length
          ? formatPSCs(items, result.total_results ?? items.length, {
              active: result.active_count,
              ceased: result.ceased_count,
            })
          : emptyPageText(
              'persons with significant control',
              input.start_index,
              result.total_results
            ),
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
