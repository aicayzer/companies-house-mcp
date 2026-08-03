/**
 * Input schemas shared by the tools.
 *
 * Companies House does not publish maximum page sizes, and its search
 * endpoints degrade rather than error when pushed past their real limits, so
 * requests are clamped here instead of relying on the API to reject them.
 */

import { z } from 'zod';

/** Companies House pads numeric company numbers to eight digits. */
export function normaliseCompanyNumber(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(8, '0');
  return trimmed;
}

export const companyNumberSchema = z
  .string()
  .min(1, 'A company number is required.')
  .transform(normaliseCompanyNumber)
  .describe(
    'Companies House company number. Eight characters, zero-padded — "00445790", "SC311560", "NI012345", "OC301234". Shorter all-digit numbers are padded automatically. Use search_companies if you only know the name.'
  );

export const officerIdSchema = z
  .string()
  .min(1)
  .describe(
    'Companies House officer id, taken from search_officers results or the `links.officer.appointments` path on an officer record.'
  );

export function pageSizeSchema(defaultValue: number, max = 100) {
  return z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(defaultValue)
    .describe(`Records to return in one page (1–${max}, default ${defaultValue}).`);
}

export const startIndexSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe('Zero-based offset into the list. Use the value suggested by the previous response.');

/**
 * Companies House search is tuned for finding a specific name rather than
 * enumerating the register, and reports errors well before an unbounded
 * offset. Requests are kept inside the range that behaves predictably.
 */
export const SEARCH_MAX_START_INDEX = 900;

export const searchStartIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(SEARCH_MAX_START_INDEX)
  .default(0)
  .describe(
    `Zero-based offset into the results (0–${SEARCH_MAX_START_INDEX}). Companies House search is not a bulk export; narrow the query rather than paging deeply.`
  );

/** How many pages one tool call will fetch when it needs the whole list. */
export const MAX_AUTO_PAGES = 5;
