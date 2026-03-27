/** Companies House API types — snake_case matching the API responses exactly. */

export interface Address {
  premises?: string;
  address_line_1?: string;
  address_line_2?: string;
  care_of?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  po_box?: string;
}

export interface PreviousCompanyName {
  name: string;
  effective_from: string;
  ceased_on: string;
}

export interface AccountsDates {
  accounting_reference_date?: { month: string; day: string };
  last_accounts?: { made_up_to?: string; type?: string; period_start_on?: string; period_end_on?: string };
  next_accounts?: { due_on?: string; period_start_on?: string; period_end_on?: string; overdue?: boolean };
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
}

export interface ConfirmationStatement {
  last_made_up_to?: string;
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
}

export interface AnnualReturn {
  last_made_up_to?: string;
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
}

export interface CompanyProfile {
  company_number: string;
  company_name: string;
  company_status: string;
  company_status_detail?: string;
  type: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  jurisdiction?: string;
  registered_office_address?: Address;
  registered_office_is_in_dispute?: boolean;
  undeliverable_registered_office_address?: boolean;
  sic_codes?: string[];
  accounts?: AccountsDates;
  confirmation_statement?: ConfirmationStatement;
  annual_return?: AnnualReturn;
  previous_company_names?: PreviousCompanyName[];
  has_insolvency_history?: boolean;
  has_charges?: boolean;
  has_been_liquidated?: boolean;
  is_community_interest_company?: boolean;
  can_file?: boolean;
  etag?: string;
  last_full_members_list_date?: string;
  external_registration_number?: string;
  links?: Record<string, string>;
}

export interface CompanySearchItem {
  company_number: string;
  title: string;
  company_status: string;
  company_type: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  address_snippet?: string;
  address?: Address;
  description?: string;
  description_identifier?: string[];
  snippet?: string;
  matches?: Record<string, number[]>;
  kind?: string;
  links?: Record<string, string>;
}

export interface CompanySearchResponse {
  items: CompanySearchItem[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
  page_number?: number;
}

export interface OfficerDateOfBirth {
  month: number;
  year: number;
  day?: number;
}

export interface CompanyOfficer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  address?: Address;
  date_of_birth?: OfficerDateOfBirth;
  identification?: {
    identification_type?: string;
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    registration_number?: string;
  };
  links?: {
    officer?: { appointments?: string };
    self?: string;
  };
}

export interface OfficersList {
  items: CompanyOfficer[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
  active_count?: number;
  resigned_count?: number;
  links?: { self?: string };
  etag?: string;
}

export interface OfficerAppointment {
  appointed_on?: string;
  resigned_on?: string;
  officer_role: string;
  name?: string;
  appointed_to: {
    company_number: string;
    company_name: string;
    company_status?: string;
  };
  name_elements?: {
    title?: string;
    forename?: string;
    other_forenames?: string;
    surname?: string;
  };
  address?: Address;
  links?: Record<string, string>;
}

export interface OfficerAppointmentsList {
  items: OfficerAppointment[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
  date_of_birth?: OfficerDateOfBirth;
  is_corporate_officer?: boolean;
  links?: { self?: string };
  name?: string;
  etag?: string;
}

export interface OfficerSearchItem {
  title: string;
  address_snippet?: string;
  address?: Address;
  appointment_count?: number;
  date_of_birth?: OfficerDateOfBirth;
  description?: string;
  description_identifiers?: string[];
  kind?: string;
  links?: { self?: string };
  matches?: Record<string, number[]>;
  snippet?: string;
}

export interface OfficerSearchResponse {
  items: OfficerSearchItem[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
}

export interface FilingHistoryItem {
  transaction_id: string;
  date: string;
  type: string;
  description: string;
  description_values?: Record<string, string>;
  category: string;
  subcategory?: string;
  action_date?: string;
  barcode?: string;
  paper_filed?: boolean;
  links?: {
    self?: string;
    document_metadata?: string;
  };
  pages?: number;
  associated_filings?: Array<{
    date: string;
    description: string;
    type: string;
    category?: string;
  }>;
}

export interface FilingHistoryList {
  items: FilingHistoryItem[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_count: number;
  filing_history_status?: string;
}

export interface Charge {
  charge_number?: number;
  charge_code?: string;
  classification?: { type: string; description: string };
  status: string;
  created_on?: string;
  delivered_on?: string;
  satisfied_on?: string;
  particulars?: { type?: string; description?: string; contains_negative_pledge?: boolean; contains_fixed_charge?: boolean; contains_floating_charge?: boolean; floating_charge_covers_all?: boolean };
  persons_entitled?: Array<{ name: string }>;
  transactions?: Array<{ filing_type?: string; delivered_on?: string; links?: Record<string, string> }>;
  links?: Record<string, string>;
  etag?: string;
}

export interface ChargesList {
  items: Charge[];
  part_satisfied_count?: number;
  satisfied_count?: number;
  total_count: number;
  unfiltered_count?: number;
  etag?: string;
}

export interface PSCIndividual {
  name: string;
  name_elements?: {
    title?: string;
    forename?: string;
    other_forenames?: string;
    surname?: string;
  };
  nationality?: string;
  country_of_residence?: string;
  date_of_birth?: OfficerDateOfBirth;
  address?: Address;
  natures_of_control: string[];
  notified_on?: string;
  ceased_on?: string;
  kind: string;
  links?: Record<string, string>;
  etag?: string;
}

export interface PSCCorporate {
  name: string;
  identification?: {
    country_registered?: string;
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    registration_number?: string;
  };
  address?: Address;
  natures_of_control: string[];
  notified_on?: string;
  ceased_on?: string;
  kind: string;
  links?: Record<string, string>;
  etag?: string;
}

export type PSCItem = PSCIndividual | PSCCorporate;

export interface PSCList {
  items: PSCItem[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
  active_count?: number;
  ceased_count?: number;
  links?: { self?: string; persons_with_significant_control_statements_list?: string };
}

export interface InsolvencyCase {
  number?: number;
  type?: string;
  dates?: Array<{ type: string; date: string }>;
  notes?: string[];
  practitioners?: Array<{
    name: string;
    address?: Address;
    appointed_on?: string;
    ceased_to_act_on?: string;
    role?: string;
  }>;
  links?: Record<string, string>;
}

export interface InsolvencyData {
  cases?: InsolvencyCase[];
  status?: string[];
  etag?: string;
}

export interface CompanyRegisters {
  company_number?: string;
  kind?: string;
  registers?: Record<string, {
    register_type: string;
    items: Array<{
      register_moved_to: string;
      moved_on: string;
      links?: Record<string, string>;
    }>;
    links?: Record<string, string>;
  }>;
  links?: Record<string, string>;
  etag?: string;
}

export interface ExemptionsData {
  exemptions?: Record<string, {
    exemption_type: string;
    items: Array<{
      exempt_from: string;
      exempt_to?: string;
    }>;
  }>;
  kind?: string;
  links?: Record<string, string>;
  etag?: string;
}

export interface UKEstablishment {
  company_name: string;
  company_number: string;
  company_status: string;
  locality?: string;
  links?: Record<string, string>;
}

export interface UKEstablishmentsList {
  items: UKEstablishment[];
  kind?: string;
  links?: Record<string, string>;
  etag?: string;
}

export interface DisqualifiedOfficer {
  date_of_birth?: string;
  disqualifications?: Array<{
    disqualified_from: string;
    disqualified_until: string;
    reason?: { act: string; section: string; description_identifier?: string };
    case_identifier?: string;
    court_name?: string;
    heard_on?: string;
    undertaken_on?: string;
    address?: Address;
    company_names?: string[];
    links?: Record<string, string>;
  }>;
  etag?: string;
  forename?: string;
  honours?: string;
  kind?: string;
  links?: Record<string, string>;
  nationality?: string;
  other_forenames?: string;
  surname?: string;
  title?: string;
}

export interface DocumentMetadata {
  barcode?: string;
  significant_date?: string;
  significant_date_type?: string;
  created_at?: string;
  etag?: string;
  links?: { self?: string; document?: string };
  pages?: number;
  resources?: Record<string, { content_length: number; content_type: string; created_at: string; updated_at: string }>;
  total_count?: number;
  updated_at?: string;
}

/** API client configuration */
export interface ClientConfig {
  api_key: string;
  base_url?: string;
  rate_limit_max?: number;
  rate_limit_window_ms?: number;
  cache_enabled?: boolean;
}

/** Pagination parameters */
export interface PaginationParams {
  items_per_page?: number;
  start_index?: number;
}

/** Filing history query parameters */
export interface FilingHistoryParams extends PaginationParams {
  category?: string;
}

/** Company search query parameters */
export interface CompanySearchParams extends PaginationParams {
  q: string;
}

/** Advanced search parameters */
export interface AdvancedSearchParams extends PaginationParams {
  company_name_includes?: string;
  company_name_excludes?: string;
  company_status?: string;
  company_type?: string;
  company_subtype?: string;
  dissolved_from?: string;
  dissolved_to?: string;
  incorporated_from?: string;
  incorporated_to?: string;
  location?: string;
  sic_codes?: string;
}

/** Officer search parameters */
export interface OfficerSearchParams extends PaginationParams {
  q: string;
}
