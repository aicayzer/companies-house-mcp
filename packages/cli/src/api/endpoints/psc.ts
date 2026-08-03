import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { PSCList, PSCStatementList, PaginationParams } from '../../types/index.js';

export function getPersonsWithSignificantControl(
  client: APIClient,
  companyNumber: string,
  params?: PaginationParams
): Promise<PSCList> {
  return client.get<PSCList>(
    `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
    },
    CACHE_TTLS.psc
  );
}

/**
 * PSC statements explain why a company has no PSC entries — for example that
 * no individual meets the conditions, or that the company is still making
 * enquiries. The endpoint 404s for companies that have never filed one.
 */
export function getPSCStatements(
  client: APIClient,
  companyNumber: string,
  params?: PaginationParams
): Promise<PSCStatementList> {
  return client.get<PSCStatementList>(
    `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control-statements`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
    },
    CACHE_TTLS.psc
  );
}
