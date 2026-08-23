/**
 * Cache for map documents fetched from the cloud backend.
 *
 * `GET /api/maps/{id}` returns the whole document, and without a cache the app
 * issues that request several times for a single user action (open a map,
 * refresh the list, poll for remote edits), which is what made cloud
 * workspaces feel slow.
 *
 * This cache solves three distinct problems:
 * - `load()` de-duplicates concurrent and closely spaced reads of the same map.
 * - `getByUpdatedAt()` lets a caller that already knows the authoritative
 *   `updatedAt` — the list endpoint, or a `?meta=1` probe — confirm that a
 *   cached document is still current, so it is never re-downloaded.
 * - `has()` tells a freshness probe whether there is a cached copy worth
 *   comparing against at all.
 */

export interface CloudMapDetail {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface CacheEntry {
  detail: CloudMapDetail;
  /** Timestamp of the last response that confirmed this entry against the server. */
  verifiedAt: number;
}

/** Default window during which a fetched document is reused without revalidating. */
export const DEFAULT_MAP_FRESHNESS_MS = 2000;

/**
 * Upper bound on cached documents. Map bodies are markdown, but a large
 * workspace would otherwise pin every document in memory for the session.
 */
export const MAX_CACHED_MAPS = 100;

export class CloudMapCache {
  private entries = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<CloudMapDetail | null>>();
  /**
   * Bumped for a map whenever it is invalidated, so a request that was already
   * running when the invalidation happened cannot resurrect the stale document.
   */
  private generations = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries: number = MAX_CACHED_MAPS
  ) {}

  /**
   * Read a map, reusing a recent response when possible.
   *
   * @param maxAgeMs 0 forces a revalidation (concurrent callers still share one
   *                 request); a positive value serves cached documents fetched
   *                 within that window.
   */
  async load(
    mapId: string,
    loader: () => Promise<CloudMapDetail | null>,
    maxAgeMs: number = DEFAULT_MAP_FRESHNESS_MS
  ): Promise<CloudMapDetail | null> {
    if (maxAgeMs > 0) {
      const fresh = this.getFresh(mapId, maxAgeMs);
      if (fresh) return fresh;
    }

    const pending = this.inflight.get(mapId);
    if (pending) return pending;

    const generation = this.generations.get(mapId) ?? 0;
    const request = (async () => {
      const detail = await loader();
      // Drop the result if the map was invalidated (deleted, renamed, written)
      // while this request was in flight: it describes a state that no longer
      // exists, and caching it would hand stale content to the next reader.
      if (detail && (this.generations.get(mapId) ?? 0) === generation) {
        this.set(detail);
      }
      return detail;
    })();

    this.inflight.set(mapId, request);
    try {
      return await request;
    } finally {
      // Only clear our own entry: a later load() may have started a new one.
      if (this.inflight.get(mapId) === request) this.inflight.delete(mapId);
    }
  }

  /** Cached document if it was confirmed against the server within `maxAgeMs`. */
  getFresh(mapId: string, maxAgeMs: number = DEFAULT_MAP_FRESHNESS_MS): CloudMapDetail | null {
    const entry = this.entries.get(mapId);
    if (!entry) return null;
    return this.now() - entry.verifiedAt <= maxAgeMs ? entry.detail : null;
  }

  /**
   * Cached document if its version matches `updatedAt`, regardless of age.
   * Used with the list endpoint, which reports the authoritative `updatedAt`
   * for every map in a single request.
   */
  getByUpdatedAt(mapId: string, updatedAt: string | undefined): CloudMapDetail | null {
    if (!updatedAt) return null;
    const entry = this.entries.get(mapId);
    if (!entry || entry.detail.updatedAt !== updatedAt) return null;

    entry.verifiedAt = this.now();
    this.touch(mapId, entry);
    return entry.detail;
  }

  /** Store a document confirmed by a GET or returned by a successful write. */
  set(detail: CloudMapDetail): void {
    this.entries.delete(detail.id);
    this.evictIfFull();
    this.entries.set(detail.id, { detail, verifiedAt: this.now() });
  }

  /**
   * Whether a copy of this document is held at all, fresh or not. A freshness
   * probe is only worth making when there is something to compare against.
   */
  has(mapId: string): boolean {
    return this.entries.has(mapId);
  }

  invalidate(mapId: string): void {
    this.generations.set(mapId, (this.generations.get(mapId) ?? 0) + 1);
    this.entries.delete(mapId);
    this.inflight.delete(mapId);
  }

  clear(): void {
    for (const mapId of this.entries.keys()) {
      this.generations.set(mapId, (this.generations.get(mapId) ?? 0) + 1);
    }
    for (const mapId of this.inflight.keys()) {
      this.generations.set(mapId, (this.generations.get(mapId) ?? 0) + 1);
    }
    this.entries.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  /** Move an entry to the most-recently-used end of the eviction order. */
  private touch(mapId: string, entry: CacheEntry): void {
    this.entries.delete(mapId);
    this.entries.set(mapId, entry);
  }

  private evictIfFull(): void {
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }
}
