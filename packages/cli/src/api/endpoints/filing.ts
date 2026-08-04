import type { APIClient } from '../client.js';
import { CACHE_TTLS } from '../client.js';
import type {
  FilingHistoryList,
  FilingHistoryParams,
  FilingHistoryItem,
} from '../../types/index.js';

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

/** A single filing history item. Returns the item itself, not a list. */
export function getFilingItem(
  client: APIClient,
  companyNumber: string,
  transactionId: string
): Promise<FilingHistoryItem> {
  return client.get<FilingHistoryItem>(
    `/company/${encodeURIComponent(companyNumber)}/filing-history/${encodeURIComponent(transactionId)}`,
    undefined,
    CACHE_TTLS.filings
  );
}
