import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cache } from '../../../src/api/cache.js';

describe('Cache', () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(3);
  });

  it('stores and retrieves values', () => {
    cache.set('key', 'value', 60000);
    expect(cache.get('key')).toBe('value');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('respects TTL', () => {
    vi.useFakeTimers();
    cache.set('key', 'value', 1000);
    expect(cache.get('key')).toBe('value');

    vi.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeUndefined();
    vi.useRealTimers();
  });

  it('evicts LRU entry when at capacity', () => {
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.set('c', 3, 60000);
    // Access 'a' to make it recently used
    cache.get('a');
    // Add new entry, should evict 'b' (least recently used)
    cache.set('d', 4, 60000);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('reports correct size', () => {
    expect(cache.size).toBe(0);
    cache.set('a', 1, 60000);
    expect(cache.size).toBe(1);
    cache.set('b', 2, 60000);
    expect(cache.size).toBe(2);
  });

  it('clears all entries', () => {
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('deletes specific entries', () => {
    cache.set('a', 1, 60000);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.delete('missing')).toBe(false);
  });

  it('updates existing key without increasing size', () => {
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.set('c', 3, 60000);
    cache.set('a', 10, 60000); // update existing
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBe(10);
  });
});
