import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudStorageAdapter, CloudMapDestinationExistsError } from './CloudStorageAdapter';
import { DEFAULT_MAP_FRESHNESS_MS } from './CloudMapCache';
import { MAP_CONFLICT_EVENT, type MapConflictDetail } from '../../types/storage.types';
import { clearCloudImageCache } from '../../../features/markdown/hooks/cloudImageCache';
import { MarkdownImporter } from '../../../features/markdown/markdownImporter';
import { MapOperationsService } from '../../../features/mindmap/services/MapOperationsService';
import {
  BASE_URL,
  createCloudBackend,
  countGets,
  mapBodyGets,
  mapDetailGets,
  mapMetaGets,
  writesTo,
  type CloudBackend,
} from '../../../../test/cloudBackendMock';

const createAuthenticatedAdapter = async (backend: CloudBackend): Promise<CloudStorageAdapter> => {
  const adapter = new CloudStorageAdapter(BASE_URL);
  await adapter.login('a@b.c', 'pw');
  backend.requests.length = 0;
  return adapter;
};

/** Let the document cache's freshness window lapse, as the seconds between two polls do. */
const advancePastFreshness = (): void => {
  vi.setSystemTime(Date.now() + DEFAULT_MAP_FRESHNESS_MS + 1);
};

const mapListGets = (backend: CloudBackend): number =>
  backend.requests.filter((r) => r.method === 'GET' && r.path === backend.mapsPath).length;

describe('CloudStorageAdapter request behaviour', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    // Freeze the clock: the document cache's freshness window then only lapses
    // where a test says so, the way seconds pass between two polls.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('downloads each map once on the first list load', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Notes/Beta', '# Beta\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    const maps = await adapter.loadAllMaps();

    expect(maps.map((m) => m.mapIdentifier.mapId).sort((a, b) => a.localeCompare(b))).toEqual(['Alpha', 'Notes/Beta']);
    expect(countGets(backend.requests, '/api/maps')).toBe(3); // 1 list + 2 documents
  });

  it('does not re-download unchanged maps on a subsequent refresh', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Notes/Beta', '# Beta\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.loadAllMaps();
    backend.requests.length = 0;
    const maps = await adapter.loadAllMaps();

    expect(maps).toHaveLength(2);
    expect(mapDetailGets(backend)).toBe(0);
    expect(countGets(backend.requests, '/api/maps')).toBe(1); // the list only
  });

  it('re-downloads only the map the server reports as changed', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Notes/Beta', '# Beta\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.loadAllMaps();
    backend.seed('Notes/Beta', '# Beta edited\n', '2026-03-03T00:00:00.000Z');
    backend.requests.length = 0;

    const maps = await adapter.loadAllMaps();

    expect(mapDetailGets(backend)).toBe(1);
    expect(backend.requests.some((r) => r.path.includes('Beta'))).toBe(true);
    expect(maps.find((m) => m.mapIdentifier.mapId === 'Notes/Beta')?.title).toBe('Beta edited');
  });

  it('reads the whole document when probing a map it has no copy of', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };

    const lastModified = await adapter.getMapLastModified?.(id);
    const markdown = await adapter.getMapMarkdown?.(id);

    expect(lastModified).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(markdown).toBe('# Alpha\n');
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('collapses the fan-out of readers that open the same map at once', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };

    const results = await Promise.all([
      adapter.getMapMarkdown?.(id),
      adapter.getMapMarkdown?.(id),
      adapter.getMapMarkdown?.(id),
    ]);

    expect(results).toEqual(['# Alpha\n', '# Alpha\n', '# Alpha\n']);
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('still revalidates on every freshness probe so remote edits are noticed', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };

    await adapter.getMapLastModified?.(id);
    backend.seed('Alpha', '# Alpha remote\n', '2026-04-04T00:00:00.000Z');
    advancePastFreshness();
    const second = await adapter.getMapLastModified?.(id);

    // The first probe had nothing cached and read the document; the second
    // had a copy to compare against and only asked for the timestamp.
    expect(mapBodyGets(backend)).toBe(1);
    expect(mapMetaGets(backend)).toBe(1);
    expect(second).toBe(Date.parse('2026-04-04T00:00:00.000Z'));

    // The probe saw a newer version, so the stale body must not be served.
    expect(await adapter.getMapMarkdown?.(id)).toBe('# Alpha remote\n');
    expect(mapBodyGets(backend)).toBe(2);
  });

  it('serves the content it just saved without reading it back', async () => {
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };

    await adapter.saveMapMarkdown?.(id, '# Alpha saved\n');
    backend.requests.length = 0;

    expect(await adapter.getMapMarkdown?.(id)).toBe('# Alpha saved\n');
    expect(mapDetailGets(backend)).toBe(0);

    // ...and the list refresh that follows a save does not re-download it.
    await adapter.loadAllMaps();
    expect(mapDetailGets(backend)).toBe(0);
  });

  it('re-reads from the server when a save fails', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };
    await adapter.getMapMarkdown?.(id);

    backend.fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({ error: 'Map has been modified by another user' }),
    }) as unknown as Response);

    await expect(adapter.saveMapMarkdown?.(id, '# Alpha local\n')).rejects.toThrow();
    backend.requests.length = 0;

    expect(await adapter.getMapMarkdown?.(id)).toBe('# Alpha\n');
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('forgets a deleted map so a map recreated under the same id is re-read', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.loadAllMaps();
    await adapter.deleteItem?.('/cloud/Alpha.md');
    backend.seed('Alpha', '# Alpha again\n', '2026-05-05T00:00:00.000Z');
    backend.requests.length = 0;

    const maps = await adapter.loadAllMaps();
    expect(mapDetailGets(backend)).toBe(1);
    expect(maps[0].title).toBe('Alpha again');
  });

  it('renames a map without an extra read of the source document', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    backend.requests.length = 0;

    await adapter.renameItem?.('/cloud/Alpha.md', 'Renamed');

    expect(mapDetailGets(backend)).toBe(0);
    expect(backend.maps.get('Renamed')?.content).toBe('# Alpha\n');
    expect(backend.maps.has('Alpha')).toBe(false);
    // The renamed document is cached from the write response.
    expect(await adapter.getMapMarkdown?.({ mapId: 'Renamed', workspaceId: 'cloud' })).toBe('# Alpha\n');
    expect(mapDetailGets(backend)).toBe(0);
  });

  it('issues one object listing when the explorer tree is rebuilt concurrently', async () => {
    backend.images.push('Alpha.md', 'assets/logo.png');
    const adapter = await createAuthenticatedAdapter(backend);

    await Promise.all([adapter.getExplorerTree?.(), adapter.getExplorerTree?.()]);

    expect(countGets(backend.requests, '/api/images/list')).toBe(1);
  });

  it('shares a single list request between concurrent list consumers', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await Promise.all([adapter.loadAllMaps(), adapter.listMapIdentifiers?.()]);

    expect(backend.requests.filter((r) => r.method === 'GET' && r.path === '/api/maps')).toHaveLength(1);
  });

  it('drops cached documents on logout so another user never sees them', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });

    await adapter.logout();
    await adapter.login('other@b.c', 'pw');
    backend.requests.length = 0;

    expect(await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' })).toBe('# Alpha\n');
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('makes no requests at all when signed out', async () => {
    const adapter = new CloudStorageAdapter(BASE_URL);

    expect(await adapter.loadAllMaps()).toEqual([]);
    expect(await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' })).toBeNull();
    expect(await adapter.getMapLastModified?.({ mapId: 'Alpha', workspaceId: 'cloud' })).toBeNull();
    expect(backend.requests).toHaveLength(0);
  });
});

describe('CloudStorageAdapter listing freshness', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    // Freeze the clock: the document cache's freshness window then only lapses
    // where a test says so, the way seconds pass between two polls.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not let a refresh after a delete join the listing that preceded it', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Beta', '# Beta\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    // A listing is already running when the user deletes a map.
    const inFlight = adapter.loadAllMaps();
    await adapter.deleteItem?.('/cloud/Beta.md');
    const afterDelete = await adapter.loadAllMaps();
    await inFlight;

    expect(afterDelete.map((m) => m.mapIdentifier.mapId)).toEqual(['Alpha']);
  });

  it('does not let an explorer refresh after an upload join the listing that preceded it', async () => {
    const adapter = await createAuthenticatedAdapter(backend);
    backend.images.push('Alpha.md');

    const inFlight = adapter.getExplorerTree?.();
    backend.images.push('assets/logo.png');
    await adapter.saveImageFile?.('assets/logo.png', new File(['x'], 'logo.png', { type: 'image/png' }), 'cloud');
    const tree = await adapter.getExplorerTree?.();
    await inFlight;

    expect(tree?.children?.some((child) => child.name === 'assets')).toBe(true);
  });

  it('does not serve the previous account a pending listing after sign-out', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    const inFlight = adapter.loadAllMaps();
    await adapter.logout();
    backend.maps.clear();
    backend.seed('OtherUserMap', '# Other\n', '2026-02-02T00:00:00.000Z');
    await adapter.login('other@b.c', 'pw');
    await inFlight;

    const maps = await adapter.loadAllMaps();
    expect(maps.map((m) => m.mapIdentifier.mapId)).toEqual(['OtherUserMap']);
  });
});

describe('CloudStorageAdapter session restore', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    // Freeze the clock: the document cache's freshness window then only lapses
    // where a test says so, the way seconds pass between two polls.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * Sign in once so a token and user are persisted, then start a fresh adapter
   * and wait for its background check of the stored session to be applied.
   */
  const restoreAdapter = async (): Promise<CloudStorageAdapter> => {
    const first = new CloudStorageAdapter(BASE_URL);
    await first.login('a@b.c', 'pw');

    const restored = new CloudStorageAdapter(BASE_URL);
    await restored.initialize();
    await restored.waitForAuthVerification();
    return restored;
  };

  it('restores the stored session when the server confirms it', async () => {
    const adapter = await restoreAdapter();
    expect(adapter.isAuthenticated).toBe(true);
  });

  it('keeps the session when the backend is unreachable rather than signing out', async () => {
    backend.failAuthMe({ status: 503, body: { success: false, error: 'Storage quota exceeded' } });

    const adapter = await restoreAdapter();

    // A 5xx says nothing about these credentials; discarding them would force a
    // fresh login once the backend recovers.
    expect(adapter.isAuthenticated).toBe(true);
  });

  it('recovers without a re-login once the backend comes back', async () => {
    backend.failAuthMe({ status: 503 });
    await restoreAdapter();
    backend.failAuthMe(null);

    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.initialize();

    expect(adapter.isAuthenticated).toBe(true);
    expect((await adapter.loadAllMaps()).map((m) => m.mapIdentifier.mapId)).toEqual(['Alpha']);
  });

  it('signs out when the server rejects the stored token', async () => {
    backend.failAuthMe({ status: 401, body: { success: false, error: 'Unauthorized' } });

    const adapter = await restoreAdapter();

    expect(adapter.isAuthenticated).toBe(false);
  });

  it('signs out when the server answers that the session is not valid', async () => {
    backend.failAuthMe({ status: 200, body: { success: false } });

    const adapter = await restoreAdapter();

    expect(adapter.isAuthenticated).toBe(false);
  });
});

describe('CloudStorageAdapter freshness probes', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    // Freeze the clock: the document cache's freshness window then only lapses
    // where a test says so, the way seconds pass between two polls.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks only for metadata, never the document body', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.loadAllMaps();
    backend.requests.length = 0;

    // What the poll loop does while a map is open, a few seconds apart.
    for (let i = 0; i < 10; i++) {
      advancePastFreshness();
      await adapter.getMapLastModified?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    }

    expect(mapMetaGets(backend)).toBe(10);
    expect(mapBodyGets(backend)).toBe(0);
  });

  it('reports the same timestamp the full read reports', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.loadAllMaps();

    const probed = await adapter.getMapLastModified?.({ mapId: 'Alpha', workspaceId: 'cloud' });

    expect(probed).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
  });

  it('does not re-download a map the probe confirms is unchanged', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.loadAllMaps();
    backend.requests.length = 0;
    advancePastFreshness();

    await adapter.getMapLastModified?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    const markdown = await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });

    expect(markdown).toBe('# Alpha\n');
    expect(mapBodyGets(backend)).toBe(0);
  });

  it('serves the new content after the probe reports a change', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.loadAllMaps();

    // Someone else edits the map.
    backend.seed('Alpha', '# Alpha edited elsewhere\n', '2026-02-02T00:00:00.000Z');
    backend.requests.length = 0;
    advancePastFreshness();

    await adapter.getMapLastModified?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    const markdown = await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });

    // The stale cached body must not survive the probe.
    expect(markdown).toBe('# Alpha edited elsewhere\n');
    expect(mapBodyGets(backend)).toBe(1);
  });

  it('returns null for a map that no longer exists', async () => {
    const adapter = await createAuthenticatedAdapter(backend);

    const probed = await adapter.getMapLastModified?.({ mapId: 'Gone', workspaceId: 'cloud' });

    expect(probed).toBeNull();
  });
});

describe('CloudStorageAdapter document round-trip', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    // Freeze the clock: the document cache's freshness window then only lapses
    // where a test says so, the way seconds pass between two polls.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const NESTED_ID = 'プロジェクト/設計メモ';

  /** What opening a map produces: parse the stored document into a MindMapData. */
  const openedMap = (mapId: string, markdown: string) =>
    MapOperationsService.createMapData(
      mapId,
      'cloud',
      MarkdownImporter.parseMarkdownToNodes(markdown).rootNodes,
      '2026-01-01T00:00:00.000Z'
    );

  const written = (mapId: string): string | undefined =>
    backend.maps.get(mapId)?.content;

  it('never writes the map path into the document as a heading', async () => {
    const source = '# 設計メモ\n- 項目A\n';
    backend.seed(NESTED_ID, source, '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    // MindMapData.title falls back to the mapId, so a nested map carries its
    // own path as the title. That must not reach the document.
    const map = openedMap(NESTED_ID, source);
    expect(map.title).toBe(NESTED_ID);

    await adapter.addMapToList(map);

    expect(written(NESTED_ID)).not.toContain(NESTED_ID);
    expect(written(NESTED_ID)).toBe(source);
  });

  it('leaves the document unchanged when the same map is stored repeatedly', async () => {
    const source = '# 設計メモ\n- 項目A\n';
    backend.seed(NESTED_ID, source, '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    // The corruption used to compound: one extra heading line per round trip.
    for (let i = 0; i < 3; i++) {
      const current = await adapter.getMapMarkdown?.({ mapId: NESTED_ID, workspaceId: 'cloud' });
      await adapter.addMapToList(openedMap(NESTED_ID, current || ''));
    }

    expect(written(NESTED_ID)).toBe(source);
  });

  it('titles the map by its heading, not by its path', async () => {
    const source = '# 設計メモ\n- 項目A\n';
    backend.seed(NESTED_ID, source, '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.addMapToList(openedMap(NESTED_ID, source));

    expect(backend.maps.get(NESTED_ID)?.title).toBe('設計メモ');
    const listed = await adapter.loadAllMaps();
    expect(listed.find((m) => m.mapIdentifier.mapId === NESTED_ID)?.title).toBe('設計メモ');
  });

  it('preserves a document that has no heading of its own', async () => {
    const source = '- 項目A\n- 項目B\n';
    backend.seed(NESTED_ID, source, '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.addMapToList(openedMap(NESTED_ID, source));

    expect(written(NESTED_ID)).toBe(source);
  });
});

describe('CloudStorageAdapter map listing', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const seedMany = (count: number): void => {
    for (let i = 0; i < count; i++) {
      backend.seed(`Map${i}`, `# Map ${i}\n`, `2026-01-0${(i % 9) + 1}T00:00:00.000Z`);
    }
  };

  it('lists a workspace of N maps with one request and no document downloads', async () => {
    seedMany(8);
    const adapter = await createAuthenticatedAdapter(backend);

    const summaries = await adapter.listMapSummaries();

    expect(summaries).toHaveLength(8);
    expect(summaries[0]).toMatchObject({
      mapIdentifier: { mapId: 'Map0', workspaceId: 'cloud' },
      title: 'Map 0',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mapListGets(backend)).toBe(1);
    expect(mapDetailGets(backend)).toBe(0);
  });

  it('opens one map with exactly one document request', async () => {
    seedMany(8);
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.listMapSummaries();
    backend.requests.length = 0;

    // What selectMapById asks for: the document, then its timestamp.
    const id = { mapId: 'Map3', workspaceId: 'cloud' };
    const markdown = await adapter.getMapMarkdown?.(id);
    const lastModified = await adapter.getMapLastModified?.(id);

    expect(markdown).toBe('# Map 3\n');
    expect(lastModified).toBe(Date.parse('2026-01-04T00:00:00.000Z'));
    expect(backend.requests).toHaveLength(1);
    expect(mapBodyGets(backend)).toBe(1);
  });

  it('reports a failed listing as a failure, not as an empty workspace', async () => {
    seedMany(2);
    const adapter = await createAuthenticatedAdapter(backend);
    backend.setOutage(503);

    await expect(adapter.listMapSummaries()).rejects.toMatchObject({ status: 503 });
    await expect(adapter.getExplorerTree?.()).rejects.toMatchObject({ status: 503 });
    await expect(adapter.loadAllMaps()).rejects.toMatchObject({ status: 503 });
    await expect(adapter.listMapIdentifiers?.()).rejects.toMatchObject({ status: 503 });
  });

  it('drops a cached document that the listing shows was edited elsewhere', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };
    await adapter.getMapMarkdown?.(id);

    backend.seed('Alpha', '# Alpha remote\n', '2026-02-02T00:00:00.000Z');
    await adapter.listMapSummaries();

    expect(await adapter.getMapMarkdown?.(id)).toBe('# Alpha remote\n');
  });

  it('keeps the copy it just saved when an older listing finishes afterwards', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    const id = { mapId: 'Alpha', workspaceId: 'cloud' };
    await adapter.getMapMarkdown?.(id);

    const listing = adapter.listMapSummaries(); // started before the save
    await adapter.saveMapMarkdown?.(id, '# Alpha saved\n');
    await listing;
    backend.requests.length = 0;

    expect(await adapter.getMapMarkdown?.(id)).toBe('# Alpha saved\n');
    expect(mapDetailGets(backend)).toBe(0);
  });

  it('serves search a second time without downloading unchanged documents', async () => {
    seedMany(5);
    const adapter = await createAuthenticatedAdapter(backend);

    const first = await adapter.loadMapDocuments();
    expect(first.map((d) => d.markdown)).toContain('# Map 2\n');
    expect(mapBodyGets(backend)).toBe(5);

    backend.requests.length = 0;
    advancePastFreshness();
    await adapter.loadMapDocuments();

    expect(mapListGets(backend)).toBe(1);
    expect(mapDetailGets(backend)).toBe(0);
  });
});

describe('CloudStorageAdapter personal conflict detection', () => {
  let backend: CloudBackend;
  const ID = { mapId: 'Alpha', workspaceId: 'cloud' };

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const collectConflicts = (): { conflicts: MapConflictDetail[]; stop: () => void } => {
    const conflicts: MapConflictDetail[] = [];
    const onConflict = (event: Event) => {
      if (event instanceof CustomEvent) conflicts.push(event.detail);
    };
    window.addEventListener(MAP_CONFLICT_EVENT, onConflict);
    return { conflicts, stop: () => window.removeEventListener(MAP_CONFLICT_EVENT, onConflict) };
  };

  it('sends the version it opened as the optimistic lock', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.getMapMarkdown?.(ID);
    await adapter.saveMapMarkdown?.(ID, '# Alpha edited\n');

    const [write] = writesTo(backend, 'Alpha');
    expect((write.body as { expectedUpdatedAt?: string }).expectedUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refuses to overwrite an edit made in another tab and tells the UI', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.(ID);
    backend.seed('Alpha', '# Alpha from another tab\n', '2026-03-03T00:00:00.000Z');

    const { conflicts, stop } = collectConflicts();
    try {
      await expect(adapter.saveMapMarkdown?.(ID, '# my edit\n')).rejects.toMatchObject({ status: 409 });
    } finally {
      stop();
    }

    expect(backend.maps.get('Alpha')?.content).toBe('# Alpha from another tab\n');
    expect(conflicts).toEqual([
      { mapIdentifier: { mapId: 'Alpha', workspaceId: 'cloud' }, currentUpdatedAt: '2026-03-03T00:00:00.000Z' },
    ]);
  });

  it('does not let a background read of a newer version unlock an overwrite', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.(ID); // the editor is based on this version

    backend.seed('Alpha', '# Alpha from another tab\n', '2026-03-03T00:00:00.000Z');
    // A search and a freshness probe both see the newer version...
    await adapter.loadMapDocuments();
    advancePastFreshness();
    await adapter.getMapLastModified?.(ID);

    // ...but the editor still holds the old one, so saving must conflict.
    const { stop } = collectConflicts();
    try {
      await expect(adapter.saveMapMarkdown?.(ID, '# my edit\n')).rejects.toMatchObject({ status: 409 });
    } finally {
      stop();
    }
    expect(backend.maps.get('Alpha')?.content).toBe('# Alpha from another tab\n');
  });
});

describe('CloudStorageAdapter rename and move', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const nonGetRequests = () => backend.requests.filter((r) => r.method !== 'GET');

  it('renames with a single server-side move', async () => {
    backend.seed('Notes/Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    await adapter.renameItem?.('/cloud/Notes/Alpha.md', 'Renamed');

    expect(nonGetRequests()).toEqual([
      { method: 'POST', path: '/api/maps/move', body: { fromId: 'Notes/Alpha', toId: 'Notes/Renamed' } },
    ]);
    expect(backend.requests).toHaveLength(1);
    expect(backend.maps.get('Notes/Renamed')?.content).toBe('# Alpha\n');
    expect(backend.maps.has('Notes/Alpha')).toBe(false);
  });

  it('refuses to rename onto an existing map and leaves both untouched', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    backend.seed('Beta', '# Beta\n', '2026-01-02T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);

    const attempt = adapter.renameItem?.('/cloud/Alpha.md', 'Beta');

    await expect(attempt).rejects.toBeInstanceOf(CloudMapDestinationExistsError);
    await expect(attempt).rejects.toThrow('Beta');
    expect(backend.maps.get('Alpha')?.content).toBe('# Alpha\n');
    expect(backend.maps.get('Beta')?.content).toBe('# Beta\n');
  });

  it('moves into a folder with one request and keeps the known document cached', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    backend.requests.length = 0;

    await adapter.moveItem?.('/cloud/Alpha.md', '/cloud/Archive');

    expect(nonGetRequests()).toEqual([
      {
        method: 'POST',
        path: '/api/maps/move',
        body: { fromId: 'Alpha', toId: 'Archive/Alpha', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
      },
    ]);
    advancePastFreshness();
    const moved = { mapId: 'Archive/Alpha', workspaceId: 'cloud' };
    expect(await adapter.getMapLastModified?.(moved)).toBe(Date.parse(backend.maps.get('Archive/Alpha')?.updatedAt ?? ''));
    expect(await adapter.getMapMarkdown?.(moved)).toBe('# Alpha\n');
    expect(mapBodyGets(backend)).toBe(0);

    // The lock follows the map to its new id.
    await adapter.saveMapMarkdown?.(moved, '# Alpha moved\n');
    expect(backend.maps.get('Archive/Alpha')?.content).toBe('# Alpha moved\n');
  });

  it('reports a conflict instead of moving a map that changed elsewhere', async () => {
    backend.seed('Alpha', '# Alpha\n', '2026-01-01T00:00:00.000Z');
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.getMapMarkdown?.({ mapId: 'Alpha', workspaceId: 'cloud' });
    backend.seed('Alpha', '# Alpha newer\n', '2026-02-02T00:00:00.000Z');

    await expect(adapter.moveItem?.('/cloud/Alpha.md', '/cloud/Archive')).rejects.toMatchObject({
      status: 409,
      currentUpdatedAt: '2026-02-02T00:00:00.000Z',
    });
    expect(backend.maps.has('Archive/Alpha')).toBe(false);
  });
});

describe('CloudStorageAdapter images', () => {
  let backend: CloudBackend;
  const PNG = new Uint8Array([137, 80, 78, 71, 0, 255]);

  beforeEach(() => {
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    localStorage.clear();
    clearCloudImageCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCloudImageCache();
  });

  it('downloads raw bytes once and serves later reads from memory', async () => {
    backend.seedImage('assets/logo.png', PNG);
    const adapter = await createAuthenticatedAdapter(backend);

    const first = await adapter.readImageAsDataURL?.('assets/logo.png', 'cloud');
    const second = await adapter.readImageAsDataURL?.('assets/logo.png', 'cloud');

    expect(first).toBe(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`);
    expect(second).toBe(first);
    expect(backend.requests.map((r) => r.path)).toEqual([`/api/images/${encodeURIComponent('assets/logo.png')}?raw=1`]);
  });

  it('ends the session when a raw image request is refused with 401', async () => {
    backend.seedImage('assets/logo.png', PNG);
    const adapter = await createAuthenticatedAdapter(backend);
    backend.setOutage(401);

    expect(await adapter.readImageAsDataURL?.('assets/logo.png', 'cloud')).toBeNull();
    expect(adapter.isAuthenticated).toBe(false);
  });

  it('reads an image as a File with its bytes and type', async () => {
    backend.seedImage('assets/photo.jpg', PNG, 'image/jpeg');
    const adapter = await createAuthenticatedAdapter(backend);

    const file = await adapter.readImageFile?.('assets/photo.jpg', 'cloud');

    expect(file?.name).toBe('photo.jpg');
    expect(file?.type).toBe('image/jpeg');
    // jsdom's File has no arrayBuffer(); its FileReader does read it.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file ?? new Blob());
    });
    expect(dataUrl).toBe(`data:image/jpeg;base64,${btoa(String.fromCharCode(...PNG))}`);
  });

  it('downloads an image again after it is replaced', async () => {
    backend.seedImage('assets/logo.png', PNG);
    const adapter = await createAuthenticatedAdapter(backend);
    await adapter.readImageAsDataURL?.('assets/logo.png', 'cloud');

    backend.seedImage('assets/logo.png', new Uint8Array([1, 2, 3]));
    await adapter.saveImageFile?.('assets/logo.png', new File(['x'], 'logo.png', { type: 'image/png' }), 'cloud');

    expect(await adapter.readImageAsDataURL?.('assets/logo.png', 'cloud')).toBe('data:image/png;base64,AQID');
  });
});
