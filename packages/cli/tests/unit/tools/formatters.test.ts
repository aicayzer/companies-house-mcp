import { describe, it, expect } from 'vitest';
import {
  formatAddress,
  formatDate,
  formatCompanyStatus,
  formatCompanyType,
  formatOfficerRole,
  formatNatureOfControl,
  formatCompanyProfile,
  formatCompanySearchResults,
} from '../../../src/formatters/index.js';

describe('formatAddress', () => {
  it('formats full address', () => {
    const addr = {
      address_line_1: '10 Downing Street',
      locality: 'London',
      postal_code: 'SW1A 2AA',
      country: 'United Kingdom',
    };
    expect(formatAddress(addr)).toBe('10 Downing Street, London, SW1A 2AA, United Kingdom');
  });

  it('returns "Not available" for undefined', () => {
    expect(formatAddress(undefined)).toBe('Not available');
  });

  it('returns "Not available" for empty address', () => {
    expect(formatAddress({})).toBe('Not available');
  });

  it('includes care_of and premises', () => {
    const addr = { care_of: 'John Smith', premises: 'Suite 1', address_line_1: 'High Street' };
    expect(formatAddress(addr)).toBe('John Smith, Suite 1, High Street');
  });
});

describe('formatDate', () => {
  it('formats ISO date to en-GB', () => {
    const result = formatDate('2022-01-10');
    expect(result).toContain('January');
    expect(result).toContain('2022');
  });

  it('returns N/A for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatCompanyStatus', () => {
  it('maps known statuses', () => {
    expect(formatCompanyStatus('active')).toBe('Active');
    expect(formatCompanyStatus('dissolved')).toBe('Dissolved');
    expect(formatCompanyStatus('liquidation')).toBe('In Liquidation');
  });

  it('returns original for unknown status', () => {
    expect(formatCompanyStatus('unknown-status')).toBe('unknown-status');
  });
});

describe('formatCompanyType', () => {
  it('maps known types', () => {
    expect(formatCompanyType('ltd')).toBe('Private Limited Company');
    expect(formatCompanyType('plc')).toBe('Public Limited Company');
    expect(formatCompanyType('llp')).toBe('Limited Liability Partnership');
  });
});

describe('formatOfficerRole', () => {
  it('maps known roles', () => {
    expect(formatOfficerRole('director')).toBe('Director');
    expect(formatOfficerRole('secretary')).toBe('Secretary');
    expect(formatOfficerRole('llp-member')).toBe('LLP Member');
  });
});

describe('formatNatureOfControl', () => {
  it('translates control codes to plain English', () => {
    expect(formatNatureOfControl('ownership-of-shares-25-to-50-percent')).toBe('Owns 25-50% of shares');
    expect(formatNatureOfControl('voting-rights-75-to-100-percent')).toBe('Holds 75-100% of voting rights');
    expect(formatNatureOfControl('right-to-appoint-and-remove-directors')).toBe('Right to appoint and remove directors');
    expect(formatNatureOfControl('significant-influence-or-control')).toBe('Has significant influence or control');
  });

  it('falls back to hyphen-replaced string for unknown codes', () => {
    expect(formatNatureOfControl('some-unknown-code')).toBe('some unknown code');
  });
});

describe('formatCompanyProfile', () => {
  it('formats a complete profile', () => {
    const profile = {
      company_name: 'TEST LTD',
      company_number: '12345678',
      company_status: 'active',
      type: 'ltd',
      date_of_creation: '2020-01-01',
      registered_office_address: {
        address_line_1: '1 Test Street',
        locality: 'London',
        postal_code: 'EC1A 1BB',
      },
      sic_codes: ['62011'],
    };

    const result = formatCompanyProfile(profile);
    expect(result).toContain('## TEST LTD');
    expect(result).toContain('12345678');
    expect(result).toContain('Active');
    expect(result).toContain('Private Limited Company');
    expect(result).toContain('62011');
    expect(result).toContain('1 Test Street');
  });

  it('shows overdue flags', () => {
    const profile = {
      company_name: 'OVERDUE LTD',
      company_number: '99999999',
      company_status: 'active',
      type: 'ltd',
      accounts: { overdue: true },
      confirmation_statement: { overdue: true },
    };

    const result = formatCompanyProfile(profile);
    expect(result).toContain('ACCOUNTS OVERDUE');
    expect(result).toContain('CONFIRMATION STATEMENT OVERDUE');
  });
});

describe('formatCompanySearchResults', () => {
  it('formats search results', () => {
    const items = [
      {
        title: 'TEST PLC',
        company_number: '00000001',
        company_status: 'active',
        company_type: 'plc',
        date_of_creation: '2000-01-01',
        address_snippet: 'London',
      },
    ];
    const result = formatCompanySearchResults(items, 1);
    expect(result).toContain('TEST PLC');
    expect(result).toContain('00000001');
  });

  it('handles empty results', () => {
    expect(formatCompanySearchResults([], 0)).toBe('No companies found.');
  });
});
