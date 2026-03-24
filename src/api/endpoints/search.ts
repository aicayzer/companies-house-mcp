import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type {
  CompanySearchResponse,
  CompanySearchParams,
  AdvancedSearchParams,
  OfficerSearchResponse,
  OfficerSearchParams,
} from '../../types/index.js';

export function searchCompanies(
  client: APIClient,
  params: CompanySearchParams
): Promise<CompanySearchResponse> {
  return client.get<CompanySearchResponse>(
    '/search/companies',
    {
      q: params.q,
      items_per_page: params.items_per_page,
      start_index: params.start_index,
    },
    CACHE_TTLS.search
  );
}

export function advancedSearchCompanies(
  client: APIClient,
  params: AdvancedSearchParams
): Promise<CompanySearchResponse> {
  return client.get<CompanySearchResponse>(
    '/advanced-search/companies',
    params as Record<string, string | number | undefined>,
    CACHE_TTLS.search
  );
}

export function searchOfficers(
  client: APIClient,
  params: OfficerSearchParams
): Promise<OfficerSearchResponse> {
  return client.get<OfficerSearchResponse>(
    '/search/officers',
    {
      q: params.q,
      items_per_page: params.items_per_page,
      start_index: params.start_index,
    },
    CACHE_TTLS.search
  );
}
