/**
 * Bounded page collection for Companies House list endpoints.
 *
 * Companies House paginates with `start_index` and `items_per_page` and does
 * not publish a maximum page size, so callers clamp their own request sizes
 * and cap how many pages a single tool call will fetch.
 *
 * The result reports *why* collection stopped rather than a single "complete"
 * flag. "The API had nothing more to give", "the caller had seen enough" and
 * "the page budget ran out" are three different things, and only the first
 * means every record was retrieved. Collapsing them is how a truncated list
 * ends up presented as a whole one.
 */

export interface PageResponse<T> {
  items?: T[];
  total?: number;
}

export type PageStopReason =
  /** A short page: the API had nothing more to give. */
  | 'exhausted'
  /** The reported total was reached. */
  | 'total-reached'
  /** The caller's predicate was satisfied. */
  | 'satisfied'
  /** The page budget ran out with more possibly available. */
  | 'page-budget';

export interface CollectedPages<T> {
  items: T[];
  /** The API's own total, when it reported one. */
  total?: number;
  pagesFetched: number;
  stoppedBecause: PageStopReason;
  /**
   * True only when the whole list from `startIndex` onwards was retrieved.
   * A satisfied predicate does not make this true, because "enough" is not
   * "everything", and neither does an unknown total.
   */
  complete: boolean;
}

export interface CollectPagesOptions<T> {
  pageSize: number;
  maxPages: number;
  /** Start collecting from this offset. Defaults to 0. */
  startIndex?: number;
  /** Stop early once the collected items already answer the question. */
  isSatisfied?: (items: T[]) => boolean;
}

export async function collectPages<T>(
  fetchPage: (startIndex: number, itemsPerPage: number) => Promise<PageResponse<T>>,
  { pageSize, maxPages, startIndex = 0, isSatisfied }: CollectPagesOptions<T>
): Promise<CollectedPages<T>> {
  const items: T[] = [];
  let total: number | undefined;
  let pagesFetched = 0;
  let offset = startIndex;
  let stoppedBecause: PageStopReason = 'page-budget';

  while (pagesFetched < maxPages) {
    const page = await fetchPage(offset, pageSize);
    pagesFetched++;

    const pageItems = page.items ?? [];
    items.push(...pageItems);
    if (page.total !== undefined) total = page.total;

    if (isSatisfied?.(items)) {
      stoppedBecause = 'satisfied';
      break;
    }

    if (pageItems.length === 0) {
      stoppedBecause = 'exhausted';
      break;
    }

    // Advance by what actually arrived, not by what was asked for: Companies
    // House does not publish its page-size caps, so a page smaller than the
    // request is as likely to be a server-side clamp as the end of the list.
    offset += pageItems.length;

    if (total !== undefined) {
      if (offset >= total) {
        stoppedBecause = 'total-reached';
        break;
      }
      // The total says more remain, so a short page was a clamp. Keep going.
      continue;
    }

    // With no total to consult, a short page is the only end-of-list signal
    // available.
    if (pageItems.length < pageSize) {
      stoppedBecause = 'exhausted';
      break;
    }
  }

  return {
    items,
    total,
    pagesFetched,
    stoppedBecause,
    // Only a genuinely exhausted list, or reaching the reported total, means
    // everything from `startIndex` was retrieved.
    complete: stoppedBecause === 'exhausted' || stoppedBecause === 'total-reached',
  };
}
