/**
 * Tools that combine several register requests into one answer.
 *
 * These read as assessments, so they carry the heaviest truthfulness burden in
 * the product. Every output here states what was retrieved, what was not, and
 * what the public register cannot establish. Nothing in this file may present
 * an absence of adverse records as a clearance.
 */

import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  coverageLines,
  limitationLines,
  isNotFound,
  type CoverageEntry,
} from './registry.js';
import { getCompanyProfile } from '../api/endpoints/company.js';
import { getCompanyOfficers, getOfficerAppointments } from '../api/endpoints/officers.js';
import { getPersonsWithSignificantControl } from '../api/endpoints/psc.js';
import { getCompanyCharges } from '../api/endpoints/charges.js';
import { getCompanyInsolvency } from '../api/endpoints/insolvency.js';
import { getFilingHistory } from '../api/endpoints/filing.js';
import { searchOfficers } from '../api/endpoints/search.js';
import {
  formatCompanyProfile,
  formatOfficers,
  formatOfficerCounts,
  formatPSCs,
  formatCharges,
  formatChargeCounts,
  chargeCounts,
  formatInsolvency,
  formatFilings,
  formatCompanyStatus,
  formatCompanyStatusDetail,
  formatDate,
  formatAppointments,
  formatOfficerSearchResults,
  formatPagination,
  accountsOverdue,
} from '../formatters/index.js';
import { explainAbsentPSCs, formatPSCStatements } from './ownership.js';
import { collectPages } from '../api/paginate.js';
import {
  companyNumberSchema,
  officerIdSchema,
  pageSizeSchema,
  MAX_AUTO_PAGES,
} from './shared.js';
import type { APIClient } from '../api/client.js';
import type { CompanyProfile, OfficerAppointment } from '../types/index.js';

const OFFICERS_PAGE = 50;
const PSC_PAGE = 50;
const CHARGES_PAGE = 100;
const FILINGS_PAGE = 10;

/** Sub-resources Companies House only exposes when the profile links to them. */
function hasLink(profile: CompanyProfile, key: string): boolean {
  return Boolean(profile.links?.[key]);
}

// ── company_report ──────────────────────────────────────────────────────
const reportSchema = z.object({ company_number: companyNumberSchema });

registerTool({
  name: 'company_report',
  title: 'Company Report',
  description:
    'Read the main Companies House records for one company in a single call: profile, officers currently in post, persons with significant control, charges, the most recent filings and any insolvency record. The report states how much of each list it retrieved and what the register does not cover. Use this as the starting point for company research, then use the individual tools for anything the report shows is incomplete.',
  inputSchema: reportSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'summaries',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = reportSchema.parse(params);

    try {
      let profile: CompanyProfile;
      try {
        profile = await getCompanyProfile(client, company_number);
      } catch (error) {
        return makeErrorResult(error, {
          prefix: 'Could not read the company profile:',
          notFoundSuffix: 'Use search_companies to find the correct company number.',
        });
      }

      // Charges and insolvency only exist when the profile links to them.
      // Checking first avoids reporting an expected absence as a failure.
      const [officers, pscs, charges, filings, insolvency] = await Promise.allSettled([
        getCompanyOfficers(client, company_number, { items_per_page: OFFICERS_PAGE }),
        getPersonsWithSignificantControl(client, company_number, { items_per_page: PSC_PAGE }),
        hasLink(profile, 'charges')
          ? getCompanyCharges(client, company_number, { items_per_page: CHARGES_PAGE })
          : Promise.resolve(null),
        getFilingHistory(client, company_number, { items_per_page: FILINGS_PAGE }),
        hasLink(profile, 'insolvency')
          ? getCompanyInsolvency(client, company_number)
          : Promise.resolve(null),
      ]);

      const sections: string[] = [formatCompanyProfile(profile)];
      const structured: Record<string, unknown> = { profile };
      const coverage: CoverageEntry[] = [];

      // ---- Officers
      sections.push('\n---\n## Officers currently in post\n');
      if (officers.status === 'fulfilled') {
        const list = officers.value;
        const all = list.items ?? [];
        const active = all.filter(officer => !officer.resigned_on);
        const expectedActive = list.active_count;
        const complete = expectedActive === undefined || active.length >= expectedActive;

        sections.push(
          formatOfficerCounts({
            total: list.total_results,
            active: expectedActive,
            resigned: list.resigned_count,
          }),
          '',
          formatOfficers(active, active.length)
        );
        if (!complete) {
          sections.push(
            `_Only ${active.length} of ${expectedActive} officers currently in post appear in the first ${OFFICERS_PAGE} records. Use get_officers for the full list._\n`
          );
        }
        structured.officers = { ...list, active_officers: active };
        coverage.push({
          resource: 'Officers',
          status: complete ? 'complete' : 'partial',
          retrieved: all.length,
          total: list.total_results,
          note: complete ? undefined : 'use get_officers to page through the rest',
        });
      } else {
        sections.push('Officer records could not be retrieved for this request.');
        coverage.push({ resource: 'Officers', status: 'unavailable', note: 'request failed' });
      }

      // ---- Ownership
      sections.push('\n---\n## Ownership (persons with significant control)\n');
      if (pscs.status === 'fulfilled') {
        const list = pscs.value;
        const items = list.items ?? [];
        if (items.length === 0 && (list.total_results ?? 0) === 0) {
          const explanation = await explainAbsentPSCs(client, company_number);
          if (explanation.exempt) {
            sections.push(
              `No PSC entries. The company is recorded as exempt from the PSC requirements (${explanation.exemption_types.join(', ')}), which normally applies to companies whose shares trade on a regulated market.\n`
            );
          } else if (explanation.statements.length) {
            sections.push('No PSC entries. A statement has been filed in place of an entry.\n');
            sections.push(formatPSCStatements(explanation.statements).join('\n'));
          } else {
            sections.push(
              'No PSC entries, no exemption on record, and no statement filed in place of one. This is an absence of data rather than evidence about who controls the company.\n'
            );
          }
          structured.pscs = {
            ...list,
            psc_exempt: explanation.exempt,
            psc_exemption_types: explanation.exemption_types,
            psc_statements: explanation.statements,
          };
          coverage.push({ resource: 'Persons with significant control', status: 'not-applicable' });
        } else {
          sections.push(
            formatPSCs(items, list.total_results ?? items.length, {
              active: list.active_count,
              ceased: list.ceased_count,
            })
          );
          structured.pscs = list;
          const complete = items.length >= (list.total_results ?? 0);
          coverage.push({
            resource: 'Persons with significant control',
            status: complete ? 'complete' : 'partial',
            retrieved: items.length,
            total: list.total_results,
            note: complete ? undefined : 'use get_ownership to page through the rest',
          });
        }
      } else {
        sections.push('Ownership records could not be retrieved for this request.');
        coverage.push({
          resource: 'Persons with significant control',
          status: 'unavailable',
          note: 'request failed',
        });
      }

      // ---- Charges
      sections.push('\n---\n## Charges\n');
      if (charges.status === 'fulfilled' && charges.value) {
        const list = charges.value;
        const counts = chargeCounts(list);
        const items = list.items ?? [];
        sections.push(formatChargeCounts(counts), '', formatCharges(items, counts.total));
        structured.charges = { ...list, charge_counts: counts };
        const complete = items.length >= counts.total;
        coverage.push({
          resource: 'Charges',
          status: complete ? 'complete' : 'partial',
          retrieved: items.length,
          total: counts.total,
          note: complete ? undefined : 'use get_charges to page through the rest',
        });
      } else if (charges.status === 'fulfilled') {
        sections.push('No charges are registered against this company.');
        structured.charges = { items: [], total_count: 0 };
        coverage.push({ resource: 'Charges', status: 'not-applicable' });
      } else if (isNotFound(charges.reason)) {
        sections.push('No charges are registered against this company.');
        coverage.push({ resource: 'Charges', status: 'not-applicable' });
      } else {
        sections.push('Charge records could not be retrieved for this request.');
        coverage.push({ resource: 'Charges', status: 'unavailable', note: 'request failed' });
      }

      // ---- Filings
      sections.push(`\n---\n## Most recent filings\n`);
      if (filings.status === 'fulfilled') {
        const list = filings.value;
        const items = list.items ?? [];
        sections.push(formatFilings(items, list.total_count ?? items.length));
        sections.push(
          formatPagination({
            start_index: 0,
            items_per_page: FILINGS_PAGE,
            returned: items.length,
            total: list.total_count,
          })
        );
        structured.filings = list;
        coverage.push({
          resource: 'Filing history',
          status: items.length >= (list.total_count ?? 0) ? 'complete' : 'partial',
          retrieved: items.length,
          total: list.total_count,
          note:
            items.length >= (list.total_count ?? 0)
              ? undefined
              : `this report shows the ${FILINGS_PAGE} most recent; use get_filings for the rest`,
        });
      } else {
        sections.push('Filing history could not be retrieved for this request.');
        coverage.push({ resource: 'Filing history', status: 'unavailable', note: 'request failed' });
      }

      // ---- Insolvency
      sections.push('\n---\n## Insolvency\n');
      if (insolvency.status === 'fulfilled' && insolvency.value) {
        const cases = insolvency.value.cases ?? [];
        sections.push(
          cases.length ? formatInsolvency(cases) : 'No insolvency cases are recorded.'
        );
        structured.insolvency = insolvency.value;
        coverage.push({ resource: 'Insolvency', status: 'complete', retrieved: cases.length });
      } else if (insolvency.status === 'fulfilled' || isNotFound(insolvency.reason)) {
        sections.push('No insolvency history is recorded for this company.');
        coverage.push({ resource: 'Insolvency', status: 'not-applicable' });
      } else {
        sections.push('Insolvency records could not be retrieved for this request.');
        coverage.push({ resource: 'Insolvency', status: 'unavailable', note: 'request failed' });
      }

      sections.push('\n---\n', ...coverageLines(coverage), ...limitationLines());
      structured.coverage = coverage;

      return makeTextResult(sections.join('\n'), structured);
    } catch (err) {
      return makeErrorResult(err);
    }
  },
});

// ── due_diligence_check ─────────────────────────────────────────────────
const ddSchema = z.object({ company_number: companyNumberSchema });

export type ObservationSeverity = 'high' | 'medium' | 'low';

export interface Observation {
  category: string;
  severity: ObservationSeverity;
  detail: string;
  /** Which register record the observation was read from. */
  source: string;
}

export interface PerformedCheck {
  check: string;
  status: 'ran' | 'unavailable';
  note?: string;
}

registerTool({
  name: 'due_diligence_check',
  title: 'Public Register Screening Summary',
  description:
    'Screen one company against what is recorded on the Companies House public register and report the entries a reviewer would want to look at: register status and status detail, insolvency records, outstanding charges, overdue accounts and confirmation statements, registered office disputes, officer changes, ownership records and company age. It reports observations drawn from filed data, together with the checks it ran and the checks it could not run. It is not a verification, credit check, sanctions or politically-exposed-person screening, or a clearance decision, and it never concludes that a company is sound.',
  inputSchema: ddSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'summaries',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = ddSchema.parse(params);

    try {
      let profile: CompanyProfile;
      try {
        profile = await getCompanyProfile(client, company_number);
      } catch (error) {
        return makeErrorResult(error, {
          prefix: 'Could not read the company profile:',
          notFoundSuffix: 'Use search_companies to find the correct company number.',
        });
      }

      const [officers, pscs, charges, insolvency] = await Promise.allSettled([
        getCompanyOfficers(client, company_number, { items_per_page: 100 }),
        getPersonsWithSignificantControl(client, company_number, { items_per_page: PSC_PAGE }),
        hasLink(profile, 'charges')
          ? getCompanyCharges(client, company_number, { items_per_page: 1 })
          : Promise.resolve(null),
        hasLink(profile, 'insolvency')
          ? getCompanyInsolvency(client, company_number)
          : Promise.resolve(null),
      ]);

      const observations: Observation[] = [];
      const checks: PerformedCheck[] = [];
      const coverage: CoverageEntry[] = [];

      // ---- Register status
      checks.push({ check: 'Register status', status: 'ran' });
      const adverseStatuses = [
        'dissolved',
        'liquidation',
        'receivership',
        'administration',
        'insolvency-proceedings',
        'closed',
        'removed',
      ];
      if (adverseStatuses.includes(profile.company_status)) {
        observations.push({
          category: 'Register status',
          severity: 'high',
          detail: `The register records this company as ${formatCompanyStatus(profile.company_status)}.`,
          source: 'company profile',
        });
      }
      if (profile.company_status === 'voluntary-arrangement') {
        observations.push({
          category: 'Register status',
          severity: 'medium',
          detail: 'The register records a voluntary arrangement with creditors.',
          source: 'company profile',
        });
      }
      // A company can be `active` and simultaneously subject to a strike-off
      // proposal, so the detail is checked independently of the status.
      if (profile.company_status_detail) {
        const isStrikeOff = profile.company_status_detail === 'active-proposal-to-strike-off';
        observations.push({
          category: 'Register status',
          severity: isStrikeOff ? 'high' : 'low',
          detail: `Status detail on the register: ${formatCompanyStatusDetail(profile.company_status_detail)}.`,
          source: 'company profile',
        });
      }

      // ---- Insolvency
      if (insolvency.status === 'fulfilled' && insolvency.value) {
        checks.push({ check: 'Insolvency record', status: 'ran' });
        const cases = insolvency.value.cases ?? [];
        if (cases.length) {
          const types = [...new Set(cases.map(c => c.type).filter(Boolean))];
          observations.push({
            category: 'Insolvency',
            severity: 'high',
            detail: `${cases.length} insolvency case(s) on the register${types.length ? ` (${types.join(', ')})` : ''}.`,
            source: 'insolvency record',
          });
        }
        coverage.push({ resource: 'Insolvency', status: 'complete', retrieved: cases.length });
      } else if (insolvency.status === 'fulfilled' || isNotFound(insolvency.reason)) {
        checks.push({ check: 'Insolvency record', status: 'ran' });
        coverage.push({ resource: 'Insolvency', status: 'not-applicable' });
      } else {
        checks.push({
          check: 'Insolvency record',
          status: 'unavailable',
          note: 'the request failed, so insolvency was not checked',
        });
        coverage.push({ resource: 'Insolvency', status: 'unavailable' });
      }

      // ---- Filing compliance
      checks.push({ check: 'Filing deadlines', status: 'ran' });
      if (accountsOverdue(profile)) {
        observations.push({
          category: 'Accounts',
          severity: 'high',
          detail: `Accounts are recorded as overdue${profile.accounts?.next_accounts?.due_on ? ` (due ${formatDate(profile.accounts.next_accounts.due_on)})` : ''}.`,
          source: 'company profile',
        });
      }
      if (profile.confirmation_statement?.overdue) {
        observations.push({
          category: 'Confirmation statement',
          severity: 'medium',
          detail: `The confirmation statement is recorded as overdue${profile.confirmation_statement.next_due ? ` (due ${formatDate(profile.confirmation_statement.next_due)})` : ''}.`,
          source: 'company profile',
        });
      }

      // ---- Charges
      if (charges.status === 'fulfilled' && charges.value) {
        checks.push({ check: 'Registered charges', status: 'ran' });
        const counts = chargeCounts(charges.value);
        if (counts.outstanding) {
          observations.push({
            category: 'Charges',
            severity: 'medium',
            detail: `${counts.outstanding} outstanding charge(s) of ${counts.total} on the register. A charge records that security was granted; it does not show the amount currently owed.`,
            source: 'charges record',
          });
        }
        if (counts.part_satisfied) {
          observations.push({
            category: 'Charges',
            severity: 'low',
            detail: `${counts.part_satisfied} part-satisfied charge(s) on the register.`,
            source: 'charges record',
          });
        }
        coverage.push({ resource: 'Charges', status: 'complete', total: counts.total });
      } else if (charges.status === 'fulfilled' || isNotFound(charges.reason)) {
        checks.push({ check: 'Registered charges', status: 'ran' });
        coverage.push({ resource: 'Charges', status: 'not-applicable' });
      } else {
        checks.push({
          check: 'Registered charges',
          status: 'unavailable',
          note: 'the request failed, so charges were not checked',
        });
        coverage.push({ resource: 'Charges', status: 'unavailable' });
      }

      // ---- Registered office
      checks.push({ check: 'Registered office', status: 'ran' });
      if (profile.registered_office_is_in_dispute) {
        observations.push({
          category: 'Registered office',
          severity: 'medium',
          detail: 'The registered office address is recorded as in dispute.',
          source: 'company profile',
        });
      }
      if (profile.undeliverable_registered_office_address) {
        observations.push({
          category: 'Registered office',
          severity: 'medium',
          detail: 'Post to the registered office address has been recorded as undeliverable.',
          source: 'company profile',
        });
      }

      // ---- Officers
      if (officers.status === 'fulfilled') {
        const list = officers.value;
        const all = list.items ?? [];
        const active = all.filter(officer => !officer.resigned_on);
        const activeCount = list.active_count ?? active.length;
        const readEverything = all.length >= (list.total_results ?? all.length);

        checks.push({
          check: 'Officers',
          status: 'ran',
          note: readEverything
            ? undefined
            : `read the first ${all.length} of ${list.total_results} officer records`,
        });

        if (activeCount === 0 && profile.company_status === 'active') {
          observations.push({
            category: 'Officers',
            severity: 'high',
            detail: 'No officers are currently in post for a company the register shows as active.',
            source: 'officers record',
          });
        }
        if (activeCount === 1) {
          observations.push({
            category: 'Officers',
            severity: 'low',
            detail: 'One officer currently in post. Common for small companies.',
            source: 'officers record',
          });
        }

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentlyResigned = all.filter(officer => {
          if (!officer.resigned_on) return false;
          const resigned = new Date(officer.resigned_on);
          return !Number.isNaN(resigned.getTime()) && resigned > sixMonthsAgo;
        });
        if (recentlyResigned.length) {
          observations.push({
            category: 'Officers',
            severity: 'medium',
            detail: `${recentlyResigned.length} officer(s) recorded as resigned in the last six months${readEverything ? '' : ' within the records read'}.`,
            source: 'officers record',
          });
        }

        coverage.push({
          resource: 'Officers',
          status: readEverything ? 'complete' : 'partial',
          retrieved: all.length,
          total: list.total_results,
          note: readEverything ? undefined : 'use get_officers to read the rest',
        });
      } else {
        checks.push({
          check: 'Officers',
          status: 'unavailable',
          note: 'the request failed, so officers were not checked',
        });
        coverage.push({ resource: 'Officers', status: 'unavailable' });
      }

      // ---- Ownership
      if (pscs.status === 'fulfilled') {
        const list = pscs.value;
        const items = list.items ?? [];
        const activePSCs = items.filter(psc => !psc.ceased_on);

        if (items.length === 0 && (list.total_results ?? 0) === 0) {
          // An empty PSC register is only worth remarking on when it is not
          // explained by an exemption or a filed statement.
          const explanation = await explainAbsentPSCs(client, company_number);
          checks.push({ check: 'Ownership (PSC)', status: 'ran' });
          if (explanation.exempt) {
            coverage.push({
              resource: 'Persons with significant control',
              status: 'not-applicable',
              note: `company is exempt (${explanation.exemption_types.join(', ')})`,
            });
          } else if (explanation.statements.length) {
            coverage.push({
              resource: 'Persons with significant control',
              status: 'not-applicable',
              note: 'a statement was filed in place of an entry',
            });
          } else if (profile.company_status === 'active') {
            observations.push({
              category: 'Ownership',
              severity: 'medium',
              detail:
                'No PSC entry, exemption or statement is recorded for a company the register shows as active. Ownership cannot be established from the register.',
              source: 'PSC record',
            });
            coverage.push({
              resource: 'Persons with significant control',
              status: 'not-applicable',
              note: 'nothing recorded',
            });
          } else {
            coverage.push({
              resource: 'Persons with significant control',
              status: 'not-applicable',
              note: 'nothing recorded',
            });
          }
        } else {
          checks.push({ check: 'Ownership (PSC)', status: 'ran' });
          if (activePSCs.length === 0 && profile.company_status === 'active') {
            observations.push({
              category: 'Ownership',
              severity: 'medium',
              detail:
                'Every PSC entry on the register has ceased, and no current one has been filed for a company the register shows as active.',
              source: 'PSC record',
            });
          }
          coverage.push({
            resource: 'Persons with significant control',
            status: items.length >= (list.total_results ?? 0) ? 'complete' : 'partial',
            retrieved: items.length,
            total: list.total_results,
          });
        }
      } else {
        checks.push({
          check: 'Ownership (PSC)',
          status: 'unavailable',
          note: 'the request failed, so ownership was not checked',
        });
        coverage.push({ resource: 'Persons with significant control', status: 'unavailable' });
      }

      // ---- Company age
      checks.push({ check: 'Company age', status: 'ran' });
      if (profile.date_of_creation) {
        const created = new Date(profile.date_of_creation);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (!Number.isNaN(created.getTime()) && created > oneYearAgo) {
          observations.push({
            category: 'Company age',
            severity: 'low',
            detail: `Incorporated ${formatDate(profile.date_of_creation)}, less than a year ago.`,
            source: 'company profile',
          });
        }
      }

      // ---- Report
      const high = observations.filter(o => o.severity === 'high');
      const medium = observations.filter(o => o.severity === 'medium');
      const low = observations.filter(o => o.severity === 'low');
      const unavailable = checks.filter(check => check.status === 'unavailable');

      const lines: string[] = [
        `## Public register screening: ${profile.company_name}`,
        '',
        `**Company number:** ${profile.company_number}`,
        `**Register status:** ${formatCompanyStatus(profile.company_status)}${
          profile.company_status_detail
            ? ` — ${formatCompanyStatusDetail(profile.company_status_detail)}`
            : ''
        }`,
        `**Entries to review:** ${observations.length} (${high.length} higher, ${medium.length} moderate, ${low.length} contextual)`,
        '',
        'This summarises entries on the Companies House public register. It is not a verification, credit check or clearance decision.',
        '',
      ];

      if (observations.length === 0) {
        lines.push(
          '### Entries to review',
          '',
          'The checks below found no adverse entries on the public register. That means nothing adverse has been *filed* — it is not a statement that the company is sound, solvent, genuine or suitable to deal with. Companies House does not verify what companies file.',
          ''
        );
      } else {
        lines.push('### Entries to review', '');
        const groups: Array<[string, Observation[]]> = [
          ['Higher significance', high],
          ['Moderate significance', medium],
          ['Contextual', low],
        ];
        for (const [heading, group] of groups) {
          if (!group.length) continue;
          lines.push(`#### ${heading}`, '');
          for (const observation of group) {
            lines.push(`- **${observation.category}:** ${observation.detail} _(${observation.source})_`);
          }
          lines.push('');
        }
      }

      lines.push('### Checks performed', '');
      for (const check of checks) {
        lines.push(
          check.status === 'ran'
            ? `- ${check.check}${check.note ? ` — ${check.note}` : ''}`
            : `- ${check.check} — **not performed**${check.note ? `: ${check.note}` : ''}`
        );
      }
      lines.push('');

      if (unavailable.length) {
        lines.push(
          `_${unavailable.length} check(s) could not be performed, so this summary is incomplete._`,
          ''
        );
      }

      lines.push(...coverageLines(coverage), ...limitationLines());

      return makeTextResult(lines.join('\n'), {
        company_number: profile.company_number,
        company_name: profile.company_name,
        company_status: profile.company_status,
        company_status_detail: profile.company_status_detail,
        observations,
        observation_counts: { high: high.length, medium: medium.length, low: low.length },
        checks_performed: checks,
        checks_incomplete: unavailable.length > 0,
        coverage,
        limitations_apply: true,
      });
    } catch (err) {
      return makeErrorResult(err);
    }
  },
});

// ── officer_network ─────────────────────────────────────────────────────
const networkSchema = z
  .object({
    officer_id: officerIdSchema
      .optional()
      .describe('Officer id from search_officers. Preferred — provide this or officer_name.'),
    officer_name: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Officer name to look up. Only used when officer_id is not given, and only accepted when the name matches exactly one officer.'
      ),
    items_per_page: pageSizeSchema(100),
  })
  .refine(data => data.officer_id || data.officer_name, {
    message: 'Provide either officer_id or officer_name.',
  });

registerTool({
  name: 'officer_network',
  title: 'Map Officer Appointments',
  description:
    "Map every company one officer id is or was appointed to, split into current and past appointments with each company's status. Pages through the full appointment list rather than showing only the first page. Prefer officer_id: a name is only accepted when it matches exactly one officer, because officer names are not unique and picking the wrong match produces a confidently wrong network. Appointments are grouped by Companies House officer id, so one individual may hold more than one.",
  inputSchema: networkSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'summaries',
  async execute(client: APIClient, params: unknown) {
    const input = networkSchema.parse(params);

    try {
      let officerId = input.officer_id;
      let resolvedFromName: string | undefined;

      if (!officerId && input.officer_name) {
        const matches = await searchOfficers(client, {
          q: input.officer_name,
          items_per_page: 10,
        });
        const items = matches.items ?? [];

        if (!items.length) {
          return makeTextResult(
            `No officer matches "${input.officer_name}". Try search_officers with a different spelling.`,
            { officer_name: input.officer_name, matches: [] }
          );
        }

        // Refusing to guess is the point: silently taking the first of many
        // same-named officers produces a network for the wrong person.
        if (items.length > 1) {
          return makeTextResult(
            [
              `"${input.officer_name}" matches ${matches.total_results ?? items.length} officers, so no network was produced. Pick the right one and call again with its officer_id.`,
              '',
              formatOfficerSearchResults(items, matches.total_results ?? items.length),
            ].join('\n'),
            {
              officer_name: input.officer_name,
              ambiguous: true,
              match_count: matches.total_results ?? items.length,
              matches: items,
            }
          );
        }

        const only = items[0]!;
        const extracted = only.links?.self?.match(/\/officers\/([^/]+)/)?.[1];
        if (!extracted) {
          return makeTextResult(
            `Found "${only.title}" but Companies House did not return an officer id for it. Use search_officers and pass officer_id directly.`,
            { officer_name: input.officer_name, matches: items }
          );
        }
        officerId = extracted;
        resolvedFromName = only.title;
      }

      let name: string | undefined;
      let dateOfBirth: unknown;
      const collected = await collectPages<OfficerAppointment>(
        async (startIndex, itemsPerPage) => {
          const page = await getOfficerAppointments(client, officerId!, {
            items_per_page: itemsPerPage,
            start_index: startIndex,
          });
          name ??= page.name;
          dateOfBirth ??= page.date_of_birth;
          return { items: page.items ?? [], total: page.total_results };
        },
        { pageSize: input.items_per_page, maxPages: MAX_AUTO_PAGES }
      );

      const current = collected.items.filter(appointment => !appointment.resigned_on);
      const past = collected.items.filter(appointment => appointment.resigned_on);
      const displayName = name ?? resolvedFromName ?? officerId!;

      const lines: string[] = [
        `## Appointments for ${displayName}`,
        '',
        `**Officer ID:** ${officerId}`,
        `**Appointments on the register:** ${collected.total ?? collected.items.length}`,
        `**Current:** ${current.length}   **Past:** ${past.length}`,
        '',
      ];

      if (resolvedFromName) {
        lines.push(
          `_Resolved from the name "${input.officer_name}", which matched exactly one officer._`,
          ''
        );
      }

      lines.push('### Current appointments', '');
      lines.push(current.length ? formatAppointments(current, current.length) : 'None.\n');

      if (past.length) {
        lines.push('### Past appointments', '');
        lines.push(formatAppointments(past, past.length));
      }

      const coverage: CoverageEntry[] = [
        {
          resource: 'Appointments',
          status: collected.complete ? 'complete' : 'partial',
          retrieved: collected.items.length,
          total: collected.total,
          note: collected.complete
            ? undefined
            : `stopped after ${collected.pagesFetched} page(s); use get_appointments with start_index to continue`,
        },
      ];
      if (!collected.complete) lines.push(...coverageLines(coverage));

      lines.push(
        '_Appointments are grouped by Companies House officer id. The same individual may appear under more than one id, so this may not be every appointment they hold._',
        ''
      );

      return makeTextResult(lines.join('\n'), {
        officer_id: officerId,
        officer_name: name ?? resolvedFromName,
        date_of_birth: dateOfBirth,
        total_appointments: collected.total ?? collected.items.length,
        current_count: current.length,
        past_count: past.length,
        appointments: collected.items,
        coverage,
      });
    } catch (err) {
      return makeErrorResult(err, {
        notFoundSuffix: 'Use search_officers to confirm the officer id.',
      });
    }
  },
});
