import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerItem, StorageAdapter } from '@core/types';
import type { MindMapData } from '@shared/types';
import { statusMessages } from '@shared/utils';
import { CloudStorageAdapter, CLOUD_AUTH_EXPIRED_EVENT } from '@core/storage/adapters/CloudStorageAdapter';
import { BASE_URL, createCloudBackend, mapDetailGets, type CloudBackend } from '../../../../test/cloudBackendMock';
import { REMOTE_BACKGROUND_REFRESH_MS, useMindMapPersistence } from './useMindMapPersistence';

/**
 * The hook builds its own AdapterManager; this stand-in serves a local
 * adapter and a real CloudStorageAdapter talking to the in-memory backend, so
 * the tests count the HTTP requests a refresh really makes.
 */
const managerState = vi.hoisted(() => ({
  local: null as unknown,
  cloud: null as unknown,
  current: null as string | null,
}));

vi.mock('@core/storage/AdapterManager', () => {
  class FakeAdapterManager {
    async initialize(): Promise<void> {}
    cleanup(): void {}
    setCurrentWorkspace(id: string | null): void { managerState.current = id; }
    getCurrentWorkspaceId(): string | null { return managerState.current; }
    getAdapterForWorkspace(id: string | null): unknown {
      if (!id) return managerState.local;
      return id === 'cloud' ? managerState.cloud : null;
    }
    getCurrentAdapter(): unknown { return this.getAdapterForWorkspace(managerState.current); }
    async getAvailableWorkspaces(): Promise<unknown[]> {
      const workspaces: unknown[] = [{ id: 'ws-local', name: 'Local', type: 'local', adapter: managerState.local }];
      const cloud = managerState.cloud;
      if (cloud instanceof Object && 'isAuthenticated' in cloud && cloud.isAuthenticated) {
        workspaces.push({ id: 'cloud', name: 'Cloud', type: 'cloud', adapter: cloud });
      }
      return workspaces;
    }
    setCloudAdapter(): void {}
    setGroupAdapter(): void {}
    removeCloudAdapter(): void {}
    removeGroupAdapter(): void {}
  }
  return { AdapterManager: FakeAdapterManager };
});

const localMap = (mapId: string): MindMapData => ({
  title: mapId,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mapIdentifier: { mapId, workspaceId: 'ws-local' },
  rootNodes: [],
  settings: { autoSave: true, autoLayout: true, showGrid: false, animationEnabled: true },
});

const createLocalAdapter = () => {
  const tree: ExplorerItem = { type: 'folder', name: 'Local', path: '/ws-local', children: [] };
  const adapter = {
    isInitialized: true,
    initialize: vi.fn(async () => {}),
    cleanup: vi.fn(),
    loadAllMaps: vi.fn(async () => [localMap('Local note')]),
    addMapToList: vi.fn(async () => {}),
    removeMapFromList: vi.fn(async () => {}),
    getExplorerTree: vi.fn(async () => tree),
  };
  const asAdapter: StorageAdapter = adapter;
  return { adapter, asAdapter };
};

const mapListGets = (backend: CloudBackend): number =>
  backend.requests.filter((r) => r.method === 'GET' && r.path === backend.mapsPath).length;

const cloudRequests = (backend: CloudBackend) =>
  backend.requests.filter((r) => !r.path.startsWith('/api/auth/'));

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

describe('useMindMapPersistence map list refresh', () => {
  let backend: CloudBackend;
  let local: ReturnType<typeof createLocalAdapter>;
  let cloud: CloudStorageAdapter;
  let renders: number;

  const renderPersistence = async () => {
    renders = 0;
    const hook = renderHook(() => {
      renders++;
      return useMindMapPersistence({ mode: 'local+cloud' });
    });
    await waitFor(() => expect(hook.result.current.isInitialized).toBe(true));
    // Let the initial (local) refresh settle.
    await waitFor(() => expect(hook.result.current.allMindMaps).toHaveLength(1));
    return hook;
  };

  /** Open the cloud workspace and wait for its list. */
  const openCloud = async (hook: Awaited<ReturnType<typeof renderPersistence>>) => {
    await act(async () => {
      await hook.result.current.switchWorkspace('cloud');
    });
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    localStorage.clear();
    setHidden(false);
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
    for (let i = 0; i < 12; i++) backend.seed(`Map${i}`, `# Map ${i}\n`, '2026-01-01T00:00:00.000Z');
    backend.images.push('Map0.md', 'Folder/Map1.md');

    local = createLocalAdapter();
    cloud = new CloudStorageAdapter(BASE_URL);
    await cloud.login('a@b.c', 'pw');
    managerState.local = local.asAdapter;
    managerState.cloud = cloud;
    managerState.current = null;
    backend.requests.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setHidden(false);
  });

  it('opens a cloud workspace of 12 maps with one list request and no document downloads', async () => {
    const hook = await renderPersistence();
    backend.requests.length = 0;

    await openCloud(hook);

    expect(hook.result.current.allMindMaps.map((m) => m.mapIdentifier.mapId)).toHaveLength(12);
    expect(mapListGets(backend)).toBe(1);
    expect(mapDetailGets(backend)).toBe(0);
    // The explorer tree came from its own single listing.
    expect(cloudRequests(backend)).toHaveLength(2);
    const cloudTree = hook.result.current.explorerTree?.children?.find((c) => c.path === '/cloud');
    expect(cloudTree?.children?.map((c) => c.name)).toEqual(['Folder', 'Map0.md']);
  });

  it('makes no request at all for a poll while the tab is hidden', async () => {
    const hook = await renderPersistence();
    await openCloud(hook);
    backend.requests.length = 0;
    local.adapter.loadAllMaps.mockClear();
    local.adapter.getExplorerTree.mockClear();
    vi.setSystemTime(Date.now() + REMOTE_BACKGROUND_REFRESH_MS + 1);

    setHidden(true);
    await act(async () => {
      await hook.result.current.refreshMapList({ background: true });
    });

    expect(backend.requests).toHaveLength(0);
    expect(local.adapter.getExplorerTree).not.toHaveBeenCalled();
  });

  it('does not re-render when a poll finds nothing changed', async () => {
    const hook = await renderPersistence();
    await openCloud(hook);
    const before = hook.result.current.allMindMaps;
    const treeBefore = hook.result.current.explorerTree;
    const rendersBefore = renders;

    await act(async () => {
      await hook.result.current.refreshMapList();
    });

    expect(mapListGets(backend)).toBe(2); // it did ask the server...
    expect(renders).toBe(rendersBefore); // ...and handed React nothing new
    expect(hook.result.current.allMindMaps).toBe(before);
    expect(hook.result.current.explorerTree).toBe(treeBefore);
  });

  it('polls the backend at most once per interval in the background', async () => {
    const hook = await renderPersistence();
    await openCloud(hook);
    backend.requests.length = 0;

    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(Date.now() + 7000);
      await act(async () => {
        await hook.result.current.refreshMapList({ background: true });
      });
    }
    // 28s of 7s polls: still inside the window, so nothing reached the backend.
    expect(cloudRequests(backend)).toHaveLength(0);
    // The local folder is still re-read on every poll (external edits).
    expect(local.adapter.getExplorerTree.mock.calls.length).toBeGreaterThanOrEqual(4);

    vi.setSystemTime(Date.now() + 7000);
    await act(async () => {
      await hook.result.current.refreshMapList({ background: true });
    });
    expect(mapListGets(backend)).toBe(1);
  });

  it('shares one refresh between overlapping callers, plus one follow-up for callers after a change', async () => {
    const hook = await renderPersistence();
    await openCloud(hook);
    backend.requests.length = 0;

    await act(async () => {
      await Promise.all([
        hook.result.current.refreshMapList(),
        hook.result.current.refreshMapList(),
        hook.result.current.refreshMapList(),
        hook.result.current.refreshMapList({ background: true }),
      ]);
    });

    expect(mapListGets(backend)).toBe(2);
  });

  it('keeps the shown list and tree when the backend fails, and says so once', async () => {
    const errors = vi.spyOn(statusMessages, 'customError');
    const infos = vi.spyOn(statusMessages, 'customInfo');
    const hook = await renderPersistence();
    await openCloud(hook);
    const listBefore = hook.result.current.allMindMaps;
    const treeBefore = hook.result.current.explorerTree;

    backend.setOutage(503);
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await hook.result.current.refreshMapList();
      });
    }

    expect(hook.result.current.allMindMaps).toBe(listBefore);
    expect(hook.result.current.allMindMaps).toHaveLength(12);
    expect(hook.result.current.explorerTree).toBe(treeBefore);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0][0]).toContain('Cloud');

    backend.setOutage(null);
    backend.seed('Map12', '# Map 12\n', '2026-02-01T00:00:00.000Z');
    await act(async () => {
      await hook.result.current.refreshMapList();
    });
    expect(hook.result.current.allMindMaps).toHaveLength(13);
    expect(infos).toHaveBeenCalledTimes(1);
  });

  it('leaves a workspace whose session ended without reporting a refresh failure', async () => {
    const errors = vi.spyOn(statusMessages, 'customError');
    const hook = await renderPersistence();
    await openCloud(hook);

    backend.setOutage(401);
    await act(async () => {
      await hook.result.current.refreshMapList();
    });
    await waitFor(() => expect(hook.result.current.currentWorkspaceId).toBeNull());

    expect(cloud.isAuthenticated).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    expect(managerState.current).toBeNull();
  });

  it('switches away when the active workspace announces its session ended', async () => {
    const hook = await renderPersistence();
    await openCloud(hook);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CLOUD_AUTH_EXPIRED_EVENT, { detail: { workspaceId: 'cloud', reason: 'expired' } }));
    });

    await waitFor(() => expect(hook.result.current.currentWorkspaceId).toBeNull());
  });
});
