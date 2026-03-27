import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type {
  OfficersList,
  OfficerAppointmentsList,
  DisqualifiedOfficer,
  PaginationParams,
} from '../../types/index.js';

export function getCompanyOfficers(
  client: APIClient,
  companyNumber: string,
  params?: PaginationParams & { order_by?: string }
): Promise<OfficersList> {
  return client.get<OfficersList>(
    `/company/${encodeURIComponent(companyNumber)}/officers`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
      order_by: params?.order_by,
    },
    CACHE_TTLS.officers
  );
}

export function getOfficerAppointments(
  client: APIClient,
  officerId: string,
  params?: PaginationParams
): Promise<OfficerAppointmentsList> {
  return client.get<OfficerAppointmentsList>(
    `/officers/${encodeURIComponent(officerId)}/appointments`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
    },
    CACHE_TTLS.officers
  );
}

export function getNaturalDisqualification(
  client: APIClient,
  officerId: string
): Promise<DisqualifiedOfficer> {
  return client.get<DisqualifiedOfficer>(
    `/disqualified-officers/natural/${encodeURIComponent(officerId)}`,
    undefined,
    CACHE_TTLS.officers
  );
}

export function getCorporateDisqualification(
  client: APIClient,
  officerId: string
): Promise<DisqualifiedOfficer> {
  return client.get<DisqualifiedOfficer>(
    `/disqualified-officers/corporate/${encodeURIComponent(officerId)}`,
    undefined,
    CACHE_TTLS.officers
  );
}
