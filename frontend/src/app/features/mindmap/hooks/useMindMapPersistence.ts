import { useEffect, useState, useRef } from 'react';
import { useStableCallback } from '@shared/hooks';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageConfig, ExplorerItem, MapSummary, StorageAdapter } from '@core/types';
import { AdapterManager, type WorkspaceInfo } from '@core/storage/AdapterManager';
import { CLOUD_AUTH_EXPIRED_EVENT } from '@core/storage/adapters/CloudStorageAdapter';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { logger, statusMessages } from '@shared/utils';
import {
  mergeSummariesIntoMapList,
  sameExplorerTree,
  sameMapList,
  sameWorkspaceList
} from '@mindmap/services/MapListService';

export interface RefreshMapListOptions {
  /**
   * A periodic poll rather than a user action. Skipped while the tab is
   * hidden, joins a refresh already in flight, and reaches a remote workspace
   * at most every REMOTE_BACKGROUND_REFRESH_MS.
   */
  background?: boolean;
}

/** Minimum gap between background refreshes that hit a remote workspace's backend. */
export const REMOTE_BACKGROUND_REFRESH_MS = 30_000;

interface RemoteWorkspaceState {
  /** The subtree shown last; kept when a later load fails. */
  tree: ExplorerItem | null;
  /** When this workspace was last asked for fresh data (attempts count, so an outage is not hammered). */
  lastFetchAt: number;
  /** Inside a failure streak that has already been reported. */
  failing: boolean;
}

interface RefreshPlan {
  shouldFetchRemote: (workspaceId: string) => boolean;
  failures: Map<string, unknown>;
  successes: Set<string>;
}

export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [adapterManager, setAdapterManager] = useState<AdapterManager | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explorerTree, setExplorerTree] = useState<ExplorerItem | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const refreshRequestRef = useRef(0);
  /** The state as last rendered, for refreshes that skip no-op updates. */
  const renderedRef = useRef({ allMindMaps, explorerTree, workspaces });
  renderedRef.current = { allMindMaps, explorerTree, workspaces };
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef<Promise<void> | null>(null);

  const prevConfigRef = useRef<StorageConfig | null>(null);


  useEffect(() => {
    const prevConfig = prevConfigRef?.current;
    const modeChanged = prevConfig?.mode !== config.mode;

    if (!prevConfig || modeChanged) {
      logger.debug(`(Re)initializing AdapterManager for mode: ${config.mode}`);

      setIsInitialized(false);
      setAllMindMaps([]);

      const initManager = async () => {
        try {
          setError(null);


          if (adapterManager && typeof adapterManager.cleanup === 'function') {
            logger.debug('Cleaning up previous AdapterManager');
            adapterManager.cleanup();
          }

          logger.debug(`Creating AdapterManager for ${config.mode} mode`);
          const manager = new AdapterManager(config);
          await manager.initialize();

          setAdapterManager(manager);
          setIsInitialized(true);
          logger.debug(`AdapterManager for ${config.mode} initialized successfully`);
        } catch (initError) {
          const errorMessage = initError instanceof Error ? initError.message : 'AdapterManager initialization failed';
          logger.error('AdapterManager initialization failed:', initError);
          setError(errorMessage);
          setIsInitialized(true); 
        }
      };

      initManager();
      prevConfigRef.current = config;
    }
  }, [adapterManager, config]);

  
  useEffect(() => {
    return () => {
      if (adapterManager) {
        logger.info('Cleaning up AdapterManager on unmount');
        adapterManager.cleanup();
      }
    };
  }, [adapterManager]);

  
  /** What the last refresh learned about one remote (cloud/group) workspace. */
  const remoteStateRef = useRef(new Map<string, RemoteWorkspaceState>());

  const getRemoteState = (workspaceId: string): RemoteWorkspaceState => {
    let state = remoteStateRef.current.get(workspaceId);
    if (!state) {
      state = { tree: null, lastFetchAt: 0, failing: false };
      remoteStateRef.current.set(workspaceId, state);
    }
    return state;
  };

  /**
   * Decide, once per refresh and workspace, whether to ask a remote workspace
   * for fresh data. Background refreshes (the poll) reuse what was fetched
   * recently: every open tab polls, and each poll that reaches the backend
   * costs requests against its daily quota.
   */
  const createRefreshPlan = (background: boolean): RefreshPlan => {
    const now = Date.now();
    const decisions = new Map<string, boolean>();
    return {
      shouldFetchRemote: (workspaceId: string): boolean => {
        const decided = decisions.get(workspaceId);
        if (decided !== undefined) return decided;
        const state = getRemoteState(workspaceId);
        const fetch = !background || now - state.lastFetchAt >= REMOTE_BACKGROUND_REFRESH_MS;
        if (fetch) state.lastFetchAt = now;
        decisions.set(workspaceId, fetch);
        return fetch;
      },
      failures: new Map<string, unknown>(),
      successes: new Set<string>()
    };
  };

  /**
   * Tell the user once per failure streak that a remote workspace is
   * unreachable, and once when it comes back. A refused session is not
   * reported here: it ends the session, and the login dialog explains that.
   */
  const reportRemoteOutcome = (plan: RefreshPlan, availableWorkspaces: WorkspaceInfo[]): void => {
    for (const [workspaceId, failure] of plan.failures) {
      const workspace = availableWorkspaces.find(ws => ws.id === workspaceId);
      const sessionEnded = !workspace ||
        ('isAuthenticated' in workspace.adapter && workspace.adapter.isAuthenticated === false);
      const status = failure instanceof Error && 'status' in failure ? failure.status : undefined;
      if (sessionEnded || status === 401) continue;

      const state = getRemoteState(workspaceId);
      if (!state.failing) {
        state.failing = true;
        statusMessages.customError(`「${workspace.name}」に接続できません。前回の内容を表示しています`);
      }
    }

    for (const workspaceId of plan.successes) {
      if (plan.failures.has(workspaceId)) continue;
      const state = getRemoteState(workspaceId);
      if (state.failing) {
        state.failing = false;
        const name = availableWorkspaces.find(ws => ws.id === workspaceId)?.name ?? workspaceId;
        statusMessages.customInfo(`「${name}」に再接続しました`);
      }
    }
  };

  /** Forget workspaces that are gone (signed out, session ended), so a later account never sees their tree. */
  const pruneRemoteState = (availableWorkspaces: WorkspaceInfo[]): void => {
    for (const workspaceId of Array.from(remoteStateRef.current.keys())) {
      if (!availableWorkspaces.some(ws => ws.id === workspaceId)) {
        remoteStateRef.current.delete(workspaceId);
      }
    }
  };

  /**
   * Build the combined explorer tree. Workspaces load in parallel; a remote
   * workspace that fails (or is not due for a background refresh) keeps the
   * subtree it showed last instead of disappearing.
   */
  const buildExplorerTree = async (availableWorkspaces: WorkspaceInfo[], plan: RefreshPlan): Promise<ExplorerItem> => {
    const localWorkspace = availableWorkspaces.find(ws => ws.type === 'local');
    const remoteWorkspaces = availableWorkspaces.filter(ws => ws.type === 'cloud' || ws.type === 'group');

    const localChildren = (async (): Promise<ExplorerItem[]> => {
      const localAdapter = localWorkspace?.adapter;
      if (!localAdapter || typeof localAdapter.getExplorerTree !== 'function') return [];
      try {
        const localTree = await localAdapter.getExplorerTree();
        return localTree.children || [];
      } catch (error) {
        logger.warn('Failed to load local workspace tree:', error);
        return [];
      }
    })();

    const remoteTrees = remoteWorkspaces.map(async (workspace): Promise<ExplorerItem | null> => {
      const adapter = workspace.adapter;
      if (typeof adapter.getExplorerTree !== 'function') return null;

      const state = getRemoteState(workspace.id);
      if (plan.shouldFetchRemote(workspace.id) || !state.tree) {
        try {
          const cloudTree = await adapter.getExplorerTree();
          state.tree = {
            type: 'folder',
            name: workspace.name,
            path: `/${workspace.id}`,
            children: cloudTree.children || []
          };
          plan.successes.add(workspace.id);
        } catch (error) {
          logger.warn(`Failed to load remote workspace tree (${workspace.id}):`, error);
          plan.failures.set(workspace.id, error);
        }
      }
      return state.tree;
    });

    const [local, ...remote] = await Promise.all([localChildren, ...remoteTrees]);
    return {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [...local, ...remote.filter((tree): tree is ExplorerItem => tree !== null)]
    };
  };

  const applyExplorerTree = (tree: ExplorerItem | null): void => {
    // Compared against the rendered state, not inside an updater: an updater
    // that returns the previous value still makes React render the hook again.
    if (sameExplorerTree(renderedRef.current.explorerTree, tree)) return;
    setExplorerTree(tree);
  };

  const loadExplorerTree = useStableCallback(async (knownWorkspaces?: WorkspaceInfo[]): Promise<void> => {
    if (!isInitialized || !adapterManager) {
      setExplorerTree(null);
      return;
    }

    try {
      const availableWorkspaces = knownWorkspaces ?? await adapterManager.getAvailableWorkspaces();
      pruneRemoteState(availableWorkspaces);
      const plan = createRefreshPlan(false);
      applyExplorerTree(await buildExplorerTree(availableWorkspaces, plan));
      reportRemoteOutcome(plan, availableWorkspaces);
    } catch (error) {
      logger.warn('Failed to load explorer tree:', error);
    }
  });
  
  const loadWorkspaces = useStableCallback(async (): Promise<void> => {
    if (!isInitialized || !adapterManager) {
      setWorkspaces([]);
      return;
    }

    try {
      const availableWorkspaces = await adapterManager.getAvailableWorkspaces();
      setWorkspaces(availableWorkspaces);
      logger.info(`Loaded ${availableWorkspaces.length} workspaces from AdapterManager`);
    } catch (error) {
      logger.warn('Failed to load workspaces from AdapterManager:', error);
      setWorkspaces([]);
    }
  });

  
  /**
   * Load the active workspace's map list. A remote workspace answers with
   * summaries only (no document is downloaded); null means "keep what is
   * shown" — the listing failed, or a background refresh was not due.
   */
  const loadMapList = async (
    adapter: StorageAdapter,
    workspaceId: string | null,
    plan: RefreshPlan
  ): Promise<{ summaries: MapSummary[] } | { maps: MindMapData[] } | null> => {
    if (typeof adapter.listMapSummaries === 'function') {
      const key = workspaceId ?? 'remote';
      if (!plan.shouldFetchRemote(key)) return null;
      try {
        const summaries = await adapter.listMapSummaries();
        plan.successes.add(key);
        return { summaries };
      } catch (error) {
        logger.warn(`Failed to list maps for ${key}:`, error);
        plan.failures.set(key, error);
        return null;
      }
    }

    try {
      return { maps: await adapter.loadAllMaps() };
    } catch (error) {
      logger.warn('Failed to load maps:', error);
      return null;
    }
  };

  const runRefresh = useStableCallback(async (options: RefreshMapListOptions): Promise<void> => {
    if (!isInitialized || !adapterManager) {
      logger.warn('refreshMapList: Not initialized or no adapter manager');
      return;
    }

    const background = options.background === true;
    // A hidden tab cannot show the result; it catches up when it is shown again.
    if (background && typeof document !== 'undefined' && document.hidden) return;

    const requestId = ++refreshRequestRef.current;
    const currentAdapter = adapterManager.getCurrentAdapter();
    const currentWsId = adapterManager.getCurrentWorkspaceId();
    if (!currentAdapter) {
      logger.warn('refreshMapList: No current adapter available');
      return;
    }

    try {
      const availableWorkspaces = await adapterManager.getAvailableWorkspaces();
      pruneRemoteState(availableWorkspaces);
      const plan = createRefreshPlan(background);

      // The tree and the list are independent requests: run them together.
      const [tree, listResult] = await Promise.all([
        buildExplorerTree(availableWorkspaces, plan),
        loadMapList(currentAdapter, currentWsId, plan)
      ]);

      applyExplorerTree(tree);
      if (!sameWorkspaceList(renderedRef.current.workspaces, availableWorkspaces)) {
        setWorkspaces(availableWorkspaces);
      }
      reportRemoteOutcome(plan, availableWorkspaces);

      // Authentication and workspace changes can start overlapping loads.
      // Never let an older response overwrite the list for the newly active
      // workspace or user.
      if (
        requestId !== refreshRequestRef.current ||
        adapterManager.getCurrentWorkspaceId() !== currentWsId ||
        adapterManager.getCurrentAdapter() !== currentAdapter
      ) {
        logger.debug('Ignoring stale map refresh result');
        return;
      }

      // A failed listing keeps the list the user is looking at.
      if (!listResult) return;

      // Leave the state alone when nothing visible changed, so an idle poll
      // re-renders nothing.
      const shown = renderedRef.current.allMindMaps;
      const next = 'summaries' in listResult
        ? mergeSummariesIntoMapList(shown, listResult.summaries)
        : listResult.maps;
      if (!sameMapList(shown, next)) {
        setAllMindMaps(next);
      }
    } catch (error) {
      logger.error('Failed to refresh map list:', error);
    }
  });

  /**
   * Refresh the explorer tree and the active workspace's map list.
   *
   * Concurrent calls are coalesced: a background call joins a refresh that
   * is already running; any other call (typically after a mutation, which
   * must see its own effect) gets exactly one follow-up refresh, however many
   * callers ask for it in the meantime.
   */
  const refreshMapList = useStableCallback((options: RefreshMapListOptions = {}): Promise<void> => {
    const inFlight = refreshInFlightRef.current;
    if (!inFlight) return startRefresh(options);
    if (options.background) return inFlight;

    if (!refreshQueuedRef.current) {
      refreshQueuedRef.current = inFlight.then(() => {
        refreshQueuedRef.current = null;
        return startRefresh({});
      });
    }
    return refreshQueuedRef.current;
  });

  const startRefresh = (options: RefreshMapListOptions): Promise<void> => {
    const run: Promise<void> = runRefresh(options).finally(() => {
      if (refreshInFlightRef.current === run) refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = run;
    return run;
  };
  
  const switchWorkspace = useStableCallback(async (workspaceId: string | null) => {
    if (!adapterManager) {
      logger.warn('switchWorkspace: No adapter manager available');
      return;
    }

    logger.info(`Switching to workspace: ${workspaceId || 'default'}`);
    setCurrentWorkspaceId(workspaceId);
    adapterManager.setCurrentWorkspace(workspaceId);


    const currentAdapter = adapterManager.getCurrentAdapter();
    const isAuthenticated = currentAdapter && 'isAuthenticated' in currentAdapter
      ? currentAdapter.isAuthenticated
      : 'N/A';
    logger.info(`After switch - Current adapter: ${currentAdapter?.constructor.name}, authenticated: ${isAuthenticated}`);

    
    await refreshMapList();

    logger.info(`Successfully switched to workspace: ${workspaceId || 'default'}`);
  });

  
  useEffect(() => {
    if (isInitialized && adapterManager) {
      const initializeData = async () => {
        await refreshMapList();
      };
      initializeData();
    }
  }, [isInitialized, adapterManager, loadWorkspaces, refreshMapList]);

  
  useEffect(() => {
    const workspaceService = WorkspaceService.getInstance();

    const handleWorkspaceChange = async () => {
      
      if (adapterManager && config.mode === 'local+cloud') {
        const cloudAdapter = workspaceService.getCloudAdapter();
        if (cloudAdapter) {
          adapterManager.setCloudAdapter(cloudAdapter);
          logger.info('Updated cloud adapter in AdapterManager from WorkspaceService');
        }
        const groupAdapter = workspaceService.getGroupAdapter();
        if (groupAdapter) {
          adapterManager.setGroupAdapter(groupAdapter);
          logger.info('Updated group adapter in AdapterManager from WorkspaceService');
        }
        await loadWorkspaces();
        
        await refreshMapList();
      }
    };

    workspaceService.addListener(handleWorkspaceChange);
    return () => {
      workspaceService.removeListener(handleWorkspaceChange);
    };
  }, [adapterManager, config.mode, loadWorkspaces, refreshMapList]);

  // A refused session removes its workspace. If it was the active one, leave
  // it: its adapter can no longer list or save anything, and staying would
  // show an empty workspace behind the login dialog.
  const handleSessionEnded = useStableCallback((event: Event) => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
    if (!detail || typeof detail !== 'object' || !('workspaceId' in detail) || typeof detail.workspaceId !== 'string') return;

    remoteStateRef.current.delete(detail.workspaceId);
    if (adapterManager && adapterManager.getCurrentWorkspaceId() === detail.workspaceId) {
      void switchWorkspace(null).catch((error: unknown) => logger.warn('Failed to leave ended workspace:', error));
    }
  });

  useEffect(() => {
    window.addEventListener(CLOUD_AUTH_EXPIRED_EVENT, handleSessionEnded);
    return () => window.removeEventListener(CLOUD_AUTH_EXPIRED_EVENT, handleSessionEnded);
  }, [handleSessionEnded]);

  
  /**
   * Record a map in the in-memory list only.
   *
   * Distinct from addMapToList, which asks the adapter to persist the map. A
   * map that was just read from storage is already there; asking the cloud
   * adapter to write it back re-serialises it, which is how the map's own path
   * ended up in the document as an extra heading on every open.
   */
  const registerMapInList = useStableCallback((map: MindMapData): void => {
    setAllMindMaps(prev => (
      prev.some(m =>
        m.mapIdentifier.mapId === map.mapIdentifier.mapId &&
        m.mapIdentifier.workspaceId === map.mapIdentifier.workspaceId
      ) ? prev : [...prev, map]
    ));
  });

  const addMapToList = useStableCallback(async (newMap: MindMapData): Promise<void> => {
    if (!isInitialized || !adapterManager) return;

    const currentAdapter = adapterManager.getCurrentAdapter();
    if (!currentAdapter) return;

    try {
      await currentAdapter.addMapToList(newMap);
      setAllMindMaps(prev => [...prev, newMap]);
      logger.info(`Added map "${newMap.title}" to list`);
    } catch (error) {
      logger.error('Failed to add map to list:', error);
      throw error;
    }
  });

  const removeMapFromList = useStableCallback(async (id: MapIdentifier): Promise<void> => {
    if (!isInitialized || !adapterManager) return;

    const currentAdapter = adapterManager.getCurrentAdapter();
    if (!currentAdapter) return;

    try {
      await currentAdapter.removeMapFromList(id);
      setAllMindMaps(prev => prev.filter(map =>
        map.mapIdentifier.mapId !== id.mapId ||
        map.mapIdentifier.workspaceId !== id.workspaceId
      ));
      logger.info(`Removed map ${id.mapId} from list`);
    } catch (error) {
      logger.error('Failed to remove map from list:', error);
      throw error;
    }
  });

  const addWorkspace = useStableCallback(async (): Promise<void> => {
    if (!adapterManager) {
      logger.warn('Cannot add workspace: adapter manager not initialized');
      return;
    }

    try {
      
      const localAdapter = adapterManager.getAdapterForWorkspace(null);

      if (localAdapter && typeof localAdapter.addWorkspace === 'function') {
        await localAdapter.addWorkspace();
        logger.info('Workspace added successfully');

        
        await refreshMapList();
      } else {
        logger.warn('Local adapter does not support workspace creation');
      }
    } catch (error) {
      logger.error('Failed to add workspace:', error);
      throw error;
    }
  });

  const removeWorkspace = useStableCallback(async (id: string): Promise<void> => {
    if (id === 'cloud') {
      
      const workspaceService = WorkspaceService.getInstance();
      await workspaceService.logoutFromCloud();

      if (adapterManager) {
        adapterManager.removeCloudAdapter();
        if (currentWorkspaceId === 'cloud') {
          await switchWorkspace(null); 
        }
      }
    } else if (id === 'group') {
      const workspaceService = WorkspaceService.getInstance();
      workspaceService.logoutFromGroup();

      if (adapterManager) {
        adapterManager.removeGroupAdapter();
        if (currentWorkspaceId === 'group') {
          await switchWorkspace(null);
        }
      }
    } else {
      
      const adapter = adapterManager?.getAdapterForWorkspace(id);
      if (adapter && typeof adapter.removeWorkspace === 'function') {
        try {
          await adapter.removeWorkspace(id);
          logger.info(`Local workspace ${id} removed successfully`);

          
          if (currentWorkspaceId === id) {
            await switchWorkspace(null);
          }

          
          await refreshMapList();
        } catch (error) {
          logger.error(`Failed to remove workspace ${id}:`, error);
        }
      }
    }
    logger.info(`Workspace ${id} removal requested`);
  });

  return {
    
    allMindMaps,
    isInitialized,
    error,
    storageMode: config.mode,
    explorerTree,
    workspaces: workspaces.map(ws => ({ id: ws.id, name: ws.name })), 
    currentWorkspaceId,

    
    refreshMapList,
    addMapToList,
    registerMapInList,
    removeMapFromList,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    loadExplorerTree,

    
    storageAdapter: adapterManager?.getCurrentAdapter() || null,
    getAdapterForWorkspace: (workspaceId: string | null) => adapterManager?.getAdapterForWorkspace(workspaceId) || null,
  };
};
