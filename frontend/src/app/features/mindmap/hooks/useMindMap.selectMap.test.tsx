import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerItem, StorageAdapter } from '@core/types';
import { NotificationProvider, StatusBarProvider } from '@shared/hooks';
import { CloudStorageAdapter } from '@core/storage/adapters/CloudStorageAdapter';
import { BASE_URL, createCloudBackend, mapBodyGets, mapDetailGets, type CloudBackend } from '../../../../test/cloudBackendMock';
import { useMindMap } from './useMindMap';

/** Stand-in AdapterManager: a local adapter and a real CloudStorageAdapter on the in-memory backend. */
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
      return [
        { id: 'ws-local', name: 'Local', type: 'local', adapter: managerState.local },
        { id: 'cloud', name: 'Cloud', type: 'cloud', adapter: managerState.cloud },
      ];
    }
    setCloudAdapter(): void {}
    setGroupAdapter(): void {}
    removeCloudAdapter(): void {}
    removeGroupAdapter(): void {}
  }
  return { AdapterManager: FakeAdapterManager };
});

const createLocalAdapter = (): StorageAdapter => {
  const tree: ExplorerItem = { type: 'folder', name: 'Local', path: '/ws-local', children: [] };
  return {
    isInitialized: true,
    initialize: async () => {},
    cleanup: () => {},
    loadAllMaps: async () => [],
    addMapToList: async () => {},
    removeMapFromList: async () => {},
    getExplorerTree: async () => tree,
  };
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StatusBarProvider><NotificationProvider>{children}</NotificationProvider></StatusBarProvider>
);

describe('useMindMap opening a cloud map', () => {
  let backend: CloudBackend;
  /** While set, list requests wait for it: the map must open without the list. */
  let listGate: Promise<void> | null;
  let releaseList: () => void;

  const holdListRequests = (): void => {
    listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  };

  beforeEach(async () => {
    localStorage.clear();
    backend = createCloudBackend();
    listGate = null;
    releaseList = () => {};
    for (let i = 0; i < 12; i++) backend.seed(`Map${i}`, `# Map ${i}\n- child ${i}\n`, '2026-01-01T00:00:00.000Z');

    // Optionally hold the list response back, to show the map does not wait for it.
    const fetchWithGate = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const path = String(input).slice(BASE_URL.length);
      if (path === '/api/maps' && listGate) await listGate;
      return backend.fetchMock(input, init);
    });
    vi.stubGlobal('fetch', fetchWithGate);

    const cloud = new CloudStorageAdapter(BASE_URL);
    await cloud.login('a@b.c', 'pw');
    managerState.local = createLocalAdapter();
    managerState.cloud = cloud;
    managerState.current = null;
  });

  afterEach(() => {
    releaseList();
    vi.unstubAllGlobals();
  });

  const renderMindMap = async () => {
    const hook = renderHook(() => useMindMap({ mode: 'local+cloud' }), { wrapper });
    await waitFor(() => expect(hook.result.current.isReady).toBe(true));
    return hook;
  };

  it('opens the clicked map with one document request, without waiting for the map list', async () => {
    const hook = await renderMindMap();
    holdListRequests();
    backend.requests.length = 0;

    let opened = false;
    await act(async () => {
      opened = await hook.result.current.selectMapById({ mapId: 'Map3', workspaceId: 'cloud' });
    });

    expect(opened).toBe(true);
    expect(hook.result.current.data?.mapIdentifier.mapId).toBe('Map3');
    // The list request is still being held back...
    expect(backend.requests.some((r) => r.path === '/api/maps')).toBe(false);
    // ...and the map cost exactly one request: its document.
    expect(mapDetailGets(backend)).toBe(1);
    expect(mapBodyGets(backend)).toBe(1);

    await act(async () => {
      listGate = null;
      releaseList();
    });
    await waitFor(() => expect(hook.result.current.allMindMaps).toHaveLength(12));
    // Listing the workspace downloaded no other document.
    expect(mapDetailGets(backend)).toBe(1);
  });

  it('never opens a listed map as an empty tree', async () => {
    const hook = await renderMindMap();
    await act(async () => {
      await hook.result.current.switchWorkspace?.('cloud');
    });
    expect(hook.result.current.allMindMaps).toHaveLength(12);

    await act(async () => {
      await hook.result.current.selectMapById({ mapId: 'Map5', workspaceId: 'cloud' });
    });

    const root = hook.result.current.data?.rootNodes[0];
    expect(root?.text).toBe('Map 5');
    expect(root?.children?.[0]?.text).toBe('child 5');
  });
});
