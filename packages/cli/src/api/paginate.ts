/**
 * Bounded page collection for Companies House list endpoints.
 *
 * Companies House paginates with `start_index` and `items_per_page` and does
 * not publish a maximum page size, so callers clamp their own request sizes
 * and cap how many pages a single tool call will fetch. Every result records
 * whether the whole list was retrieved, so tools can say so rather than
 * silently presenting a partial answer as a complete one.
 */

export interface PageResponse<T> {
  items?: T[];
  total?: number;
}

export interface CollectedPages<T> {
  items: T[];
  /** The API's own total, when it reported one. */
  total?: number;
  pagesFetched: number;
  /** True when every item the API reported a total for was retrieved. */
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

  while (pagesFetched < maxPages) {
    const page = await fetchPage(offset, pageSize);
    pagesFetched++;

    const pageItems = page.items ?? [];
    items.push(...pageItems);
    if (page.total !== undefined) total = page.total;

    if (isSatisfied?.(items)) break;
    // A short page means the list is exhausted regardless of the reported total.
    if (pageItems.length < pageSize) break;
    offset += pageSize;
    if (total !== undefined && offset >= total) break;
  }

  const retrievedEverything =
    total === undefined
      ? true
      : startIndex + items.length >= total || isSatisfied?.(items) === true;

  return { items, total, pagesFetched, complete: retrievedEverything };
}
