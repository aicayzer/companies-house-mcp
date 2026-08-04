/**
 * Render an empty persons-with-significant-control register into prose.
 *
 * Shared by `get_ownership` and the composite summaries so they cannot tell a
 * reader different stories about the same company.
 */

import { formatDate } from '../formatters/index.js';
import { describeExemptions, formatPSCStatements, type PSCExplanation } from './ownership.js';

export interface AbsentPSCNarrative {
  /** The paragraphs explaining why the register is empty. */
  lines: string[];
  /**
   * How the absence should be recorded in a coverage list: an exempt company
   * legitimately has nothing, an unexplained one has an actual gap.
   */
  coverageNote: string;
  /** True when the absence is left unexplained and is worth remarking on. */
  unexplained: boolean;
}

export function describeAbsentPSCs(explanation: PSCExplanation): AbsentPSCNarrative {
  const lines: string[] = [];

  if (explanation.exempt) {
    lines.push(
      'No PSC entries. The company is recorded as currently exempt from the PSC requirements, which normally applies to companies whose shares are admitted to a regulated market and whose ownership is disclosed under market rules instead.',
      '',
      `Exemption(s) in force: ${describeExemptions(explanation.exemptions.filter(exemption => exemption.current))}.`,
      ''
    );
    if (explanation.expired_exemptions.length) {
      lines.push(
        `Also on record, no longer in force: ${describeExemptions(explanation.expired_exemptions)}.`,
        ''
      );
    }
    if (explanation.active_statements.length) {
      lines.push(...formatPSCStatements(explanation.active_statements));
    }
    return { lines, coverageNote: 'company is exempt', unexplained: false };
  }

  // An exemption that has ended is the single most misleading case: the
  // company is not exempt now, and saying so would invert the truth.
  if (explanation.expired_exemptions.length) {
    const latest = explanation.expired_exemptions
      .map(exemption => exemption.exempt_to)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    lines.push(
      `No PSC entries. The company held a PSC exemption but it has ended${latest ? ` (${formatDate(latest)})` : ''}, so it is not exempt now.`,
      '',
      `Exemption(s) on record, no longer in force: ${describeExemptions(explanation.expired_exemptions)}.`,
      ''
    );
    if (explanation.active_statements.length) {
      lines.push('A statement has been filed in place of a PSC entry:', '');
      lines.push(...formatPSCStatements(explanation.active_statements));
      return {
        lines,
        coverageNote: 'exemption ended; a statement was filed in place of an entry',
        unexplained: false,
      };
    }
    lines.push(
      'No statement has been filed in place of an entry either, so ownership cannot be established from the register.',
      ''
    );
    return { lines, coverageNote: 'exemption ended, nothing filed since', unexplained: true };
  }

  if (explanation.active_statements.length) {
    lines.push('No PSC entries. A statement has been filed in place of an entry.', '');
    lines.push(...formatPSCStatements(explanation.active_statements));
    return {
      lines,
      coverageNote: 'a statement was filed in place of an entry',
      unexplained: false,
    };
  }

  if (explanation.statements.length) {
    lines.push(
      'No PSC entries. A statement was filed in place of an entry but has since been withdrawn.',
      ''
    );
    lines.push(...formatPSCStatements(explanation.statements));
    return { lines, coverageNote: 'the filed statement was withdrawn', unexplained: true };
  }

  lines.push(
    'No PSC entries, no exemption in force, and no statement filed in place of one. The company may not have filed PSC information. This is an absence of data, not evidence about who controls the company.',
    ''
  );
  return { lines, coverageNote: 'nothing recorded', unexplained: true };
}
