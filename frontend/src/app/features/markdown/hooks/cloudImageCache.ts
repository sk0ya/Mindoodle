/**
 * Process-wide cache for cloud-hosted preview images.
 *
 * The markdown preview re-renders on every keystroke, which rebuilds its DOM
 * and drops any per-element "already loaded" marker. Without a cache that
 * turned every keystroke into a fresh GET for every image in the document.
 *
 * Entries are keyed by workspace + path. A resolved `data:` URL is kept for the
 * session; a failure is remembered only briefly, because the usual causes
 * (an expired token, an image whose upload has not landed yet) resolve
 * themselves and a permanent negative entry would leave the preview broken for
 * the rest of the session.
 */

interface CacheEntry {
  value: string | null;
  /** Only set for failures: the time after which the image is retried. */
  expiresAt?: number;
}

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

/** Bound the cache so a long session cannot grow it without limit. */
const MAX_ENTRIES = 200;

/** How long a failed lookup suppresses retries. */
export const FAILURE_TTL_MS = 30_000;

export function cloudImageKey(workspaceId: string, path: string): string {
  return `${workspaceId}:${path}`;
}

/**
 * Cached result, or `undefined` when the image must be fetched. A cached
 * failure returns `null` until it expires.
 */
export function getCachedCloudImage(key: string): string | null | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
    entries.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Resolve an image, reusing a cached result and de-duplicating concurrent
 * requests for the same key.
 */
export async function resolveCloudImage(
  key: string,
  loader: () => Promise<string | null>
): Promise<string | null> {
  const cached = getCachedCloudImage(key);
  if (cached !== undefined) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const result = await loader();
      setCachedCloudImage(key, result);
      return result;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

export function setCachedCloudImage(key: string, value: string | null): void {
  if (entries.size >= MAX_ENTRIES && !entries.has(key)) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.delete(key);
  entries.set(key, value === null ? { value, expiresAt: Date.now() + FAILURE_TTL_MS } : { value });
}

/** Drop a cached image, e.g. after it has been re-uploaded. */
export function invalidateCloudImage(key: string): void {
  entries.delete(key);
  inflight.delete(key);
}

/**
 * Drop every remembered failure. Called when the session changes, so images
 * that failed with the previous (or expired) credentials are retried at once.
 */
export function clearCloudImageFailures(): void {
  for (const [key, entry] of entries) {
    if (entry.value === null) entries.delete(key);
  }
}

export function clearCloudImageCache(): void {
  entries.clear();
  inflight.clear();
}
