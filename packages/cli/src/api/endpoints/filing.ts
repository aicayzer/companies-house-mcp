import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type { FilingHistoryList, FilingHistoryParams, DocumentMetadata } from '../../types/index.js';

export function getFilingHistory(
  client: APIClient,
  companyNumber: string,
  params?: FilingHistoryParams
): Promise<FilingHistoryList> {
  return client.get<FilingHistoryList>(
    `/company/${encodeURIComponent(companyNumber)}/filing-history`,
    {
      items_per_page: params?.items_per_page,
      start_index: params?.start_index,
      category: params?.category,
    },
    CACHE_TTLS.filings
  );
}

export function getFilingItem(
  client: APIClient,
  companyNumber: string,
  transactionId: string
): Promise<FilingHistoryList> {
  return client.get<FilingHistoryList>(
    `/company/${encodeURIComponent(companyNumber)}/filing-history/${encodeURIComponent(transactionId)}`,
    undefined,
    CACHE_TTLS.filings
  );
}

export function getDocumentMetadata(
  client: APIClient,
  documentId: string
): Promise<DocumentMetadata> {
  return client.get<DocumentMetadata>(
    `/document/${encodeURIComponent(documentId)}`,
    undefined,
    CACHE_TTLS.filings
  );
}
