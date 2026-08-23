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
  customMetadata?: Record<string, string>;
}

function makeBucket(initial: Record<string, StoredObject> = {}) {
  const objects = new Map(Object.entries(initial));

  const toR2Object = (key: string, stored: StoredObject) => ({
    key,
    uploaded: stored.uploaded,
    customMetadata: stored.customMetadata,
    text: async () => stored.body
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

  const bucket = { head, get, put: vi.fn(), delete: vi.fn(), list: vi.fn() };
  const env = { MAPS_BUCKET: bucket, USERS: {}, ALLOWED_EMAIL: 'a@b.c' } as unknown as Env;

  return { env, objects, head, get };
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
