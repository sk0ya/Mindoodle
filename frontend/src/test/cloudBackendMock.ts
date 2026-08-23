import { vi } from 'vitest';
import { safeJsonParseWithDefault } from '@shared/utils';

/**
 * Minimal in-memory stand-in for the Mindoodle cloud backend.
 *
 * It records every request so tests can assert on the exact HTTP traffic an
 * adapter produces, and it implements the optimistic-locking contract
 * (`expectedUpdatedAt` / 409 + `conflict.currentUpdatedAt`) that the group
 * workspace relies on.
 */

export const BASE_URL = 'https://backend.test';

export interface StoredMap {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestLogEntry {
  method: string;
  path: string;
  body?: unknown;
}

export interface CloudBackendOptions {
  /** Endpoint prefix for maps, e.g. '/api/maps' or '/api/group/maps'. */
  mapsPath?: string;
  /** Endpoint prefix for images, e.g. '/api/images' or '/api/group/images'. */
  imagesPath?: string;
}

const jsonResponse = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'OK',
  json: async () => body,
}) as unknown as Response;

export const createCloudBackend = (options: CloudBackendOptions = {}) => {
  const mapsPath = options.mapsPath || '/api/maps';
  const imagesPath = options.imagesPath || '/api/images';

  const maps = new Map<string, StoredMap>();
  const images: string[] = [];
  const requests: RequestLogEntry[] = [];
  /** Overrides the /api/auth/me reply, so tests can simulate a backend outage. */
  let authMeFailure: { status: number; body: unknown } | null = null;
  let clock = Date.parse('2026-01-01T00:00:00.000Z');

  /** Distinct, increasing timestamps so version comparisons are unambiguous. */
  const nextTimestamp = (): string => {
    clock += 1000;
    return new Date(clock).toISOString();
  };

  const seed = (id: string, content: string, updatedAt: string): void => {
    maps.set(id, {
      title: content.replace(/^#\s*/, '').trim(),
      content,
      createdAt: updatedAt,
      updatedAt,
    });
  };

  const handleMapWrite = (mapId: string, raw: string): Response => {
    const body = safeJsonParseWithDefault<{ title?: string; content?: string; expectedUpdatedAt?: string }>(raw, {});
    const previous = maps.get(mapId);

    if (body.expectedUpdatedAt && previous && previous.updatedAt !== body.expectedUpdatedAt) {
      return jsonResponse({
        success: false,
        error: 'Map has been modified by another user',
        conflict: { currentUpdatedAt: previous.updatedAt },
      }, 409);
    }

    const updatedAt = nextTimestamp();
    const stored: StoredMap = {
      title: body.title || 'Untitled',
      content: body.content || '',
      createdAt: previous?.createdAt || updatedAt,
      updatedAt,
    };
    maps.set(mapId, stored);
    return jsonResponse({ success: true, map: { id: mapId, ...stored } });
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const path = url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url;
    const method = (init?.method || 'GET').toUpperCase();
    const rawBody = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({ method, path, body: rawBody ? safeJsonParseWithDefault<unknown>(rawBody, undefined) : undefined });

    if (path === '/api/auth/login') {
      return jsonResponse({ success: true, token: 'token-1', user: { id: 'u1', email: 'a@b.c', groupId: 'g1' } });
    }

    if (path === '/api/auth/logout') {
      return jsonResponse({ success: true });
    }

    if (path === '/api/auth/me') {
      if (authMeFailure) return jsonResponse(authMeFailure.body, authMeFailure.status);
      return jsonResponse({ success: true, user: { id: 'u1', email: 'a@b.c', groupId: 'g1' } });
    }

    if (path === `${imagesPath}/list?path=`) {
      return jsonResponse({ success: true, files: images });
    }

    if (path === `${imagesPath}/upload` && method === 'POST') {
      return jsonResponse({ success: true });
    }

    if (path.startsWith(`${imagesPath}/`) && method === 'DELETE') {
      const imagePath = decodeURIComponent(path.slice(`${imagesPath}/`.length));
      const index = images.indexOf(imagePath);
      if (index >= 0) images.splice(index, 1);
      return jsonResponse({ success: true });
    }

    if (path === mapsPath) {
      return jsonResponse({
        success: true,
        maps: Array.from(maps.entries()).map(([id, m]) => ({
          id,
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    }

    if (path.startsWith(`${mapsPath}/`)) {
      const mapId = decodeURIComponent(path.slice(`${mapsPath}/`.length));

      if (method === 'GET') {
        const stored = maps.get(mapId);
        if (!stored) return jsonResponse({ success: false, error: 'Map not found' }, 404);
        return jsonResponse({ success: true, map: { id: mapId, ...stored } });
      }

      if (method === 'PUT') {
        return handleMapWrite(mapId, rawBody ?? '{}');
      }

      if (method === 'DELETE') {
        maps.delete(mapId);
        return jsonResponse({ success: true });
      }
    }

    return jsonResponse({ success: false, error: `unhandled ${method} ${path}` }, 500);
  });

  /** Make /api/auth/me fail until cleared with `failAuthMe(null)`. */
  const failAuthMe = (failure: { status: number; body?: unknown } | null): void => {
    authMeFailure = failure
      ? { status: failure.status, body: failure.body ?? { success: false, error: 'unavailable' } }
      : null;
  };

  return { maps, images, requests, fetchMock, seed, nextTimestamp, failAuthMe, mapsPath, imagesPath };
};

export type CloudBackend = ReturnType<typeof createCloudBackend>;

export const countGets = (requests: RequestLogEntry[], prefix: string): number =>
  requests.filter((r) => r.method === 'GET' && r.path.startsWith(prefix)).length;

/** Number of single-document GETs (i.e. excluding the collection listing). */
export const mapDetailGets = (backend: CloudBackend): number =>
  countGets(backend.requests, `${backend.mapsPath}/`);

export const writesTo = (backend: CloudBackend, mapId: string): RequestLogEntry[] =>
  backend.requests.filter((r) => r.method === 'PUT' && r.path === `${backend.mapsPath}/${encodeURIComponent(mapId)}`);
