import { describe, it, expect, vi } from 'vitest';
import { collectPages } from '../../../src/api/paginate.js';

function pagedSource(total: number) {
  const all = Array.from({ length: total }, (_, index) => index);
  return vi.fn(async (startIndex: number, itemsPerPage: number) => ({
    items: all.slice(startIndex, startIndex + itemsPerPage),
    total,
  }));
}

describe('collectPages', () => {
  it('collects every page when the list fits inside the page budget', async () => {
    const fetchPage = pagedSource(25);
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 5 });

    expect(result.items).toHaveLength(25);
    expect(result.total).toBe(25);
    expect(result.complete).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('stops at the page budget and reports the list as incomplete', async () => {
    const fetchPage = pagedSource(100);
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 2 });

    expect(result.items).toHaveLength(20);
    expect(result.pagesFetched).toBe(2);
    expect(result.complete).toBe(false);
  });

  it('stops early once the caller has what it needs', async () => {
    const fetchPage = pagedSource(1000);
    const result = await collectPages(fetchPage, {
      pageSize: 10,
      maxPages: 10,
      isSatisfied: items => items.length >= 15,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.complete).toBe(true);
  });

  it('stops on a short page even when the reported total disagrees', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1, 2], total: 500 }));
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 5 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(2);
    expect(result.complete).toBe(false);
  });

  it('honours a starting offset when judging completeness', async () => {
    const fetchPage = pagedSource(30);
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 5, startIndex: 20 });

    expect(result.items).toHaveLength(10);
    expect(result.complete).toBe(true);
  });

  it('treats a source that reports no total as exhausted', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1] }));
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 3 });

    expect(result.complete).toBe(true);
    expect(result.total).toBeUndefined();
  });
});
