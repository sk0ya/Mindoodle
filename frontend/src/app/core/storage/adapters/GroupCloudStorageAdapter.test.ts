import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupCloudStorageAdapter } from './CloudStorageAdapter';
import { STORAGE_KEYS } from '@shared/utils';
import {
  BASE_URL,
  createCloudBackend,
  countGets,
  mapDetailGets,
  writesTo,
  type CloudBackend,
} from '../../../../test/cloudBackendMock';

const ID = { mapId: 'Shared/Plan', workspaceId: 'group' };

const createAuthenticatedAdapter = async (backend: CloudBackend): Promise<GroupCloudStorageAdapter> => {
  const adapter = new GroupCloudStorageAdapter(BASE_URL);
  await adapter.login('a@b.c', 'pw');
  backend.requests.length = 0;
  return adapter;
};

describe('GroupCloudStorageAdapter', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('talks to the group endpoints and stores its own credentials', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.loadAllMaps();

    expect(backend.requests.every((r) => r.path.startsWith('/api/group/'))).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
  });

  it('gets the same request savings as the personal workspace', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Shared/Notes', '# Notes\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.loadAllMaps();
    backend.requests.length = 0;

    // A refresh with nothing changed: the listing only.
    await adapter.loadAllMaps();
    expect(mapDetailGets(backend)).toBe(0);

    // Opening a map: the freshness probe response is reused by the read.
    backend.requests.length = 0;
    await adapter.getMapLastModified?.(ID);
    await adapter.getMapMarkdown?.(ID);
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('polls for remote edits without downloading the document twice', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.(ID);

    // Another member saves.
    backend.seed('Shared/Plan', '# Plan v2\n', '2026-06-06T00:00:00.000Z');
    backend.requests.length = 0;

    const probed = await adapter.getMapLastModified?.(ID);
    expect(probed).toBe(Date.parse('2026-06-06T00:00:00.000Z'));
    expect(await adapter.getMapMarkdown?.(ID)).toBe('# Plan v2\n');
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('sends the version it last saw as the optimistic lock', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.getMapMarkdown?.(ID);
    await adapter.saveMapMarkdown?.(ID, '# Plan edited\n');

    const [first] = writesTo(backend, 'Shared/Plan');
    expect((first.body as { expectedUpdatedAt?: string }).expectedUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('advances the lock version from the write response, without re-reading', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.(ID);

    await adapter.saveMapMarkdown?.(ID, '# Plan v1\n');
    const versionAfterFirstSave = backend.maps.get('Shared/Plan')?.updatedAt;

    backend.requests.length = 0;
    await adapter.saveMapMarkdown?.(ID, '# Plan v2\n');

    const [second] = writesTo(backend, 'Shared/Plan');
    expect((second.body as { expectedUpdatedAt?: string }).expectedUpdatedAt).toBe(versionAfterFirstSave);
    expect(mapDetailGets(backend)).toBe(0);
    expect(backend.maps.get('Shared/Plan')?.content).toBe('# Plan v2\n');
  });

  it('reports a conflict and re-reads from the server when another member wins the race', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.(ID);

    const conflicts: Array<{ mapIdentifier?: { mapId: string }; currentUpdatedAt?: string }> = [];
    const onConflict = (event: Event) => conflicts.push((event as CustomEvent).detail);
    window.addEventListener('mindoodle:groupMapConflict', onConflict);

    try {
      // Another member saved in the meantime.
      backend.seed('Shared/Plan', '# Plan from someone else\n', '2026-07-07T00:00:00.000Z');

      await expect(adapter.saveMapMarkdown?.(ID, '# my local edit\n')).rejects.toThrow();

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].mapIdentifier?.mapId).toBe('Shared/Plan');
      expect(conflicts[0].currentUpdatedAt).toBe('2026-07-07T00:00:00.000Z');

      // The rejected save must not leave our stale copy cached: the next read
      // has to show what the other member actually stored.
      backend.requests.length = 0;
      expect(await adapter.getMapMarkdown?.(ID)).toBe('# Plan from someone else\n');
      expect(mapDetailGets(backend)).toBe(1);
    } finally {
      window.removeEventListener('mindoodle:groupMapConflict', onConflict);
    }
  });

  it('picks up a remote edit on the next list refresh', async () => {
    backend.seed('Shared/Plan', '# Plan\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.loadAllMaps();

    backend.seed('Shared/Plan', '# Plan v2\n', '2026-08-08T00:00:00.000Z');
    backend.requests.length = 0;

    const maps = await adapter.loadAllMaps();
    expect(mapDetailGets(backend)).toBe(1);
    expect(maps[0].title).toBe('Plan v2');
    expect(maps[0].updatedAt).toBe('2026-08-08T00:00:00.000Z');
  });

  it('issues one object listing for the group explorer tree', async () => {
    backend.images.push('Shared/Plan.md', 'Shared/assets/diagram.png');
    const adapter = await createAuthenticatedAdapter(backend);

    const [tree] = await Promise.all([adapter.getExplorerTree?.(), adapter.getExplorerTree?.()]);

    expect(countGets(backend.requests, '/api/group/images/list')).toBe(1);
    expect(tree?.path).toBe('/group');
  });
});
