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

/** Query suffix that asks the images endpoint for the raw bytes instead of base64 JSON. */
export const RAW_IMAGE_QUERY = '?raw=1';

const DEFAULT_IMAGE_TYPE = 'image/png';

interface LegacyImagePayload {
  data: string;
  contentType: string;
}

function isJsonResponse(res: Response): boolean {
  return (res.headers.get('Content-Type') || '').toLowerCase().includes('application/json');
}

/**
 * A backend that predates `?raw=1` ignores the query and still answers with
 * `{ data: base64, contentType }`. Accepting that keeps images working while
 * the two are deployed independently.
 */
async function readLegacyPayload(res: Response): Promise<LegacyImagePayload | null> {
  const json: unknown = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') return null;
  const data = 'data' in json ? json.data : undefined;
  const contentType = 'contentType' in json ? json.contentType : undefined;
  if (typeof data !== 'string' || !data) return null;
  return { data, contentType: typeof contentType === 'string' && contentType ? contentType : DEFAULT_IMAGE_TYPE };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked so a large image neither overflows the argument limit nor pays a
  // string concatenation per byte.
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + CHUNK)));
  }
  return btoa(parts.join(''));
}

function imageTypeOf(res: Response): string {
  const header = (res.headers.get('Content-Type') || '').split(';')[0].trim();
  return header || DEFAULT_IMAGE_TYPE;
}

/** Turn a successful image response (raw bytes, or legacy JSON) into a `data:` URL. */
export async function imageResponseToDataUrl(res: Response): Promise<string | null> {
  if (isJsonResponse(res)) {
    const legacy = await readLegacyPayload(res);
    return legacy ? `data:${legacy.contentType};base64,${legacy.data}` : null;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) return null;
  return `data:${imageTypeOf(res)};base64,${bytesToBase64(bytes)}`;
}

/** Turn a successful image response (raw bytes, or legacy JSON) into a Blob. */
export async function imageResponseToBlob(res: Response): Promise<Blob | null> {
  if (isJsonResponse(res)) {
    const legacy = await readLegacyPayload(res);
    if (!legacy) return null;
    const binary = atob(legacy.data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: legacy.contentType });
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) return null;
  return new Blob([bytes], { type: imageTypeOf(res) });
}
