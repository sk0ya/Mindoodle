import { describe, it, expect, vi } from 'vitest';
import { CloudMapCache, DEFAULT_MAP_FRESHNESS_MS, type CloudMapDetail } from './CloudMapCache';

const detail = (overrides: Partial<CloudMapDetail> = {}): CloudMapDetail => ({
  id: 'Notes/Alpha',
  title: 'Alpha',
  content: '# Alpha\n',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** Cache with a clock the test drives explicitly. */
const createCache = () => {
  const clock = { value: 1_000_000 };
  const cache = new CloudMapCache(() => clock.value);
  return { cache, clock };
};

describe('CloudMapCache', () => {
  it('serves a document fetched within the freshness window without calling the loader again', async () => {
    const { cache } = createCache();
    const loader = vi.fn(async () => detail());

    const first = await cache.load('Notes/Alpha', loader);
    const second = await cache.load('Notes/Alpha', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('reloads once the freshness window has passed', async () => {
    const { cache, clock } = createCache();
    const loader = vi.fn(async () => detail());

    await cache.load('Notes/Alpha', loader);
    clock.value += DEFAULT_MAP_FRESHNESS_MS + 1;
    await cache.load('Notes/Alpha', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares a single in-flight request between concurrent readers', async () => {
    const { cache } = createCache();
    let resolve: ((value: CloudMapDetail) => void) | undefined;
    const loader = vi.fn(() => new Promise<CloudMapDetail | null>((r) => { resolve = r; }));

    const reads = Promise.all([
      cache.load('Notes/Alpha', loader),
      cache.load('Notes/Alpha', loader),
      cache.load('Notes/Alpha', loader),
    ]);
    resolve?.(detail());
    const results = await reads;

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.content === '# Alpha\n')).toBe(true);
  });

  it('still shares an in-flight request when the caller demands a revalidation', async () => {
    const { cache } = createCache();
    let resolve: ((value: CloudMapDetail) => void) | undefined;
    const loader = vi.fn(() => new Promise<CloudMapDetail | null>((r) => { resolve = r; }));

    const reads = Promise.all([
      cache.load('Notes/Alpha', loader, 0),
      cache.load('Notes/Alpha', loader, 0),
    ]);
    resolve?.(detail());
    await reads;

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('revalidates when maxAgeMs is 0 even though a cached document exists', async () => {
    const { cache } = createCache();
    const loader = vi.fn(async () => detail());

    await cache.load('Notes/Alpha', loader);
    await cache.load('Notes/Alpha', loader, 0);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('accepts a stale-but-unchanged document when the server reports the same updatedAt', async () => {
    const { cache, clock } = createCache();
    const loader = vi.fn(async () => detail());

    await cache.load('Notes/Alpha', loader);
    clock.value += 60_000;

    expect(cache.getByUpdatedAt('Notes/Alpha', '2026-01-01T00:00:00.000Z')).not.toBeNull();
    // The match also counts as a revalidation, so a following read is a hit.
    expect(cache.getFresh('Notes/Alpha')).not.toBeNull();
  });

  it('rejects a cached document when the server reports a newer version', async () => {
    const { cache } = createCache();
    await cache.load('Notes/Alpha', async () => detail());

    expect(cache.getByUpdatedAt('Notes/Alpha', '2026-02-02T00:00:00.000Z')).toBeNull();
    expect(cache.getByUpdatedAt('Notes/Alpha', undefined)).toBeNull();
  });

  it('does not cache a loader result of null', async () => {
    const { cache } = createCache();
    const loader = vi.fn(async () => null);

    await cache.load('Missing', loader);
    await cache.load('Missing', loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it('forgets a document on invalidate and clear', async () => {
    const { cache } = createCache();
    const loader = vi.fn(async () => detail());

    await cache.load('Notes/Alpha', loader);
    cache.invalidate('Notes/Alpha');
    await cache.load('Notes/Alpha', loader);
    expect(loader).toHaveBeenCalledTimes(2);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('propagates loader failures without caching them', async () => {
    const { cache } = createCache();
    const loader = vi.fn(async () => { throw new Error('offline'); });

    await expect(cache.load('Notes/Alpha', loader)).rejects.toThrow('offline');
    await expect(cache.load('Notes/Alpha', loader)).rejects.toThrow('offline');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('CloudMapCache invalidation races', () => {
  it('discards an in-flight response for a map invalidated while it was running', async () => {
    const { cache } = createCache();
    let resolve: ((value: CloudMapDetail) => void) | undefined;
    const read = cache.load('Notes/Alpha', () => new Promise<CloudMapDetail | null>((r) => { resolve = r; }));

    // The map is deleted (or written) before the read comes back.
    cache.invalidate('Notes/Alpha');
    resolve?.(detail());
    await read;

    expect(cache.size).toBe(0);
    expect(cache.getFresh('Notes/Alpha')).toBeNull();
  });

  it('discards an in-flight response when the whole cache is cleared', async () => {
    const { cache } = createCache();
    let resolve: ((value: CloudMapDetail) => void) | undefined;
    const read = cache.load('Notes/Alpha', () => new Promise<CloudMapDetail | null>((r) => { resolve = r; }));

    cache.clear();
    resolve?.(detail());
    await read;

    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used document once the cap is reached', async () => {
    const clock = { value: 1_000_000 };
    const cache = new CloudMapCache(() => clock.value, 3);

    for (const id of ['a', 'b', 'c']) {
      await cache.load(id, async () => detail({ id }));
    }
    // Keep 'a' hot, then admit a fourth document.
    expect(cache.getFresh('a')).not.toBeNull();
    cache.getByUpdatedAt('a', '2026-01-01T00:00:00.000Z');
    await cache.load('d', async () => detail({ id: 'd' }));

    expect(cache.size).toBeLessThanOrEqual(3);
    expect(cache.getFresh('a')).not.toBeNull();
    expect(cache.getFresh('d')).not.toBeNull();
    expect(cache.getFresh('b')).toBeNull();
  });
});
