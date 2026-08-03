import { z } from 'zod';
import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
  isNotFound,
} from './registry.js';
import { getCompanyRegisters } from '../api/endpoints/company.js';
import { getExemptions, getUKEstablishments } from '../api/endpoints/exemptions.js';
import {
  getNaturalDisqualification,
  getCorporateDisqualification,
} from '../api/endpoints/officers.js';
import { getFilingItem } from '../api/endpoints/filing.js';
import { formatDate, formatAddress, formatCompanyStatus, filingDocumentId } from '../formatters/index.js';
import { companyNumberSchema, officerIdSchema } from './shared.js';
import type { APIClient } from '../api/client.js';

// ── get_company_registers ───────────────────────────────────────────────
const registersSchema = z.object({ company_number: companyNumberSchema });

registerTool({
  name: 'get_company_registers',
  title: 'Get Company Registers',
  description:
    'Report where a company keeps its statutory registers of directors, secretaries, members and PSCs — at Companies House or at its own address. Companies House holds no register record for most companies, which the response reports as an absence rather than an error.',
  inputSchema: registersSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = registersSchema.parse(params);
    try {
      const result = await getCompanyRegisters(client, company_number);
      const registers = Object.entries(result.registers ?? {});
      if (!registers.length) {
        return makeTextResult(
          'Companies House holds no statutory register record for this company. The company keeps its own registers.',
          result as unknown as Record<string, unknown>
        );
      }

      const lines: string[] = ['## Statutory registers', ''];
      for (const [key, register] of registers) {
        lines.push(`### ${key.replace(/_/g, ' ')}`);
        lines.push(`- **Held at:** ${register.register_type}`);
        for (const item of register.items) {
          lines.push(`- Moved to ${item.register_moved_to} on ${formatDate(item.moved_on)}`);
        }
        lines.push('');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if (isNotFound(err)) {
        return makeTextResult(
          'Companies House holds no statutory register record for this company. The company keeps its own registers.',
          { registers: {} }
        );
      }
      return makeErrorResult(err);
    }
  },
});

// ── get_exemptions ──────────────────────────────────────────────────────
const exemptionsSchema = z.object({ company_number: companyNumberSchema });

registerTool({
  name: 'get_exemptions',
  title: 'Get Company Exemptions',
  description:
    'List the disclosure exemptions recorded for a UK company, with the dates each applies from and to. The most common is exemption from the persons-with-significant-control requirements for companies whose shares trade on a regulated market. Most companies have none.',
  inputSchema: exemptionsSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = exemptionsSchema.parse(params);
    try {
      const result = await getExemptions(client, company_number);
      const exemptions = Object.entries(result.exemptions ?? {});
      if (!exemptions.length) {
        return makeTextResult(
          'No exemptions are recorded for this company.',
          result as unknown as Record<string, unknown>
        );
      }

      const lines: string[] = ['## Exemptions', ''];
      for (const [key, exemption] of exemptions) {
        lines.push(`### ${key.replace(/_/g, ' ')}`);
        lines.push(`- **Type:** ${exemption.exemption_type}`);
        for (const item of exemption.items) {
          lines.push(
            `- From ${formatDate(item.exempt_from)}${item.exempt_to ? ` to ${formatDate(item.exempt_to)}` : ' (ongoing)'}`
          );
        }
        lines.push('');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if (isNotFound(err)) {
        return makeTextResult('No exemptions are recorded for this company.', { exemptions: {} });
      }
      return makeErrorResult(err);
    }
  },
});

// ── get_uk_establishments ───────────────────────────────────────────────
const establishmentsSchema = z.object({
  company_number: companyNumberSchema,
});

registerTool({
  name: 'get_uk_establishments',
  title: 'Get UK Establishments',
  description:
    'List the UK establishments registered by an overseas company — its UK branches, each with its own company number and status. Applies to overseas companies, typically those with an FC-prefixed number; UK-incorporated companies have none.',
  inputSchema: establishmentsSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'company',
  async execute(client: APIClient, params: unknown) {
    const { company_number } = establishmentsSchema.parse(params);
    try {
      const result = await getUKEstablishments(client, company_number);
      const items = result.items ?? [];
      if (!items.length) {
        return makeTextResult(
          'No UK establishments are registered for this company.',
          result as unknown as Record<string, unknown>
        );
      }
      const lines = [`${items.length} UK establishment(s):`, ''];
      for (const establishment of items) {
        lines.push(`### ${establishment.company_name}`);
        lines.push(`- **Number:** ${establishment.company_number}`);
        lines.push(`- **Status:** ${formatCompanyStatus(establishment.company_status)}`);
        if (establishment.locality) lines.push(`- **Location:** ${establishment.locality}`);
        lines.push('');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if (isNotFound(err)) {
        return makeTextResult('No UK establishments are registered for this company.', {
          items: [],
        });
      }
      return makeErrorResult(err);
    }
  },
});

// ── get_officer_disqualifications ───────────────────────────────────────
const disqualificationsSchema = z.object({
  officer_id: officerIdSchema,
  is_corporate: z
    .boolean()
    .default(false)
    .describe('Set true for a corporate officer. Default false queries the natural-person register.'),
});

registerTool({
  name: 'get_officer_disqualifications',
  title: 'Get Officer Disqualifications',
  description:
    'Look up an officer id in the Companies House register of disqualified directors and return any disqualification with its dates, statutory reason, court and the companies named. An empty result means no disqualification is recorded against that officer id — it is not a confirmation that the person has never been disqualified, since the same individual can appear under more than one id.',
  inputSchema: disqualificationsSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'people',
  async execute(client: APIClient, params: unknown) {
    const input = disqualificationsSchema.parse(params);
    const emptyMessage =
      'No disqualification is recorded against this officer id. That is not a confirmation that the person has never been disqualified — check other officer ids for the same individual if it matters.';
    try {
      const result = input.is_corporate
        ? await getCorporateDisqualification(client, input.officer_id)
        : await getNaturalDisqualification(client, input.officer_id);

      if (!result.disqualifications?.length) {
        return makeTextResult(emptyMessage, { disqualifications: [] });
      }

      const lines: string[] = ['## Disqualifications', ''];
      if (result.forename || result.surname) {
        lines.push(
          `**Name:** ${[result.title, result.forename, result.other_forenames, result.surname].filter(Boolean).join(' ')}`,
          ''
        );
      }
      for (const disqualification of result.disqualifications) {
        lines.push('### Disqualification');
        lines.push(`- **From:** ${formatDate(disqualification.disqualified_from)}`);
        lines.push(`- **Until:** ${formatDate(disqualification.disqualified_until)}`);
        if (disqualification.reason) {
          lines.push(
            `- **Reason:** ${[disqualification.reason.description_identifier ?? disqualification.reason.act, disqualification.reason.section].filter(Boolean).join(' ')}`
          );
        }
        if (disqualification.court_name) lines.push(`- **Court:** ${disqualification.court_name}`);
        if (disqualification.heard_on) {
          lines.push(`- **Heard:** ${formatDate(disqualification.heard_on)}`);
        }
        if (disqualification.address) {
          lines.push(`- **Address:** ${formatAddress(disqualification.address)}`);
        }
        if (disqualification.company_names?.length) {
          lines.push(`- **Companies named:** ${disqualification.company_names.join(', ')}`);
        }
        lines.push('');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if (isNotFound(err)) {
        return makeTextResult(emptyMessage, { disqualifications: [] });
      }
      return makeErrorResult(err);
    }
  },
});

// ── get_filing_document ─────────────────────────────────────────────────
const filingDocSchema = z.object({
  company_number: companyNumberSchema,
  transaction_id: z
    .string()
    .min(1)
    .describe('Transaction id of a single filing, taken from get_filings results.'),
});

registerTool({
  name: 'get_filing_document',
  title: 'Get Filing Details',
  description:
    'Read the full detail of one filing by its transaction id: description, date, category, type, page count and the document id needed to retrieve the document itself. This returns the filing record, not the filed document — use download_filing_document for the document.',
  inputSchema: filingDocSchema,
  annotations: TOOL_ANNOTATIONS,
  group: 'filings',
  async execute(client: APIClient, params: unknown) {
    const input = filingDocSchema.parse(params);
    try {
      const filing = await getFilingItem(client, input.company_number, input.transaction_id);
      const documentId = filingDocumentId(filing);

      const lines: string[] = [`## ${filing.description ?? 'Filing'}`, ''];
      if (filing.date) lines.push(`- **Date:** ${formatDate(filing.date)}`);
      if (filing.category) lines.push(`- **Category:** ${filing.category}`);
      if (filing.type) lines.push(`- **Type:** ${filing.type}`);
      if (filing.transaction_id) lines.push(`- **Transaction ID:** ${filing.transaction_id}`);
      if (filing.pages) lines.push(`- **Pages:** ${filing.pages}`);
      if (filing.paper_filed) lines.push('- **Paper filed:** yes');
      lines.push(
        documentId
          ? `- **Document ID:** ${documentId} — pass this to download_filing_document.`
          : '- **Document:** no document is held for this filing.'
      );

      if (filing.associated_filings?.length) {
        lines.push('', '### Associated filings', '');
        for (const associated of filing.associated_filings) {
          lines.push(`- ${associated.description} (${formatDate(associated.date)})`);
        }
      }

      return makeTextResult(lines.join('\n'), {
        ...(filing as unknown as Record<string, unknown>),
        ...(documentId ? { document_id: documentId } : {}),
      });
    } catch (err) {
      if (isNotFound(err)) {
        return makeErrorResult(err, {
          prefix: 'No filing matches that transaction id.',
          suffix: 'Use get_filings to list valid transaction ids for this company.',
        });
      }
      return makeErrorResult(err);
    }
  },
});
