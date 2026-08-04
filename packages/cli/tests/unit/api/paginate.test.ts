import { describe, it, expect, vi } from 'vitest';
import { collectPages } from '../../../src/api/paginate.js';

function pagedSource(total: number, options: { reportTotal?: boolean; serverCap?: number } = {}) {
  const { reportTotal = true, serverCap } = options;
  const all = Array.from({ length: total }, (_, index) => index);
  return vi.fn(async (startIndex: number, itemsPerPage: number) => {
    const size = serverCap ? Math.min(itemsPerPage, serverCap) : itemsPerPage;
    return {
      items: all.slice(startIndex, startIndex + size),
      ...(reportTotal ? { total } : {}),
    };
  });
}

describe('collectPages', () => {
  it('collects every page when the list fits inside the page budget', async () => {
    const fetchPage = pagedSource(25);
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 5 });

    expect(result.items).toHaveLength(25);
    expect(result.total).toBe(25);
    expect(result.complete).toBe(true);
    expect(result.stoppedBecause).toBe('total-reached');
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('reports a list that exactly fills the reported total as complete', async () => {
    const result = await collectPages(pagedSource(30), { pageSize: 10, maxPages: 5 });
    expect(result.items).toHaveLength(30);
    expect(result.complete).toBe(true);
    expect(result.stoppedBecause).toBe('total-reached');
  });

  it('stops at the page budget and does not claim completeness', async () => {
    const fetchPage = pagedSource(100);
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 2 });

    expect(result.items).toHaveLength(20);
    expect(result.pagesFetched).toBe(2);
    expect(result.complete).toBe(false);
    expect(result.stoppedBecause).toBe('page-budget');
  });

  // The whole point of separating these: "enough for the caller" is not
  // "everything on the register", and reporting it as complete is how a
  // partial answer gets presented as a whole one.
  it('does not call a satisfied predicate complete', async () => {
    const fetchPage = pagedSource(1000);
    const result = await collectPages(fetchPage, {
      pageSize: 10,
      maxPages: 10,
      isSatisfied: items => items.length >= 15,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.stoppedBecause).toBe('satisfied');
    expect(result.complete).toBe(false);
  });

  it('does not call a budget-truncated read complete when no total was reported', async () => {
    // The dangerous case: full pages every time, no total to contradict them.
    const fetchPage = pagedSource(1000, { reportTotal: false });
    const result = await collectPages(fetchPage, { pageSize: 100, maxPages: 5 });

    expect(result.items).toHaveLength(500);
    expect(result.total).toBeUndefined();
    expect(result.stoppedBecause).toBe('page-budget');
    expect(result.complete).toBe(false);
  });

  it('stops on a short page when there is no total to contradict it', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1, 2] }));
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 5 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(2);
    expect(result.stoppedBecause).toBe('exhausted');
    expect(result.complete).toBe(true);
  });

  it('does not claim completeness when a total it never reached says more remain', async () => {
    // A source that keeps returning a short page without ever reaching its own
    // reported total is misbehaving; the honest answer is "not complete".
    const fetchPage = vi.fn(async () => ({ items: [1, 2], total: 500 }));
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 3 });

    expect(result.pagesFetched).toBe(3);
    expect(result.stoppedBecause).toBe('page-budget');
    expect(result.complete).toBe(false);
  });

  it('keeps paging when the server caps the page below what was requested', async () => {
    // A server-side cap must not read as the end of the list.
    const fetchPage = pagedSource(120, { serverCap: 20 });
    const result = await collectPages(fetchPage, { pageSize: 100, maxPages: 10 });

    expect(result.items).toHaveLength(120);
    expect(result.complete).toBe(true);
    expect(fetchPage.mock.calls.length).toBeGreaterThan(1);
  });

  it('measures completeness from the requested offset, not from zero', async () => {
    const result = await collectPages(pagedSource(30), {
      pageSize: 10,
      maxPages: 5,
      startIndex: 20,
    });

    expect(result.items).toHaveLength(10);
    expect(result.stoppedBecause).toBe('total-reached');
    expect(result.complete).toBe(true);
  });

  it('treats an empty first page as an exhausted list', async () => {
    const fetchPage = vi.fn(async () => ({ items: [] }));
    const result = await collectPages(fetchPage, { pageSize: 10, maxPages: 3 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.complete).toBe(true);
    expect(result.stoppedBecause).toBe('exhausted');
  });
});
