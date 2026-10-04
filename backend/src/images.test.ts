import { describe, expect, it, vi } from 'vitest';
import { encodeBase64, listImagePaths, readImage } from './images';

interface StoredImage {
  bytes: Uint8Array<ArrayBuffer>;
  contentType?: string;
  etag: string;
}

/** The per-byte encoder the routes used to run: slow, but obviously correct. */
function referenceBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const CORS = { 'Access-Control-Allow-Origin': 'http://localhost:5174' };

function makeBucket(initial: Record<string, StoredImage> = {}) {
  const objects = new Map(Object.entries(initial));

  const metadataOf = (key: string, stored: StoredImage) => ({
    key,
    etag: stored.etag,
    httpEtag: `"${stored.etag}"`,
    httpMetadata: stored.contentType ? { contentType: stored.contentType } : {},
  });

  // Mirrors R2: a failed onlyIf precondition yields the object *without* a body.
  const bodyReads = { count: 0 };
  const get = vi.fn(async (key: string, options?: { onlyIf?: { etagDoesNotMatch?: string } }) => {
    const stored = objects.get(key);
    if (!stored) return null;
    if (options?.onlyIf?.etagDoesNotMatch === stored.etag) return metadataOf(key, stored);
    return {
      ...metadataOf(key, stored),
      get body() {
        bodyReads.count++;
        return new Blob([stored.bytes]).stream();
      },
      arrayBuffer: async () => {
        bodyReads.count++;
        return stored.bytes.slice().buffer;
      },
    };
  });

  return { bucket: { get } as unknown as R2Bucket, get, bodyReads };
}

function request(headers: Record<string, string> = {}) {
  return new Request('https://api.example/api/images/a.png', { headers });
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10]);

describe('readImage (raw)', () => {
  it('returns the stored bytes with their content type and etag', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, contentType: 'image/png', etag: 'e1' } });

    const response = await readImage(bucket, 'k', request(), { raw: true, corsHeaders: CORS });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('ETag')).toBe('"e1"');
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5174');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it('falls back to a generic binary type when none was stored', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, etag: 'e1' } });

    const response = await readImage(bucket, 'k', request(), { raw: true, corsHeaders: CORS });

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('answers a matching If-None-Match with a bodiless 304 without reading the image', async () => {
    const store = makeBucket({ 'k': { bytes: PNG_BYTES, contentType: 'image/png', etag: 'e1' } });

    const response = await readImage(store.bucket, 'k', request({ 'If-None-Match': '"e1"' }), { raw: true, corsHeaders: CORS });

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(response.headers.get('ETag')).toBe('"e1"');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5174');
    expect(store.get).toHaveBeenCalledWith('k', { onlyIf: { etagDoesNotMatch: 'e1' } });
    expect(store.bodyReads.count).toBe(0);
  });

  it('accepts a weak validator for the same etag', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, etag: 'e1' } });

    const response = await readImage(bucket, 'k', request({ 'If-None-Match': 'W/"e1"' }), { raw: true, corsHeaders: CORS });

    expect(response.status).toBe(304);
  });

  it('sends the new bytes when the presented etag is stale', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, contentType: 'image/png', etag: 'e2' } });

    const response = await readImage(bucket, 'k', request({ 'If-None-Match': '"e1"' }), { raw: true, corsHeaders: CORS });

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"e2"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it('reports a missing image as a JSON 404', async () => {
    const { bucket } = makeBucket();

    const response = await readImage(bucket, 'k', request(), { raw: true, corsHeaders: CORS });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toEqual({ success: false, error: 'Image not found' });
  });
});

describe('readImage (legacy JSON)', () => {
  it('still returns base64 in JSON for clients that do not ask for raw', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, contentType: 'image/jpeg', etag: 'e1' } });

    const response = await readImage(bucket, 'k', request(), { raw: false, corsHeaders: CORS });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: referenceBase64(PNG_BYTES),
      contentType: 'image/jpeg'
    });
  });

  it('ignores If-None-Match, since the JSON form carries no etag to match', async () => {
    const { bucket } = makeBucket({ 'k': { bytes: PNG_BYTES, contentType: 'image/png', etag: 'e1' } });

    const response = await readImage(bucket, 'k', request({ 'If-None-Match': '"e1"' }), { raw: false, corsHeaders: CORS });

    expect(response.status).toBe(200);
  });
});

describe('encodeBase64', () => {
  it('matches a reference encoder across chunk boundaries', () => {
    // Larger than one 32 KiB chunk and not a multiple of it or of 3.
    const bytes = new Uint8Array(100_003);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff;

    expect(encodeBase64(bytes)).toBe(referenceBase64(bytes));
  });

  it('encodes an empty image as an empty string', () => {
    expect(encodeBase64(new Uint8Array())).toBe('');
  });
});

describe('listImagePaths', () => {
  it('follows the cursor so nothing past the first page is dropped', async () => {
    const pages = [
      { objects: [{ key: 'maps/u1/img/a.png' }, { key: 'maps/u1/img/b.png' }], truncated: true, cursor: 'c1' },
      { objects: [{ key: 'maps/u1/img/c.png' }], truncated: true, cursor: 'c2' },
      { objects: [{ key: 'maps/u1/img/d.png' }], truncated: false },
    ];
    const list = vi.fn(async (options: { cursor?: string }) => {
      const index = options.cursor === undefined ? 0 : options.cursor === 'c1' ? 1 : 2;
      return pages[index];
    });
    const bucket = { list } as unknown as R2Bucket;

    const files = await listImagePaths(bucket, 'u1', 'img/');

    expect(files).toEqual(['img/a.png', 'img/b.png', 'img/c.png', 'img/d.png']);
    expect(list).toHaveBeenCalledTimes(3);
    expect(list).toHaveBeenNthCalledWith(1, { prefix: 'maps/u1/img/', cursor: undefined });
    expect(list).toHaveBeenNthCalledWith(2, { prefix: 'maps/u1/img/', cursor: 'c1' });
    expect(list).toHaveBeenNthCalledWith(3, { prefix: 'maps/u1/img/', cursor: 'c2' });
  });

  it('lists a single page with one call', async () => {
    const list = vi.fn(async () => ({ objects: [{ key: 'maps/group:g/x.png' }], truncated: false }));
    const bucket = { list } as unknown as R2Bucket;

    expect(await listImagePaths(bucket, 'group:g', '')).toEqual(['x.png']);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
