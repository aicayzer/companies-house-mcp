import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
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
  formatPSCs,
  formatCharges,
  formatInsolvency,
  formatFilings,
  formatCompanyStatus,
  formatDate,
  formatAppointments,
  formatOfficerSearchResults,
} from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

// ── company_report ──────────────────────────────────────────────────────
const reportShape = {
  company_number: z.string().describe('Companies House company number'),
};
const reportSchema = z.object(reportShape);

registerTool({
  name: 'company_report',
  description:
    'Generate a comprehensive company report in a single call. Returns: full profile, active officers, PSCs/ownership, outstanding charges, recent filings (last 10), and insolvency status. This is the recommended starting point for any company research — one tool call instead of six.',
  inputSchema: reportShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = reportSchema.parse(params);

    try {
      const [profile, officers, pscs, charges, filings, insolvency] = await Promise.allSettled([
        getCompanyProfile(client, company_number),
        getCompanyOfficers(client, company_number, { items_per_page: 50 }),
        getPersonsWithSignificantControl(client, company_number, { items_per_page: 25 }),
        getCompanyCharges(client, company_number, { items_per_page: 25 }),
        getFilingHistory(client, company_number, { items_per_page: 10 }),
        getCompanyInsolvency(client, company_number),
      ]);

      if (profile.status === 'rejected') {
        return makeErrorResult(
          `Could not fetch company profile: ${profile.reason?.message ?? 'Unknown error'}. Try search_companies to find the correct company number.`
        );
      }

      const sections: string[] = [];
      const structured: Record<string, unknown> = {};

      // Profile
      sections.push(formatCompanyProfile(profile.value));
      structured.profile = profile.value;

      // Officers
      if (officers.status === 'fulfilled') {
        const activeOfficers = (officers.value.items ?? []).filter(o => !o.resigned_on);
        sections.push('\n---\n## Active Officers\n');
        sections.push(formatOfficers(activeOfficers, activeOfficers.length));
        structured.officers = officers.value;
      } else {
        sections.push('\n---\n## Officers\n*Could not retrieve officer data.*');
      }

      // PSCs
      if (pscs.status === 'fulfilled') {
        sections.push('\n---\n## Ownership (PSCs)\n');
        sections.push(formatPSCs(pscs.value.items ?? [], pscs.value.total_results ?? 0));
        structured.pscs = pscs.value;
      } else {
        sections.push('\n---\n## Ownership\n*No PSC data available.*');
      }

      // Charges
      if (charges.status === 'fulfilled') {
        const outstanding = (charges.value.items ?? []).filter(c => c.status !== 'fully-satisfied');
        sections.push('\n---\n## Outstanding Charges\n');
        if (outstanding.length > 0) {
          sections.push(formatCharges(outstanding, outstanding.length));
        } else {
          sections.push('No outstanding charges.');
        }
        structured.charges = charges.value;
      } else {
        sections.push('\n---\n## Charges\n*No charge data available.*');
      }

      // Recent filings
      if (filings.status === 'fulfilled') {
        sections.push('\n---\n## Recent Filings (Last 10)\n');
        sections.push(formatFilings(filings.value.items ?? [], filings.value.total_count ?? 0));
        structured.filings = filings.value;
      } else {
        sections.push('\n---\n## Filings\n*Could not retrieve filing data.*');
      }

      // Insolvency
      if (insolvency.status === 'fulfilled') {
        const cases = insolvency.value.cases ?? [];
        if (cases.length > 0) {
          sections.push('\n---\n## Insolvency\n');
          sections.push(formatInsolvency(cases));
        } else {
          sections.push('\n---\n## Insolvency\nNo insolvency proceedings.');
        }
        structured.insolvency = insolvency.value;
      } else {
        sections.push('\n---\n## Insolvency\nNo insolvency history.');
      }

      return makeTextResult(sections.join('\n'), structured);
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── due_diligence_check ─────────────────────────────────────────────────
const ddShape = {
  company_number: z.string().describe('Companies House company number'),
};
const ddSchema = z.object(ddShape);

interface RedFlag {
  category: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

registerTool({
  name: 'due_diligence_check',
  description:
    'Run an automated due diligence red-flag scan on a UK company. Checks: company status (dissolved, liquidation, etc.), insolvency history, outstanding charges, overdue accounts, overdue confirmation statement, PSC warnings, and recently resigned officers. Returns a structured risk assessment with severity levels.',
  inputSchema: ddShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = ddSchema.parse(params);

    try {
      const [profile, officers, pscs, charges, insolvency] = await Promise.allSettled([
        getCompanyProfile(client, company_number),
        getCompanyOfficers(client, company_number, { items_per_page: 100 }),
        getPersonsWithSignificantControl(client, company_number, { items_per_page: 25 }),
        getCompanyCharges(client, company_number, { items_per_page: 100 }),
        getCompanyInsolvency(client, company_number),
      ]);

      if (profile.status === 'rejected') {
        return makeErrorResult(`Could not fetch company: ${profile.reason?.message}`);
      }

      const p = profile.value;
      const flags: RedFlag[] = [];

      // Company status checks
      if (['dissolved', 'liquidation', 'receivership', 'administration', 'insolvency-proceedings'].includes(p.company_status)) {
        flags.push({
          category: 'Company Status',
          severity: 'high',
          detail: `Company is ${formatCompanyStatus(p.company_status)}`,
        });
      }
      if (p.company_status === 'voluntary-arrangement') {
        flags.push({
          category: 'Company Status',
          severity: 'medium',
          detail: 'Company is in a voluntary arrangement',
        });
      }

      // Insolvency — consolidate into a single flag to avoid duplication
      {
        const insolvencyDetails: string[] = [];
        if (p.has_insolvency_history) insolvencyDetails.push('has insolvency history');
        if (insolvency.status === 'fulfilled' && (insolvency.value.cases?.length ?? 0) > 0) {
          insolvencyDetails.push(`${insolvency.value.cases!.length} case(s) on record`);
        }
        if (p.has_been_liquidated) insolvencyDetails.push('has been liquidated');
        if (insolvencyDetails.length > 0) {
          flags.push({
            category: 'Insolvency',
            severity: 'high',
            detail: `Company ${insolvencyDetails.join(', ')}`,
          });
        }
      }

      // Accounts overdue
      if (p.accounts?.overdue || p.accounts?.next_accounts?.overdue) {
        flags.push({
          category: 'Accounts',
          severity: 'high',
          detail: 'Accounts are overdue',
        });
      }

      // Confirmation statement overdue
      if (p.confirmation_statement?.overdue) {
        flags.push({
          category: 'Confirmation Statement',
          severity: 'medium',
          detail: 'Confirmation statement is overdue',
        });
      }

      // Charges
      if (charges.status === 'fulfilled') {
        const outstanding = (charges.value.items ?? []).filter(c => c.status !== 'fully-satisfied');
        if (outstanding.length > 0) {
          flags.push({
            category: 'Charges',
            severity: 'medium',
            detail: `${outstanding.length} outstanding charge(s)`,
          });
        }
      }

      // Registered office issues
      if (p.registered_office_is_in_dispute) {
        flags.push({
          category: 'Registered Office',
          severity: 'medium',
          detail: 'Registered office address is in dispute',
        });
      }
      if (p.undeliverable_registered_office_address) {
        flags.push({
          category: 'Registered Office',
          severity: 'medium',
          detail: 'Registered office address is undeliverable',
        });
      }

      // Officer checks
      if (officers.status === 'fulfilled') {
        const allOfficers = officers.value.items ?? [];
        const active = allOfficers.filter(o => !o.resigned_on);
        const recentlyResigned = allOfficers.filter(o => {
          if (!o.resigned_on) return false;
          const resigned = new Date(o.resigned_on);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return resigned > sixMonthsAgo;
        });

        if (active.length === 0) {
          flags.push({
            category: 'Officers',
            severity: 'high',
            detail: 'No active officers found',
          });
        }
        if (active.length === 1) {
          flags.push({
            category: 'Officers',
            severity: 'low',
            detail: 'Only one active officer (sole director)',
          });
        }
        if (recentlyResigned.length > 0) {
          flags.push({
            category: 'Officers',
            severity: 'medium',
            detail: `${recentlyResigned.length} officer(s) resigned in the last 6 months`,
          });
        }
      }

      // PSC checks
      if (pscs.status === 'fulfilled') {
        const activePSCs = (pscs.value.items ?? []).filter(psc => !psc.ceased_on);
        if (activePSCs.length === 0 && p.company_status === 'active') {
          flags.push({
            category: 'Ownership',
            severity: 'medium',
            detail: 'No active PSCs registered for an active company',
          });
        }
      }

      // Company age
      if (p.date_of_creation) {
        const created = new Date(p.date_of_creation);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (created > oneYearAgo) {
          flags.push({
            category: 'Company Age',
            severity: 'low',
            detail: `Company is less than one year old (incorporated ${formatDate(p.date_of_creation)})`,
          });
        }
      }

      // Build report
      const high = flags.filter(f => f.severity === 'high');
      const medium = flags.filter(f => f.severity === 'medium');
      const low = flags.filter(f => f.severity === 'low');

      const riskLevel = high.length > 0 ? 'HIGH' : medium.length > 0 ? 'MEDIUM' : low.length > 0 ? 'LOW' : 'CLEAR';

      const lines: string[] = [
        `## Due Diligence Report: ${p.company_name}`,
        '',
        `**Company Number:** ${p.company_number}`,
        `**Status:** ${formatCompanyStatus(p.company_status)}`,
        `**Risk Level:** ${riskLevel}`,
        '',
      ];

      if (flags.length === 0) {
        lines.push('No red flags identified. Company appears to be in good standing.');
      } else {
        lines.push(`### ${flags.length} Flag(s) Found\n`);
        if (high.length) {
          lines.push('#### High Severity');
          for (const f of high) lines.push(`- **${f.category}:** ${f.detail}`);
          lines.push('');
        }
        if (medium.length) {
          lines.push('#### Medium Severity');
          for (const f of medium) lines.push(`- **${f.category}:** ${f.detail}`);
          lines.push('');
        }
        if (low.length) {
          lines.push('#### Low Severity');
          for (const f of low) lines.push(`- **${f.category}:** ${f.detail}`);
          lines.push('');
        }
      }

      return makeTextResult(lines.join('\n'), {
        company_number,
        company_name: p.company_name,
        risk_level: riskLevel,
        flags,
        flag_count: { high: high.length, medium: medium.length, low: low.length },
      });
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── officer_network ─────────────────────────────────────────────────────
const networkShape = {
  officer_id: z.string().optional().describe('Officer ID (from search_officers). Provide this OR officer_name.'),
  officer_name: z.string().optional().describe('Officer name to search for. Provide this OR officer_id.'),
};
const networkSchema = z.object(networkShape).refine(data => data.officer_id || data.officer_name, {
  message: 'Provide either officer_id or officer_name',
});

registerTool({
  name: 'officer_network',
  description:
    'Map an officer\'s network of company appointments. Given an officer ID or name, finds all their current and past directorships/appointments. Shows connected companies, their statuses, and roles held. Useful for investigating directors across multiple companies.',
  inputSchema: networkShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = networkSchema.parse(params);

    try {
      let officerId = input.officer_id;
      let officerName = input.officer_name;

      // If only name provided, search for the officer
      if (!officerId && officerName) {
        const searchResult = await searchOfficers(client, { q: officerName, items_per_page: 5 });
        if (!searchResult.items?.length) {
          return makeTextResult(
            `No officers found matching "${officerName}". Try search_officers for alternative spellings.`,
            { items: [] }
          );
        }
        const first = searchResult.items[0]!;
        const match = first.links?.self?.match(/\/officers\/([^/]+)/);
        if (!match?.[1]) {
          return makeTextResult(
            `Found officer "${first.title}" but could not extract officer ID. Use search_officers to find the officer ID, then call officer_network with officer_id.\n\nResults:\n\n${formatOfficerSearchResults(searchResult.items, searchResult.total_results)}`,
            searchResult as unknown as Record<string, unknown>
          );
        }
        officerId = match[1];
        officerName = first.title;

        // Warn if multiple results — user may want a different officer
        if (searchResult.total_results > 1) {
          // We'll prepend a note to the output later
          officerName = `${first.title} (note: ${searchResult.total_results} officers matched "${input.officer_name}" — using first result. Use search_officers + officer_id for precision)`;
        }
      }

      const appointments = await getOfficerAppointments(client, officerId!, { items_per_page: 100 });

      const active = (appointments.items ?? []).filter(a => !a.resigned_on);
      const resigned = (appointments.items ?? []).filter(a => a.resigned_on);

      const lines: string[] = [
        `## Officer Network: ${appointments.name ?? officerName ?? officerId}`,
        '',
        `**Total Appointments:** ${appointments.total_results ?? appointments.items?.length ?? 0}`,
        `**Active:** ${active.length}`,
        `**Resigned:** ${resigned.length}`,
        '',
      ];

      if (active.length > 0) {
        lines.push('### Current Appointments\n');
        lines.push(formatAppointments(active, active.length));
      } else {
        lines.push('### Current Appointments\nNo current appointments.\n');
      }

      if (resigned.length > 0) {
        lines.push('### Past Appointments\n');
        lines.push(formatAppointments(resigned, resigned.length));
      }

      return makeTextResult(lines.join('\n'), {
        officer_id: officerId,
        officer_name: appointments.name ?? officerName,
        total_appointments: appointments.total_results ?? 0,
        active_count: active.length,
        resigned_count: resigned.length,
        appointments: appointments as unknown as Record<string, unknown>,
      });
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
