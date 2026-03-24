import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { InsolvencyData } from '../../types/index.js';

export function getCompanyInsolvency(
  client: APIClient,
  companyNumber: string
): Promise<InsolvencyData> {
  return client.get<InsolvencyData>(
    `/company/${encodeURIComponent(companyNumber)}/insolvency`,
    undefined,
    CACHE_TTLS.insolvency
  );
}
