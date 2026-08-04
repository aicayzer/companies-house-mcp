import type {
  Address,
  CompanyProfile,
  CompanyOfficer,
  CompanySearchItem,
  FilingHistoryItem,
  Charge,
  PSCItem,
  InsolvencyCase,
  OfficerSearchItem,
  OfficerAppointment,
} from '../types/index.js';

export function formatAddress(address?: Address): string {
  if (!address) return 'Not available';
  const parts = [
    address.care_of,
    address.premises,
    address.po_box ? `PO Box ${address.po_box}` : undefined,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ].filter(Boolean);
  return parts.join(', ') || 'Not available';
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    // Companies House dates are plain calendar dates and parse as UTC midnight.
    // Formatting in the host's zone would shift them a day for callers west of
    // UTC, so the zone is pinned.
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

export function formatCompanyStatusDetail(detail: string): string {
  const detailMap: Record<string, string> = {
    'transferred-from-uk': 'Transferred from the UK',
    'active-proposal-to-strike-off': 'Active, with a proposal to strike off',
    'petition-to-restore-dissolved': 'Petition to restore a dissolved company',
    'transformed-to-se': 'Transformed to an SE',
    'converted-to-plc': 'Converted to a PLC',
  };
  return detailMap[detail] ?? detail.replace(/-/g, ' ');
}

export interface PaginationState {
  start_index: number;
  items_per_page: number;
  returned: number;
  total?: number;
  /** The highest offset this endpoint accepts, where one is enforced. */
  max_start_index?: number;
}

/**
 * A one-line footer telling the caller exactly where it is in a list and how
 * to ask for the next page. Without this an agent cannot tell a complete
 * answer from the first page of a long one.
 */
export function formatPagination({
  start_index,
  items_per_page,
  returned,
  total,
  max_start_index,
}: PaginationState): string {
  // An empty page is explained by `emptyPageText` in the tool itself, which
  // knows what kind of record is missing. Repeating it here would say the same
  // thing twice.
  if (returned === 0) return '';

  const first = start_index + 1;
  const last = start_index + returned;
  if (total === undefined) {
    return `_Showing records ${first}–${last}._`;
  }
  if (last >= total) {
    return `_Showing records ${first}–${last} of ${total}. This is the last page._`;
  }
  // Never suggest an offset the tool would then reject.
  if (max_start_index !== undefined && last > max_start_index) {
    return `_Showing records ${first}–${last} of ${total}. That is as far as this endpoint pages; narrow the query to see more._`;
  }
  return `_Showing records ${first}–${last} of ${total}. For the next page, call again with start_index: ${last}, items_per_page: ${items_per_page}._`;
}

export function formatCompanyStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'Active',
    dissolved: 'Dissolved',
    liquidation: 'In Liquidation',
    receivership: 'In Receivership',
    administration: 'In Administration',
    'voluntary-arrangement': 'Voluntary Arrangement',
    'converted-closed': 'Converted/Closed',
    'insolvency-proceedings': 'Insolvency Proceedings',
    registered: 'Registered',
    removed: 'Removed',
    closed: 'Closed',
    open: 'Open',
  };
  return statusMap[status] ?? status;
}

export function formatCompanyType(type: string): string {
  const typeMap: Record<string, string> = {
    ltd: 'Private Limited Company',
    plc: 'Public Limited Company',
    'old-public-company': 'Old Public Company',
    'private-unlimited': 'Private Unlimited Company',
    'private-limited-guarant-nsc-limited-exemption':
      'Private Limited by Guarantee (No Share Capital, Exempt)',
    'private-limited-guarant-nsc': 'Private Limited by Guarantee (No Share Capital)',
    'private-limited-shares-section-30-exemption': 'Private Limited by Shares (Section 30 Exempt)',
    'private-unlimited-nsc': 'Private Unlimited (No Share Capital)',
    llp: 'Limited Liability Partnership',
    'scottish-partnership': 'Scottish Partnership',
    'charitable-incorporated-organisation': 'Charitable Incorporated Organisation',
    'scottish-charitable-incorporated-organisation':
      'Scottish Charitable Incorporated Organisation',
    'industrial-and-provident-society': 'Industrial and Provident Society',
    'registered-society-non-jurisdictional': 'Registered Society',
    'royal-charter': 'Royal Charter Company',
    'investment-company-with-variable-capital': 'Investment Company with Variable Capital',
    'unregistered-company': 'Unregistered Company',
    'registered-overseas-entity': 'Registered Overseas Entity',
    'european-public-limited-liability-company-se':
      'European Public Limited Liability Company (SE)',
  };
  return typeMap[type] ?? type;
}

export function formatOfficerRole(role: string): string {
  const roleMap: Record<string, string> = {
    director: 'Director',
    secretary: 'Secretary',
    'corporate-director': 'Corporate Director',
    'corporate-secretary': 'Corporate Secretary',
    'corporate-nominee-director': 'Corporate Nominee Director',
    'corporate-nominee-secretary': 'Corporate Nominee Secretary',
    'judicial-factor': 'Judicial Factor',
    'llp-member': 'LLP Member',
    'llp-designated-member': 'LLP Designated Member',
    'corporate-llp-member': 'Corporate LLP Member',
    'corporate-llp-designated-member': 'Corporate LLP Designated Member',
    'nominee-director': 'Nominee Director',
    'nominee-secretary': 'Nominee Secretary',
    'cic-manager': 'CIC Manager',
    'managing-officer': 'Managing Officer',
    'corporate-managing-officer': 'Corporate Managing Officer',
  };
  return roleMap[role] ?? role;
}

export function formatNatureOfControl(nature: string): string {
  const controlMap: Record<string, string> = {
    'ownership-of-shares-25-to-50-percent': 'Owns 25-50% of shares',
    'ownership-of-shares-50-to-75-percent': 'Owns 50-75% of shares',
    'ownership-of-shares-75-to-100-percent': 'Owns 75-100% of shares',
    'ownership-of-shares-25-to-50-percent-as-trust': 'Owns 25-50% of shares (held in trust)',
    'ownership-of-shares-50-to-75-percent-as-trust': 'Owns 50-75% of shares (held in trust)',
    'ownership-of-shares-75-to-100-percent-as-trust': 'Owns 75-100% of shares (held in trust)',
    'ownership-of-shares-25-to-50-percent-as-firm': 'Owns 25-50% of shares (as firm)',
    'ownership-of-shares-50-to-75-percent-as-firm': 'Owns 50-75% of shares (as firm)',
    'ownership-of-shares-75-to-100-percent-as-firm': 'Owns 75-100% of shares (as firm)',
    'voting-rights-25-to-50-percent': 'Holds 25-50% of voting rights',
    'voting-rights-50-to-75-percent': 'Holds 50-75% of voting rights',
    'voting-rights-75-to-100-percent': 'Holds 75-100% of voting rights',
    'voting-rights-25-to-50-percent-as-trust': 'Holds 25-50% of voting rights (held in trust)',
    'voting-rights-50-to-75-percent-as-trust': 'Holds 50-75% of voting rights (held in trust)',
    'voting-rights-75-to-100-percent-as-trust': 'Holds 75-100% of voting rights (held in trust)',
    'voting-rights-25-to-50-percent-as-firm': 'Holds 25-50% of voting rights (as firm)',
    'voting-rights-50-to-75-percent-as-firm': 'Holds 50-75% of voting rights (as firm)',
    'voting-rights-75-to-100-percent-as-firm': 'Holds 75-100% of voting rights (as firm)',
    'right-to-appoint-and-remove-directors': 'Right to appoint and remove directors',
    'right-to-appoint-and-remove-directors-as-trust':
      'Right to appoint and remove directors (held in trust)',
    'right-to-appoint-and-remove-directors-as-firm':
      'Right to appoint and remove directors (as firm)',
    'significant-influence-or-control': 'Has significant influence or control',
    'significant-influence-or-control-as-trust':
      'Has significant influence or control (held in trust)',
    'significant-influence-or-control-as-firm': 'Has significant influence or control (as firm)',
    'right-to-share-surplus-assets-25-to-50-percent-limited-liability-partnership':
      'Right to 25-50% surplus assets (LLP)',
    'right-to-share-surplus-assets-50-to-75-percent-limited-liability-partnership':
      'Right to 50-75% surplus assets (LLP)',
    'right-to-share-surplus-assets-75-to-100-percent-limited-liability-partnership':
      'Right to 75-100% surplus assets (LLP)',
  };
  return controlMap[nature] ?? nature.replace(/-/g, ' ');
}

/**
 * `accounts.overdue` is deprecated in favour of `accounts.next_accounts.overdue`.
 * The newer field is preferred and the old one is only a fallback for records
 * that still carry it.
 */
export function accountsOverdue(profile: CompanyProfile): boolean {
  return Boolean(profile.accounts?.next_accounts?.overdue ?? profile.accounts?.overdue);
}

export function formatCompanyProfile(profile: CompanyProfile): string {
  const lines: string[] = [
    `## ${profile.company_name}`,
    '',
    `**Company Number:** ${profile.company_number}`,
    `**Status:** ${formatCompanyStatus(profile.company_status)}`,
    `**Type:** ${formatCompanyType(profile.type)}`,
  ];

  // A company can be `active` and simultaneously subject to a strike-off
  // proposal, so the detail matters as much as the headline status.
  if (profile.company_status_detail) {
    lines.push(`**Status detail:** ${formatCompanyStatusDetail(profile.company_status_detail)}`);
  }

  if (profile.date_of_creation) {
    lines.push(`**Incorporated:** ${formatDate(profile.date_of_creation)}`);
  }
  if (profile.date_of_cessation) {
    lines.push(`**Ceased:** ${formatDate(profile.date_of_cessation)}`);
  }
  if (profile.jurisdiction) {
    lines.push(`**Jurisdiction:** ${profile.jurisdiction}`);
  }

  lines.push(`**Registered Address:** ${formatAddress(profile.registered_office_address)}`);

  if (profile.sic_codes?.length) {
    lines.push(`**SIC Codes:** ${profile.sic_codes.join(', ')}`);
  }

  if (profile.accounts) {
    const overdue = accountsOverdue(profile);
    const hasAccountsData =
      profile.accounts.last_accounts?.made_up_to ||
      profile.accounts.next_accounts?.due_on ||
      overdue;
    if (hasAccountsData) {
      lines.push('', '### Accounts');
      if (profile.accounts.last_accounts?.made_up_to) {
        lines.push(
          `- Last accounts made up to: ${formatDate(profile.accounts.last_accounts.made_up_to)}`
        );
      }
      if (profile.accounts.next_accounts?.due_on) {
        lines.push(`- Next accounts due: ${formatDate(profile.accounts.next_accounts.due_on)}`);
      }
      if (overdue) {
        lines.push('- **Accounts are overdue**');
      }
    }
  }

  if (profile.confirmation_statement) {
    lines.push('', '### Confirmation Statement');
    if (profile.confirmation_statement.last_made_up_to) {
      lines.push(
        `- Last made up to: ${formatDate(profile.confirmation_statement.last_made_up_to)}`
      );
    }
    if (profile.confirmation_statement.next_due) {
      lines.push(`- Next due: ${formatDate(profile.confirmation_statement.next_due)}`);
    }
    if (profile.confirmation_statement.overdue) {
      lines.push('- **CONFIRMATION STATEMENT OVERDUE**');
    }
  }

  if (profile.previous_company_names?.length) {
    lines.push('', '### Previous Names');
    for (const prev of profile.previous_company_names) {
      lines.push(
        `- ${prev.name} (${formatDate(prev.effective_from)} to ${formatDate(prev.ceased_on)})`
      );
    }
  }

  // `has_charges` / `has_insolvency_history` are deprecated and mean "has or
  // had", so they are described as history rather than a current state. The
  // presence of the matching link is the supported signal.
  const notes: string[] = [];
  if (profile.links?.insolvency ?? profile.has_insolvency_history) {
    notes.push('Insolvency records exist (see get_insolvency)');
  }
  if (profile.links?.charges ?? profile.has_charges) {
    notes.push('Charges recorded, current or satisfied (see get_charges)');
  }
  if (profile.is_community_interest_company) notes.push('Community Interest Company');
  if (profile.registered_office_is_in_dispute) notes.push('Registered office address in dispute');
  if (profile.undeliverable_registered_office_address) {
    notes.push('Registered office address recorded as undeliverable');
  }

  if (notes.length) {
    lines.push('', '### Also on the record', '', ...notes.map(note => `- ${note}`));
  }

  return lines.join('\n');
}

export function formatCompanySearchResults(items: CompanySearchItem[], total: number): string {
  if (!items.length) return 'No companies found.';
  const showing = items.length < total ? `Showing ${items.length} of ${total}` : `Found ${total}`;
  const lines = [`${showing} companies:\n`];
  for (const item of items) {
    lines.push(`### ${item.title}`);
    lines.push(`- **Number:** ${item.company_number}`);
    lines.push(`- **Status:** ${formatCompanyStatus(item.company_status)}`);
    lines.push(`- **Type:** ${formatCompanyType(item.company_type)}`);
    if (item.date_of_creation)
      lines.push(`- **Incorporated:** ${formatDate(item.date_of_creation)}`);
    if (item.address_snippet) lines.push(`- **Address:** ${item.address_snippet}`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface OfficerCounts {
  total?: number;
  active?: number;
  resigned?: number;
}

/**
 * Officer counts come from the API's own `active_count` / `resigned_count`,
 * not from the length of whichever page was fetched — a page can contain none
 * of a company's active officers.
 */
export function formatOfficerCounts(counts: OfficerCounts): string {
  const parts: string[] = [];
  if (counts.total !== undefined) parts.push(`${counts.total} on the register`);
  if (counts.active !== undefined) parts.push(`${counts.active} active`);
  if (counts.resigned !== undefined) parts.push(`${counts.resigned} resigned`);
  return parts.join(', ');
}

export function formatOfficers(items: CompanyOfficer[], total: number): string {
  if (!items.length) return 'No officers found.';
  const lines = [`${total} officer(s):\n`];
  for (const officer of items) {
    const status = officer.resigned_on ? '(Resigned)' : '(Active)';
    lines.push(`### ${officer.name} ${status}`);
    lines.push(`- **Role:** ${formatOfficerRole(officer.officer_role)}`);
    if (officer.appointed_on) lines.push(`- **Appointed:** ${formatDate(officer.appointed_on)}`);
    if (officer.resigned_on) lines.push(`- **Resigned:** ${formatDate(officer.resigned_on)}`);
    if (officer.nationality) lines.push(`- **Nationality:** ${officer.nationality}`);
    if (officer.occupation) lines.push(`- **Occupation:** ${officer.occupation}`);
    if (officer.address) lines.push(`- **Address:** ${formatAddress(officer.address)}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Text for a page that came back empty.
 *
 * An empty page is only evidence that the register holds nothing when the
 * caller asked from the start of the list. Past that, it means the offset is
 * beyond the end — and saying "none found" there is a flat false negative
 * about a company that may have hundreds of records.
 */
export function emptyPageText(label: string, start_index: number, total?: number): string {
  if (start_index === 0) return `No ${label} found.`;
  if (total !== undefined && total > 0) {
    return `No ${label} at offset ${start_index}. This company has ${total} on the register; start again from start_index: 0.`;
  }
  return `No ${label} at offset ${start_index}. This is past the end of the list; try a lower start_index.`;
}

/** The document id a filing points at, if a document exists for it. */
export function filingDocumentId(filing: FilingHistoryItem): string | undefined {
  const url = filing.links?.document_metadata;
  if (!url) return undefined;
  return url.split('/').filter(Boolean).pop();
}

export function formatFilings(items: FilingHistoryItem[], total: number): string {
  if (!items.length) return 'No filing history found.';
  const lines = [`${total} filing(s):\n`];
  for (const filing of items) {
    lines.push(`### ${filing.description}`);
    lines.push(`- **Date:** ${formatDate(filing.date)}`);
    lines.push(`- **Category:** ${filing.category}`);
    lines.push(`- **Type:** ${filing.type}`);
    if (filing.transaction_id) lines.push(`- **Transaction ID:** ${filing.transaction_id}`);
    const documentId = filingDocumentId(filing);
    // Surfaced so download_filing_document can be called without a second
    // round trip to find the id.
    if (documentId) lines.push(`- **Document ID:** ${documentId}`);
    if (filing.pages) lines.push(`- **Pages:** ${filing.pages}`);
    if (filing.paper_filed) lines.push('- *Paper filed*');
    lines.push('');
  }
  return lines.join('\n');
}

export interface ChargeCounts {
  total: number;
  satisfied?: number;
  part_satisfied?: number;
  outstanding?: number;
}

/**
 * Outstanding charge counts come from the API's aggregate counts rather than
 * from filtering a single page, so they stay correct for companies with more
 * charges than fit in one request.
 */
export function chargeCounts(list: {
  total_count?: number;
  satisfied_count?: number;
  part_satisfied_count?: number;
}): ChargeCounts {
  const total = list.total_count ?? 0;
  const satisfied = list.satisfied_count;
  const partSatisfied = list.part_satisfied_count;
  const outstanding =
    satisfied === undefined && partSatisfied === undefined
      ? undefined
      : Math.max(0, total - (satisfied ?? 0) - (partSatisfied ?? 0));
  return {
    total,
    ...(satisfied !== undefined ? { satisfied } : {}),
    ...(partSatisfied !== undefined ? { part_satisfied: partSatisfied } : {}),
    ...(outstanding !== undefined ? { outstanding } : {}),
  };
}

export function formatChargeCounts(counts: ChargeCounts): string {
  const parts = [`${counts.total} charge(s) on the register`];
  if (counts.outstanding !== undefined) parts.push(`${counts.outstanding} outstanding`);
  if (counts.part_satisfied) parts.push(`${counts.part_satisfied} part-satisfied`);
  if (counts.satisfied !== undefined) parts.push(`${counts.satisfied} satisfied`);
  return parts.join(', ');
}

export function formatCharges(items: Charge[], total: number): string {
  if (!items.length) return 'No charges found.';
  const lines = [`${total} charge(s):\n`];
  for (const charge of items) {
    const label = charge.classification?.description ?? `Charge ${charge.charge_number ?? ''}`;
    lines.push(`### ${label}`);
    lines.push(`- **Status:** ${charge.status}`);
    if (charge.created_on) lines.push(`- **Created:** ${formatDate(charge.created_on)}`);
    if (charge.delivered_on) lines.push(`- **Delivered:** ${formatDate(charge.delivered_on)}`);
    if (charge.satisfied_on) lines.push(`- **Satisfied:** ${formatDate(charge.satisfied_on)}`);
    if (charge.persons_entitled?.length) {
      lines.push(`- **Entitled:** ${charge.persons_entitled.map(p => p.name).join(', ')}`);
    }
    if (charge.particulars?.description) {
      lines.push(`- **Particulars:** ${charge.particulars.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Ceased PSCs stay in the default list response. Presenting them without the
 * distinction would show former controllers as current ones, so the header
 * always states the split.
 */
export function formatPSCs(
  items: PSCItem[],
  total: number,
  counts?: { active?: number; ceased?: number }
): string {
  if (!items.length) return 'No persons with significant control found.';
  const split =
    counts && (counts.active !== undefined || counts.ceased !== undefined)
      ? ` (${counts.active ?? 0} active, ${counts.ceased ?? 0} ceased)`
      : '';
  const lines = [`${total} PSC(s)${split}:\n`];
  for (const psc of items) {
    const status = psc.ceased_on ? '(Ceased)' : '(Active)';
    lines.push(`### ${psc.name} ${status}`);
    lines.push(`- **Kind:** ${psc.kind}`);
    if (psc.notified_on) lines.push(`- **Notified:** ${formatDate(psc.notified_on)}`);
    if (psc.ceased_on) lines.push(`- **Ceased:** ${formatDate(psc.ceased_on)}`);
    if (psc.natures_of_control?.length) {
      lines.push('- **Control:**');
      for (const nature of psc.natures_of_control) {
        lines.push(`  - ${formatNatureOfControl(nature)}`);
      }
    }
    if ('nationality' in psc && psc.nationality) {
      lines.push(`- **Nationality:** ${psc.nationality}`);
    }
    if ('identification' in psc && psc.identification) {
      const id = psc.identification;
      if (id.legal_form) lines.push(`- **Legal Form:** ${id.legal_form}`);
      if (id.legal_authority) lines.push(`- **Legal Authority:** ${id.legal_authority}`);
      if (id.registration_number) lines.push(`- **Registration:** ${id.registration_number}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatInsolvency(cases: InsolvencyCase[]): string {
  if (!cases.length) return 'No insolvency cases found.';
  const lines = [`${cases.length} insolvency case(s):\n`];
  for (const c of cases) {
    lines.push(`### Case ${c.number ?? ''}`);
    if (c.type) lines.push(`- **Type:** ${c.type}`);
    if (c.dates?.length) {
      for (const d of c.dates) {
        lines.push(`- **${d.type}:** ${formatDate(d.date)}`);
      }
    }
    if (c.practitioners?.length) {
      lines.push('- **Practitioners:**');
      for (const p of c.practitioners) {
        lines.push(`  - ${p.name}${p.role ? ` (${p.role})` : ''}`);
        if (p.appointed_on) lines.push(`    Appointed: ${formatDate(p.appointed_on)}`);
        if (p.ceased_to_act_on) lines.push(`    Ceased: ${formatDate(p.ceased_to_act_on)}`);
      }
    }
    if (c.notes?.length) {
      lines.push(`- **Notes:** ${c.notes.join('; ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatOfficerSearchResults(items: OfficerSearchItem[], total: number): string {
  if (!items.length) return 'No officers found.';
  const lines = [`Found ${total} officer(s):\n`];
  for (const item of items) {
    lines.push(`### ${item.title}`);
    if (item.date_of_birth) {
      const dob = item.date_of_birth;
      const dobStr = dob.day ? `${dob.day}/${dob.month}/${dob.year}` : `${dob.month}/${dob.year}`;
      lines.push(`- **DOB:** ${dobStr}`);
    }
    if (item.appointment_count !== undefined) {
      lines.push(`- **Appointments:** ${item.appointment_count}`);
    }
    if (item.address_snippet) lines.push(`- **Address:** ${item.address_snippet}`);
    // Extract officer ID from links
    if (item.links?.self) {
      const match = item.links.self.match(/\/officers\/([^/]+)/);
      if (match?.[1]) lines.push(`- **Officer ID:** ${match[1]}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatAppointments(
  items: OfficerAppointment[],
  total: number,
  name?: string
): string {
  if (!items.length) return 'No appointments found.';
  const header = name ? `${total} appointment(s) for ${name}:` : `${total} appointment(s):`;
  const lines = [header, ''];
  for (const appt of items) {
    // The status qualifies the appointment, not the company — a current
    // appointment at a dissolved company is common and must not read as
    // "(Active)" next to the company's name.
    const status = appt.resigned_on ? '(appointment ended)' : '(appointment current)';
    lines.push(`### ${appt.appointed_to.company_name} ${status}`);
    lines.push(`- **Company Number:** ${appt.appointed_to.company_number}`);
    if (appt.appointed_to.company_status) {
      lines.push(`- **Company Status:** ${formatCompanyStatus(appt.appointed_to.company_status)}`);
    }
    lines.push(`- **Role:** ${formatOfficerRole(appt.officer_role)}`);
    if (appt.appointed_on) lines.push(`- **Appointed:** ${formatDate(appt.appointed_on)}`);
    if (appt.resigned_on) lines.push(`- **Resigned:** ${formatDate(appt.resigned_on)}`);
    lines.push('');
  }
  return lines.join('\n');
}
