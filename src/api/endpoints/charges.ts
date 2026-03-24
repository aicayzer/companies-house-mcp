import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { ChargesList, PaginationParams } from '../../types/index.js';

export function getCompanyCharges(
  client: APIClient,
  companyNumber: string,
  params?: PaginationParams
): Promise<ChargesList> {
  return client.get<ChargesList>(
    `/company/${encodeURIComponent(companyNumber)}/charges`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
    },
    CACHE_TTLS.charges
  );
}
