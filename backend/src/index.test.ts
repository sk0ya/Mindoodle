import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './types';

/**
 * Route-level tests: they pin the HTTP contract the frontend codes against
 * (paths, query flags, status codes, headers), with KV and R2 mocked by hand.
 * The services behind the routes have their own focused tests.
 */

const TOKEN = 'tok-1';
const ORIGIN = 'http://localhost:5174';

interface StoredObject {
  bytes: Uint8Array<ArrayBuffer>;
  uploaded: Date;
  etag: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

let worker: { fetch(request: Request, env: Env): Promise<Response> };

beforeEach(async () => {
  // The session cache is per module instance; a fresh one keeps tests apart.
  vi.resetModules();
  worker = (await import('./index')).default;
});

function makeEnv(objects: Record<string, StoredObject> = {}) {
  const session = {
    userId: 'user-1',
    email: 'user@example.com',
    groupId: 'allowed-group',
    createdAt: new Date().toISOString(),
    renewedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  const kv = new Map<string, string>([[`session:${TOKEN}`, JSON.stringify(session)]]);
  const store = new Map(Object.entries(objects));
  let uploadCounter = 0;

  const metadataOf = (key: string, stored: StoredObject) => ({
    key,
    uploaded: stored.uploaded,
    etag: stored.etag,
    httpEtag: `"${stored.etag}"`,
    httpMetadata: stored.httpMetadata ?? {},
    customMetadata: stored.customMetadata ?? {},
  });

  const bucket = {
    head: vi.fn(async (key: string) => {
      const stored = store.get(key);
      return stored ? metadataOf(key, stored) : null;
    }),
    get: vi.fn(async (key: string, options?: { onlyIf?: { etagDoesNotMatch?: string } }) => {
      const stored = store.get(key);
      if (!stored) return null;
      if (options?.onlyIf?.etagDoesNotMatch === stored.etag) return metadataOf(key, stored);
      return {
        ...metadataOf(key, stored),
        body: new Blob([stored.bytes]).stream(),
        arrayBuffer: async () => stored.bytes.slice().buffer,
        text: async () => new TextDecoder().decode(stored.bytes),
      };
    }),
    put: vi.fn(async (key: string, value: string | ArrayBuffer, options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }) => {
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      uploadCounter++;
      const stored: StoredObject = {
        bytes,
        uploaded: new Date(Date.UTC(2026, 0, 1, 0, 0, uploadCounter)),
        etag: `etag-${uploadCounter}`,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      };
      store.set(key, stored);
      return metadataOf(key, stored);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
  };

  const env = {
    USERS: {
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        kv.delete(key);
      }),
    },
    MAPS_BUCKET: bucket,
    ALLOWED_EMAIL: 'user@example.com',
  } as unknown as Env;

  return { env, store, bucket };
}

function call(env: Env, method: string, path: string, options: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN, ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return worker.fetch(new Request(`https://api.example${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env);
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('image routes', () => {
  it('lets a cross-origin client send If-None-Match and read ETag', async () => {
    const { env } = makeEnv();

    const response = await worker.fetch(new Request('https://api.example/api/images/a.png', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    }), env);

    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('If-None-Match');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('ETag, Content-Type');
  });

  for (const [label, prefix, scope] of [
    ['personal', '/api/images/', 'user-1'],
    ['group', '/api/group/images/', 'group:allowed-group'],
  ] as const) {
    it(`serves raw bytes for ?raw=1 on the ${label} route`, async () => {
      const { env } = makeEnv({
        [`maps/${scope}/img/a.png`]: { bytes: PNG, uploaded: new Date(), etag: 'e1', httpMetadata: { contentType: 'image/png' } }
      });

      const response = await call(env, 'GET', `${prefix}img/a.png?raw=1`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('ETag')).toBe('"e1"');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(response.headers.get('Access-Control-Expose-Headers')).toBe('ETag, Content-Type');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
    });

    it(`revalidates with a 304 on the ${label} route`, async () => {
      const { env } = makeEnv({
        [`maps/${scope}/img/a.png`]: { bytes: PNG, uploaded: new Date(), etag: 'e1', httpMetadata: { contentType: 'image/png' } }
      });

      const response = await call(env, 'GET', `${prefix}img/a.png?raw=1`, { headers: { 'If-None-Match': '"e1"' } });

      expect(response.status).toBe(304);
      expect(response.body).toBeNull();
    });

    it(`keeps the legacy JSON form without ?raw=1 on the ${label} route`, async () => {
      const { env } = makeEnv({
        [`maps/${scope}/img/a.png`]: { bytes: PNG, uploaded: new Date(), etag: 'e1', httpMetadata: { contentType: 'image/png' } }
      });

      const response = await call(env, 'GET', `${prefix}img/a.png`);

      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean; data: string; contentType: string };
      expect(body.success).toBe(true);
      expect(body.contentType).toBe('image/png');
      expect(Uint8Array.from(atob(body.data), c => c.charCodeAt(0))).toEqual(PNG);
    });

    it(`reports a missing image as a JSON 404 on the ${label} route`, async () => {
      const { env } = makeEnv();

      const response = await call(env, 'GET', `${prefix}img/missing.png?raw=1`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ success: false, error: 'Image not found' });
    });
  }

  it('lists images past the first R2 page', async () => {
    const { env, bucket } = makeEnv();
    bucket.list
      .mockResolvedValueOnce({ objects: [{ key: 'maps/user-1/a.png' }], truncated: true, cursor: 'c1' })
      .mockResolvedValueOnce({ objects: [{ key: 'maps/user-1/b.png' }], truncated: false });

    const response = await call(env, 'GET', '/api/images/list');

    expect(await response.json()).toEqual({ success: true, files: ['a.png', 'b.png'] });
  });
});
