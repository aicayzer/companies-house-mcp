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
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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
    'private-limited-guarant-nsc-limited-exemption': 'Private Limited by Guarantee (No Share Capital, Exempt)',
    'private-limited-guarant-nsc': 'Private Limited by Guarantee (No Share Capital)',
    'private-limited-shares-section-30-exemption': 'Private Limited by Shares (Section 30 Exempt)',
    'private-unlimited-nsc': 'Private Unlimited (No Share Capital)',
    llp: 'Limited Liability Partnership',
    'scottish-partnership': 'Scottish Partnership',
    'charitable-incorporated-organisation': 'Charitable Incorporated Organisation',
    'scottish-charitable-incorporated-organisation': 'Scottish Charitable Incorporated Organisation',
    'industrial-and-provident-society': 'Industrial and Provident Society',
    'registered-society-non-jurisdictional': 'Registered Society',
    'royal-charter': 'Royal Charter Company',
    'investment-company-with-variable-capital': 'Investment Company with Variable Capital',
    'unregistered-company': 'Unregistered Company',
    'registered-overseas-entity': 'Registered Overseas Entity',
    'european-public-limited-liability-company-se': 'European Public Limited Liability Company (SE)',
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
    'right-to-appoint-and-remove-directors-as-trust': 'Right to appoint and remove directors (held in trust)',
    'right-to-appoint-and-remove-directors-as-firm': 'Right to appoint and remove directors (as firm)',
    'significant-influence-or-control': 'Has significant influence or control',
    'significant-influence-or-control-as-trust': 'Has significant influence or control (held in trust)',
    'significant-influence-or-control-as-firm': 'Has significant influence or control (as firm)',
    'right-to-share-surplus-assets-25-to-50-percent-limited-liability-partnership': 'Right to 25-50% surplus assets (LLP)',
    'right-to-share-surplus-assets-50-to-75-percent-limited-liability-partnership': 'Right to 50-75% surplus assets (LLP)',
    'right-to-share-surplus-assets-75-to-100-percent-limited-liability-partnership': 'Right to 75-100% surplus assets (LLP)',
  };
  return controlMap[nature] ?? nature.replace(/-/g, ' ');
}

export function formatCompanyProfile(profile: CompanyProfile): string {
  const lines: string[] = [
    `## ${profile.company_name}`,
    '',
    `**Company Number:** ${profile.company_number}`,
    `**Status:** ${formatCompanyStatus(profile.company_status)}`,
    `**Type:** ${formatCompanyType(profile.type)}`,
  ];

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
    const hasAccountsData = profile.accounts.last_accounts?.made_up_to ||
      profile.accounts.next_accounts?.due_on ||
      profile.accounts.overdue || profile.accounts.next_accounts?.overdue;
    if (hasAccountsData) {
      lines.push('', '### Accounts');
      if (profile.accounts.last_accounts?.made_up_to) {
        lines.push(`- Last accounts made up to: ${formatDate(profile.accounts.last_accounts.made_up_to)}`);
      }
      if (profile.accounts.next_accounts?.due_on) {
        lines.push(`- Next accounts due: ${formatDate(profile.accounts.next_accounts.due_on)}`);
      }
      if (profile.accounts.overdue || profile.accounts.next_accounts?.overdue) {
        lines.push('- **ACCOUNTS OVERDUE**');
      }
    }
  }

  if (profile.confirmation_statement) {
    lines.push('', '### Confirmation Statement');
    if (profile.confirmation_statement.last_made_up_to) {
      lines.push(`- Last made up to: ${formatDate(profile.confirmation_statement.last_made_up_to)}`);
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
      lines.push(`- ${prev.name} (${formatDate(prev.effective_from)} to ${formatDate(prev.ceased_on)})`);
    }
  }

  const flags: string[] = [];
  if (profile.has_insolvency_history) flags.push('Insolvency history');
  if (profile.has_charges) flags.push('Has charges');
  if (profile.has_been_liquidated) flags.push('Has been liquidated');
  if (profile.is_community_interest_company) flags.push('Community Interest Company');
  if (profile.registered_office_is_in_dispute) flags.push('Registered office in dispute');
  if (profile.undeliverable_registered_office_address) flags.push('Undeliverable registered office');

  if (flags.length) {
    lines.push('', `**Flags:** ${flags.join(' | ')}`);
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
    if (item.date_of_creation) lines.push(`- **Incorporated:** ${formatDate(item.date_of_creation)}`);
    if (item.address_snippet) lines.push(`- **Address:** ${item.address_snippet}`);
    lines.push('');
  }
  return lines.join('\n');
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

export function formatFilings(items: FilingHistoryItem[], total: number): string {
  if (!items.length) return 'No filing history found.';
  const lines = [`${total} filing(s):\n`];
  for (const filing of items) {
    lines.push(`### ${filing.description}`);
    lines.push(`- **Date:** ${formatDate(filing.date)}`);
    lines.push(`- **Category:** ${filing.category}`);
    lines.push(`- **Type:** ${filing.type}`);
    if (filing.transaction_id) lines.push(`- **Transaction ID:** ${filing.transaction_id}`);
    if (filing.paper_filed) lines.push('- *Paper filed*');
    lines.push('');
  }
  return lines.join('\n');
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

export function formatPSCs(items: PSCItem[], total: number): string {
  if (!items.length) return 'No persons with significant control found.';
  const lines = [`${total} PSC(s):\n`];
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

export function formatAppointments(items: OfficerAppointment[], total: number, name?: string): string {
  if (!items.length) return 'No appointments found.';
  const header = name ? `${total} appointment(s) for ${name}:` : `${total} appointment(s):`;
  const lines = [header, ''];
  for (const appt of items) {
    const status = appt.resigned_on ? '(Resigned)' : '(Active)';
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
