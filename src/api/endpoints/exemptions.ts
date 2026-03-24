import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { ExemptionsData, UKEstablishmentsList } from '../../types/index.js';

export function getExemptions(
  client: APIClient,
  companyNumber: string
): Promise<ExemptionsData> {
  return client.get<ExemptionsData>(
    `/company/${encodeURIComponent(companyNumber)}/exemptions`,
    undefined,
    CACHE_TTLS.registers
  );
}

export function getUKEstablishments(
  client: APIClient,
  companyNumber: string
): Promise<UKEstablishmentsList> {
  return client.get<UKEstablishmentsList>(
    `/company/${encodeURIComponent(companyNumber)}/uk-establishments`,
    undefined,
    CACHE_TTLS.registers
  );
}
