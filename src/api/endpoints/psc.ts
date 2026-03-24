import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { PSCList, PaginationParams } from '../../types/index.js';

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
