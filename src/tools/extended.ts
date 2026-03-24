import { z } from 'zod';
import { registerTool, TOOL_ANNOTATIONS, makeTextResult, makeErrorResult } from './registry.js';
import { getCompanyRegisters } from '../api/endpoints/company.js';
import { getExemptions, getUKEstablishments } from '../api/endpoints/exemptions.js';
import { getNaturalDisqualification, getCorporateDisqualification } from '../api/endpoints/officers.js';
import { getFilingItem } from '../api/endpoints/filing.js';
import { formatDate, formatAddress } from '../formatters/index.js';
import type { APIClient } from '../api/client.js';

// ── get_company_registers ───────────────────────────────────────────────
const registersShape = {
  company_number: z.string().describe('Companies House company number'),
};
const registersSchema = z.object(registersShape);

registerTool({
  name: 'get_company_registers',
  description:
    'Get the statutory registers for a UK company — where the company holds its registers of directors, secretaries, members, and PSCs. Shows whether registers are held at Companies House or elsewhere.',
  inputSchema: registersShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = registersSchema.parse(params);
    try {
      const result = await getCompanyRegisters(client, company_number);
      const lines: string[] = ['## Company Registers\n'];
      if (result.registers) {
        for (const [key, reg] of Object.entries(result.registers)) {
          lines.push(`### ${key}`);
          lines.push(`Type: ${reg.register_type}`);
          for (const item of reg.items) {
            lines.push(`- Moved to ${item.register_moved_to} on ${formatDate(item.moved_on)}`);
          }
          lines.push('');
        }
      } else {
        lines.push('No register information available.');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) {
        return makeTextResult('No register information available for this company.', {});
      }
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_exemptions ──────────────────────────────────────────────────────
const exemptionsShape = {
  company_number: z.string().describe('Companies House company number'),
};
const exemptionsSchema = z.object(exemptionsShape);

registerTool({
  name: 'get_exemptions',
  description:
    'Get exemptions for a UK company (e.g. exemption from filing full accounts, PSC exemptions). Most companies have no exemptions.',
  inputSchema: exemptionsShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = exemptionsSchema.parse(params);
    try {
      const result = await getExemptions(client, company_number);
      const lines: string[] = ['## Company Exemptions\n'];
      if (result.exemptions) {
        for (const [key, exemption] of Object.entries(result.exemptions)) {
          lines.push(`### ${key}`);
          lines.push(`Type: ${exemption.exemption_type}`);
          for (const item of exemption.items) {
            lines.push(`- From: ${formatDate(item.exempt_from)}${item.exempt_to ? ` to ${formatDate(item.exempt_to)}` : ' (ongoing)'}`);
          }
          lines.push('');
        }
      } else {
        lines.push('No exemptions.');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) {
        return makeTextResult('No exemptions for this company.', {});
      }
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_uk_establishments ───────────────────────────────────────────────
const establishmentsShape = {
  company_number: z.string().describe('Companies House company number (typically an overseas company)'),
};
const establishmentsSchema = z.object(establishmentsShape);

registerTool({
  name: 'get_uk_establishments',
  description:
    'Get UK establishments of an overseas company. Returns a list of UK branches/establishments registered at Companies House.',
  inputSchema: establishmentsShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const { company_number } = establishmentsSchema.parse(params);
    try {
      const result = await getUKEstablishments(client, company_number);
      const items = result.items ?? [];
      if (!items.length) {
        return makeTextResult('No UK establishments found.', result as unknown as Record<string, unknown>);
      }
      const lines = [`${items.length} UK establishment(s):\n`];
      for (const est of items) {
        lines.push(`### ${est.company_name}`);
        lines.push(`- **Number:** ${est.company_number}`);
        lines.push(`- **Status:** ${est.company_status}`);
        if (est.locality) lines.push(`- **Location:** ${est.locality}`);
        lines.push('');
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_officer_disqualifications ───────────────────────────────────────
const disqualificationsShape = {
  officer_id: z.string().describe('Officer ID'),
  is_corporate: z.boolean().default(false).describe('Whether the officer is a corporate entity'),
};
const disqualificationsSchema = z.object(disqualificationsShape);

registerTool({
  name: 'get_officer_disqualifications',
  description:
    'Check if an officer has been disqualified from acting as a company director. Returns disqualification details including reason, duration, court name, and associated companies.',
  inputSchema: disqualificationsShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = disqualificationsSchema.parse(params);
    try {
      const result = input.is_corporate
        ? await getCorporateDisqualification(client, input.officer_id)
        : await getNaturalDisqualification(client, input.officer_id);

      if (!result.disqualifications?.length) {
        return makeTextResult('No disqualifications found for this officer.', {});
      }

      const lines: string[] = ['## Officer Disqualifications\n'];
      if (result.forename || result.surname) {
        lines.push(`**Name:** ${[result.title, result.forename, result.other_forenames, result.surname].filter(Boolean).join(' ')}`);
      }
      for (const disq of result.disqualifications) {
        lines.push(`\n### Disqualification`);
        lines.push(`- **From:** ${formatDate(disq.disqualified_from)}`);
        lines.push(`- **Until:** ${formatDate(disq.disqualified_until)}`);
        if (disq.reason) {
          lines.push(`- **Reason:** ${disq.reason.description_identifier ?? disq.reason.act} ${disq.reason.section}`);
        }
        if (disq.court_name) lines.push(`- **Court:** ${disq.court_name}`);
        if (disq.heard_on) lines.push(`- **Heard:** ${formatDate(disq.heard_on)}`);
        if (disq.address) lines.push(`- **Address:** ${formatAddress(disq.address)}`);
        if (disq.company_names?.length) {
          lines.push(`- **Companies:** ${disq.company_names.join(', ')}`);
        }
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) {
        return makeTextResult('No disqualifications found for this officer.', {});
      }
      return makeErrorResult((err as Error).message);
    }
  },
});

// ── get_filing_document ─────────────────────────────────────────────────
const filingDocShape = {
  company_number: z.string().describe('Companies House company number'),
  transaction_id: z.string().describe('Filing transaction ID (from get_filings)'),
};
const filingDocSchema = z.object(filingDocShape);

registerTool({
  name: 'get_filing_document',
  description:
    'Get metadata and details for a specific filing document. Use the transaction_id from get_filings results.',
  inputSchema: filingDocShape,
  annotations: TOOL_ANNOTATIONS,
  async execute(client: APIClient, params: unknown) {
    const input = filingDocSchema.parse(params);
    try {
      const result = await getFilingItem(client, input.company_number, input.transaction_id);
      const lines: string[] = ['## Filing Document\n'];
      const items = Array.isArray(result.items) ? result.items : [result];
      for (const item of items) {
        if ('description' in item) {
          lines.push(`**Description:** ${item.description}`);
        }
        if ('date' in item) {
          lines.push(`**Date:** ${formatDate(item.date as string)}`);
        }
        if ('category' in item) {
          lines.push(`**Category:** ${item.category}`);
        }
        if ('type' in item) {
          lines.push(`**Type:** ${item.type}`);
        }
      }
      return makeTextResult(lines.join('\n'), result as unknown as Record<string, unknown>);
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
