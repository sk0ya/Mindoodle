import { describe, expect, it, vi } from 'vitest';
import { MapStorageService } from './mapStorage';
import type { Env } from './types';

/**
 * The group workspace polls for remote edits every few seconds, so the cost of
 * a single "has this changed?" probe is what these tests are about: it must not
 * transfer the document.
 */

interface StoredObject {
  body: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

function makeBucket(initial: Record<string, StoredObject> = {}) {
  const objects = new Map(Object.entries(initial));
  let writes = 0;

  const toR2Object = (key: string, stored: StoredObject) => ({
    key,
    uploaded: stored.uploaded,
    httpMetadata: stored.httpMetadata,
    customMetadata: stored.customMetadata,
    text: async () => stored.body,
    arrayBuffer: async () => new TextEncoder().encode(stored.body).buffer
  });

  const head = vi.fn(async (key: string) => {
    const stored = objects.get(key);
    if (!stored) return null;
    // head() has no body, and reading one from it would be a test that lies.
    const { text: _text, ...withoutBody } = toR2Object(key, stored);
    return withoutBody;
  });

  const get = vi.fn(async (key: string) => {
    const stored = objects.get(key);
    return stored ? toR2Object(key, stored) : null;
  });

  const put = vi.fn(async (key: string, value: string | ArrayBuffer, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }) => {
    writes++;
    const stored: StoredObject = {
      body: typeof value === 'string' ? value : new TextDecoder().decode(value),
      uploaded: new Date(Date.UTC(2026, 5, 1, 0, 0, writes)),
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata
    };
    objects.set(key, stored);
    const { text: _text, ...withoutBody } = toR2Object(key, stored);
    return withoutBody;
  });

  const del = vi.fn(async (key: string) => {
    objects.delete(key);
  });

  const bucket = { head, get, put, delete: del, list: vi.fn() };
  const env = { MAPS_BUCKET: bucket, USERS: {}, ALLOWED_EMAIL: 'a@b.c' } as unknown as Env;

  return { env, objects, head, get, put, delete: del };
}

describe('MapStorageService.getMapMetadata', () => {
  it('reports the timestamp without reading the document body', async () => {
    const uploaded = new Date('2026-03-04T05:06:07.000Z');
    const bucket = makeBucket({
      'maps/user-1/Notes/Alpha.md': { body: '# Alpha\n', uploaded }
    });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.getMapMetadata('user-1', 'Notes/Alpha');

    expect(result.success).toBe(true);
    expect(result.map).toEqual({
      id: 'Notes/Alpha',
      createdAt: uploaded.toISOString(),
      updatedAt: uploaded.toISOString()
    });
    expect(bucket.head).toHaveBeenCalledWith('maps/user-1/Notes/Alpha.md');
    expect(bucket.get).not.toHaveBeenCalled();
  });

  it('never carries content, so a caller cannot mistake it for the document', async () => {
    const bucket = makeBucket({
      'maps/user-1/Alpha.md': { body: '# Alpha\n', uploaded: new Date() }
    });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.getMapMetadata('user-1', 'Alpha');

    expect(result.map).not.toHaveProperty('content');
  });

  it('reports a missing map instead of inventing a timestamp', async () => {
    const bucket = makeBucket();
    const storage = new MapStorageService(bucket.env);

    const result = await storage.getMapMetadata('user-1', 'Alpha');

    expect(result.success).toBe(false);
    expect(result.map).toBeUndefined();
  });

  it('scopes the lookup to the caller', async () => {
    const bucket = makeBucket({
      'maps/other-user/Alpha.md': { body: '# Alpha\n', uploaded: new Date() }
    });
    const storage = new MapStorageService(bucket.env);

    expect((await storage.getMapMetadata('user-1', 'Alpha')).success).toBe(false);
    expect((await storage.getMapMetadata('other-user', 'Alpha')).success).toBe(true);
  });

  it('reports a storage failure rather than throwing at the route', async () => {
    const bucket = makeBucket();
    bucket.head.mockRejectedValueOnce(new Error('R2 unavailable'));
    const storage = new MapStorageService(bucket.env);

    const result = await storage.getMapMetadata('user-1', 'Alpha');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('still returns the timestamp the full read would have reported', async () => {
    const uploaded = new Date('2026-03-04T05:06:07.000Z');
    const bucket = makeBucket({
      'maps/user-1/Alpha.md': { body: '# Alpha\n', uploaded }
    });
    const storage = new MapStorageService(bucket.env);

    const meta = await storage.getMapMetadata('user-1', 'Alpha');
    const full = await storage.getMap('user-1', 'Alpha');

    expect(meta.map?.updatedAt).toBe(full.map?.updatedAt);
  });
});

describe('MapStorageService.moveMap', () => {
  const uploaded = new Date('2026-03-04T05:06:07.000Z');
  const alpha = (): StoredObject => ({
    body: '# Alpha\n\nbody',
    uploaded,
    httpMetadata: { contentType: 'text/markdown' },
    customMetadata: { title: 'Alpha' }
  });

  it('moves the document to the new id and removes the old one', async () => {
    const bucket = makeBucket({ 'maps/user-1/Notes/Alpha.md': alpha() });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'Notes/Alpha', 'Archive/Alpha');

    expect(result.success).toBe(true);
    expect(result.map).toMatchObject({ id: 'Archive/Alpha', title: 'Alpha' });
    expect(result.map).not.toHaveProperty('content');
    expect(bucket.objects.has('maps/user-1/Notes/Alpha.md')).toBe(false);
    const moved = bucket.objects.get('maps/user-1/Archive/Alpha.md');
    expect(moved?.body).toBe('# Alpha\n\nbody');
    expect(moved?.httpMetadata).toEqual({ contentType: 'text/markdown' });
    expect(moved?.customMetadata).toEqual({ title: 'Alpha' });
    expect(result.map?.updatedAt).toBe(moved?.uploaded.toISOString());
  });

  it('decodes the stored title for the reply', async () => {
    const bucket = makeBucket({
      'maps/user-1/a.md': { ...alpha(), body: '# 日本語\n', customMetadata: { title: encodeURIComponent('日本語') } }
    });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b');

    expect(result.map?.title).toBe('日本語');
  });

  it('stores a title for a map written before titles were kept as metadata', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': { body: '# Legacy\n', uploaded } });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b');

    expect(result.map?.title).toBe('Legacy');
    expect(bucket.objects.get('maps/user-1/b.md')?.customMetadata).toEqual({ title: 'Legacy' });
  });

  it('reports a missing source without writing anything', async () => {
    const bucket = makeBucket();
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b');

    expect(result).toEqual({ success: false, error: 'Map not found' });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an existing destination', async () => {
    const other: StoredObject = { body: '# Other\n', uploaded, customMetadata: { title: 'Other' } };
    const bucket = makeBucket({ 'maps/user-1/a.md': alpha(), 'maps/user-1/b.md': other });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b');

    expect(result).toEqual({
      success: false,
      error: 'Destination already exists',
      conflict: { reason: 'destination_exists' }
    });
    expect(bucket.objects.get('maps/user-1/b.md')).toBe(other);
    expect(bucket.objects.has('maps/user-1/a.md')).toBe(true);
    expect(bucket.get).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('refuses a move based on a stale version, without reading the body', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': alpha() });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b', '2026-01-01T00:00:00.000Z');

    expect(result).toEqual({
      success: false,
      error: 'Map has been modified by another user',
      conflict: { currentUpdatedAt: uploaded.toISOString() }
    });
    expect(bucket.objects.has('maps/user-1/a.md')).toBe(true);
    expect(bucket.objects.has('maps/user-1/b.md')).toBe(false);
    expect(bucket.get).not.toHaveBeenCalled();
  });

  it('moves when the expected version is current', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': alpha() });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b', uploaded.toISOString());

    expect(result.success).toBe(true);
    expect(bucket.objects.has('maps/user-1/b.md')).toBe(true);
  });

  it('treats a move onto itself as a no-op that reports the current state', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': alpha() });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'a');

    expect(result).toEqual({
      success: true,
      map: { id: 'a', title: 'Alpha', createdAt: uploaded.toISOString(), updatedAt: uploaded.toISOString() }
    });
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('keeps the source when the copy fails', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': alpha() });
    bucket.put.mockRejectedValueOnce(new Error('R2 unavailable'));
    const storage = new MapStorageService(bucket.env);

    const result = await storage.moveMap('user-1', 'a', 'b');

    expect(result).toEqual({ success: false, error: 'Failed to move map' });
    expect(bucket.objects.has('maps/user-1/a.md')).toBe(true);
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('scopes both ends of the move to the caller', async () => {
    const bucket = makeBucket({ 'maps/other-user/a.md': alpha() });
    const storage = new MapStorageService(bucket.env);

    expect((await storage.moveMap('user-1', 'a', 'b')).success).toBe(false);
    expect(bucket.objects.has('maps/other-user/a.md')).toBe(true);
  });
});

describe('MapStorageService.saveMap conflict detection', () => {
  const uploaded = new Date('2026-03-04T05:06:07.000Z');

  it('refuses a save based on a stale version', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': { body: '# A\n', uploaded } });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.saveMap('user-1', 'a', 'A', '# A2\n', '2026-01-01T00:00:00.000Z');

    expect(result).toEqual({
      success: false,
      error: 'Map has been modified by another user',
      conflict: { currentUpdatedAt: uploaded.toISOString() }
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('saves when the expected version is current', async () => {
    const bucket = makeBucket({ 'maps/user-1/a.md': { body: '# A\n', uploaded } });
    const storage = new MapStorageService(bucket.env);

    const result = await storage.saveMap('user-1', 'a', 'A', '# A2\n', uploaded.toISOString());

    expect(result.success).toBe(true);
    expect(bucket.objects.get('maps/user-1/a.md')?.body).toBe('# A2\n');
  });
});
