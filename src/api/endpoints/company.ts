import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { CompanyProfile, CompanyRegisters, Address } from '../../types/index.js';

export function getCompanyProfile(client: APIClient, companyNumber: string): Promise<CompanyProfile> {
  return client.get<CompanyProfile>(
    `/company/${encodeURIComponent(companyNumber)}`,
    undefined,
    CACHE_TTLS.profile
  );
}

export function getRegisteredOfficeAddress(client: APIClient, companyNumber: string): Promise<Address> {
  return client.get<Address>(
    `/company/${encodeURIComponent(companyNumber)}/registered-office-address`,
    undefined,
    CACHE_TTLS.profile
  );
}

export function getCompanyRegisters(client: APIClient, companyNumber: string): Promise<CompanyRegisters> {
  return client.get<CompanyRegisters>(
    `/company/${encodeURIComponent(companyNumber)}/registers`,
    undefined,
    CACHE_TTLS.registers
  );
}
