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

function markdown(text: string, uploaded = new Date('2026-03-04T05:06:07.000Z'), title?: string): StoredObject {
  return {
    bytes: new TextEncoder().encode(text),
    uploaded,
    etag: 'm1',
    httpMetadata: { contentType: 'text/markdown' },
    customMetadata: title ? { title } : undefined,
  };
}

describe('personal map conflict detection', () => {
  const uploaded = new Date('2026-03-04T05:06:07.000Z');

  it('rejects a PUT based on a stale version with 409', async () => {
    const { env, store } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n', uploaded) });

    const response = await call(env, 'PUT', '/api/maps/a', {
      body: { title: 'A', content: '# A2\n', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Map has been modified by another user',
      conflict: { currentUpdatedAt: uploaded.toISOString() }
    });
    expect(new TextDecoder().decode(store.get('maps/user-1/a.md')?.bytes)).toBe('# A\n');
  });

  it('rejects a POST based on a stale version with 409', async () => {
    const { env } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n', uploaded) });

    const response = await call(env, 'POST', '/api/maps', {
      body: { id: 'a', title: 'A', content: '# A2\n', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }
    });

    expect(response.status).toBe(409);
  });

  it('accepts a PUT whose expected version is current', async () => {
    const { env } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n', uploaded) });

    const response = await call(env, 'PUT', '/api/maps/a', {
      body: { title: 'A', content: '# A2\n', expectedUpdatedAt: uploaded.toISOString() }
    });

    expect(response.status).toBe(200);
  });

  it('still accepts a PUT without an expected version, as old clients send', async () => {
    const { env } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n', uploaded) });

    const response = await call(env, 'PUT', '/api/maps/a', { body: { title: 'A', content: '# A2\n' } });

    expect(response.status).toBe(200);
  });
});

describe('map move routes', () => {
  for (const [label, path, scope] of [
    ['personal', '/api/maps/move', 'user-1'],
    ['group', '/api/group/maps/move', 'group:allowed-group'],
  ] as const) {
    it(`moves a map on the ${label} route`, async () => {
      const { env, store } = makeEnv({ [`maps/${scope}/Old.md`]: markdown('# Old\n', undefined, 'Old') });

      const response = await call(env, 'POST', path, { body: { fromId: 'Old', toId: 'Folder/New' } });

      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean; map: Record<string, string> };
      expect(body.success).toBe(true);
      expect(Object.keys(body.map).sort()).toEqual(['createdAt', 'id', 'title', 'updatedAt']);
      expect(body.map.id).toBe('Folder/New');
      expect(body.map.title).toBe('Old');
      expect(store.has(`maps/${scope}/Old.md`)).toBe(false);
      expect(store.has(`maps/${scope}/Folder/New.md`)).toBe(true);
    });

    it(`refuses to overwrite a destination on the ${label} route`, async () => {
      const { env, store } = makeEnv({
        [`maps/${scope}/a.md`]: markdown('# A\n'),
        [`maps/${scope}/b.md`]: markdown('# B\n'),
      });

      const response = await call(env, 'POST', path, { body: { fromId: 'a', toId: 'b' } });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Destination already exists',
        conflict: { reason: 'destination_exists' }
      });
      expect(new TextDecoder().decode(store.get(`maps/${scope}/b.md`)?.bytes)).toBe('# B\n');
    });
  }

  it('answers a missing source with 404', async () => {
    const { env } = makeEnv();

    const response = await call(env, 'POST', '/api/maps/move', { body: { fromId: 'a', toId: 'b' } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'Map not found' });
  });

  it('answers a stale expectedUpdatedAt with 409 and the current version', async () => {
    const uploaded = new Date('2026-03-04T05:06:07.000Z');
    const { env } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n', uploaded) });

    const response = await call(env, 'POST', '/api/maps/move', {
      body: { fromId: 'a', toId: 'b', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, conflict: { currentUpdatedAt: uploaded.toISOString() } });
  });

  for (const body of [{}, { fromId: 'a' }, { fromId: '', toId: 'b' }, { fromId: 'a', toId: '  ' }, { fromId: 1, toId: 'b' }]) {
    it(`rejects ${JSON.stringify(body)} with 400`, async () => {
      const { env, bucket } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n') });

      const response = await call(env, 'POST', '/api/maps/move', { body });

      expect(response.status).toBe(400);
      expect(bucket.put).not.toHaveBeenCalled();
    });
  }

  it('rejects a body that is not JSON with 400', async () => {
    const { env } = makeEnv();

    const response = await worker.fetch(new Request('https://api.example/api/maps/move', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: '{not json',
    }), env);

    expect(response.status).toBe(400);
  });

  it('requires authentication', async () => {
    const { env } = makeEnv({ 'maps/user-1/a.md': markdown('# A\n') });

    const response = await call(env, 'POST', '/api/maps/move', {
      body: { fromId: 'a', toId: 'b' },
      headers: { Authorization: 'Bearer wrong' }
    });

    expect(response.status).toBe(401);
  });

  it('still treats GET /api/maps/move as reading a map whose id is "move"', async () => {
    const { env } = makeEnv({ 'maps/user-1/move.md': markdown('# Move\n') });

    const response = await call(env, 'GET', '/api/maps/move');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, map: { id: 'move', content: '# Move\n' } });
  });
});
