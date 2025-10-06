import { useCallback, useEffect, useState, useRef } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageConfig, ExplorerItem } from '@core/types';
import { AdapterManager, type WorkspaceInfo } from '@core/storage/AdapterManager';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { logger } from '@shared/utils';

export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [adapterManager, setAdapterManager] = useState<AdapterManager | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explorerTree, setExplorerTree] = useState<ExplorerItem | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  const prevConfigRef = useRef<StorageConfig | null>(null);

  // Initialize AdapterManager
  useEffect(() => {
    const prevConfig = prevConfigRef.current;
    const modeChanged = prevConfig?.mode !== config.mode;

    if (!prevConfig || modeChanged) {
      logger.debug(`(Re)initializing AdapterManager for mode: ${config.mode}`);

      setIsInitialized(false);
      setAllMindMaps([]);

      const initManager = async () => {
        try {
          setError(null);

          // Clean up previous manager
          if (adapterManager) {
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
          setIsInitialized(true); // Mark as initialized even on error to continue processing
        }
      };

      initManager();
      prevConfigRef.current = config;
    }
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adapterManager) {
        logger.info('Cleaning up AdapterManager on unmount');
        adapterManager.cleanup();
      }
    };
  }, [adapterManager]);

  // Load explorer tree from all workspaces
  const loadExplorerTree = useCallback(async (): Promise<void> => {
    if (!isInitialized || !adapterManager) {
      setExplorerTree(null);
      return;
    }

    try {
      const availableWorkspaces = await adapterManager.getAvailableWorkspaces();

      // Separate local and cloud workspaces
      const localWorkspaces = availableWorkspaces.filter(ws => ws.type === 'local');
      const cloudWorkspaces = availableWorkspaces.filter(ws => ws.type === 'cloud');

      let rootChildren: ExplorerItem[] = [];

      // Get tree from local adapter (MarkdownFolderAdapter already returns all local workspaces)
      if (localWorkspaces.length > 0 && localWorkspaces[0].adapter) {
        const localAdapter = localWorkspaces[0].adapter;
        if (typeof localAdapter.getExplorerTree === 'function') {
          try {
            const localTree = await localAdapter.getExplorerTree();
            // MarkdownFolderAdapter returns a root with all local workspaces as children
            rootChildren = localTree.children || [];
          } catch (error) {
            logger.warn('Failed to load local workspace tree:', error);
          }
        }
      }

      // Add cloud workspaces
      for (const cloudWorkspace of cloudWorkspaces) {
        const adapter = cloudWorkspace.adapter;
        if (adapter && typeof adapter.getExplorerTree === 'function') {
          try {
            const cloudTree = await adapter.getExplorerTree();

            // Wrap cloud tree with workspace ID
            const wrappedCloudTree: ExplorerItem = {
              type: 'folder',
              name: cloudWorkspace.name,
              path: `/${cloudWorkspace.id}`,
              children: cloudTree.children || []
            };

            rootChildren.push(wrappedCloudTree);
          } catch (error) {
            logger.warn(`Failed to load cloud workspace tree:`, error);
          }
        }
      }

      // Create combined root tree
      const combinedTree: ExplorerItem = {
        type: 'folder',
        name: 'root',
        path: '/',
        children: rootChildren
      };

      setExplorerTree(combinedTree);
    } catch (error) {
      logger.warn('Failed to load explorer tree:', error);
      setExplorerTree(null);
    }
  }, [isInitialized, adapterManager]);

  // Load workspaces from AdapterManager
  const loadWorkspaces = useCallback(async (): Promise<void> => {
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
  }, [isInitialized, adapterManager]);

  // Refresh map list and workspaces
  const refreshMapList = useCallback(async () => {
    if (!isInitialized || !adapterManager) {
      logger.warn('refreshMapList: Not initialized or no adapter manager');
      return;
    }

    const currentAdapter = adapterManager.getCurrentAdapter();
    const currentWsId = adapterManager.getCurrentWorkspaceId();
    logger.info(`refreshMapList: Current workspace: ${currentWsId}, adapter type: ${currentAdapter?.constructor.name}`);

    if (currentAdapter) {
      try {
        await loadExplorerTree();
        await loadWorkspaces();

        // Load maps from current adapter
        logger.info(`Loading maps from adapter: ${currentAdapter.constructor.name}`);
        const maps = await currentAdapter.loadAllMaps();
        setAllMindMaps(maps);
        logger.info(`Loaded ${maps.length} maps from current adapter (${currentAdapter.constructor.name})`);

        // Log map details for debugging
        if (maps.length > 0) {
          logger.info('Map titles:', maps.map(m => m.title));
        }
      } catch (error) {
        logger.error('Failed to refresh map list:', error);
      }
    } else {
      logger.warn('refreshMapList: No current adapter available');
    }
  }, [isInitialized, adapterManager, loadExplorerTree, loadWorkspaces, currentWorkspaceId]);

  // Switch workspace
  const switchWorkspace = useCallback(async (workspaceId: string | null) => {
    if (!adapterManager) {
      logger.warn('switchWorkspace: No adapter manager available');
      return;
    }

    logger.info(`Switching to workspace: ${workspaceId || 'default'}`);
    setCurrentWorkspaceId(workspaceId);
    adapterManager.setCurrentWorkspace(workspaceId);

    // Log current adapter after switch
    const currentAdapter = adapterManager.getCurrentAdapter();
    logger.info(`After switch - Current adapter: ${currentAdapter?.constructor.name}, authenticated: ${(currentAdapter as any)?.isAuthenticated || 'N/A'}`);

    // Refresh maps and tree for new workspace
    await refreshMapList();

    logger.info(`Successfully switched to workspace: ${workspaceId || 'default'}`);
  }, [adapterManager, refreshMapList]);

  // Initialize data when AdapterManager is ready
  useEffect(() => {
    if (isInitialized && adapterManager) {
      const initializeData = async () => {
        await loadWorkspaces();
        await refreshMapList();
      };
      initializeData();
    }
  }, [isInitialized, adapterManager, loadWorkspaces, refreshMapList]);

  // Monitor WorkspaceService changes for cloud workspace
  useEffect(() => {
    const workspaceService = WorkspaceService.getInstance();

    const handleWorkspaceChange = async () => {
      // Update cloud adapter in manager when workspace service changes
      if (adapterManager && config.mode === 'local+cloud') {
        const cloudAdapter = workspaceService.getCloudAdapter();
        if (cloudAdapter) {
          adapterManager.setCloudAdapter(cloudAdapter);
          logger.info('Updated cloud adapter in AdapterManager from WorkspaceService');
        }
        await loadWorkspaces();
        // Refresh map list to ensure cloud maps show up
        await refreshMapList();
      }
    };

    workspaceService.addListener(handleWorkspaceChange);
    return () => {
      workspaceService.removeListener(handleWorkspaceChange);
    };
  }, [adapterManager, config.mode, loadWorkspaces, refreshMapList]);

  // Map operations
  const addMapToList = useCallback(async (newMap: MindMapData): Promise<void> => {
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
  }, [isInitialized, adapterManager]);

  const removeMapFromList = useCallback(async (id: MapIdentifier): Promise<void> => {
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
  }, [isInitialized, adapterManager]);

  const addWorkspace = useCallback(async (): Promise<void> => {
    if (!adapterManager) {
      logger.warn('Cannot add workspace: adapter manager not initialized');
      return;
    }

    try {
      // Get adapter for a local workspace (will return MarkdownFolderAdapter)
      const localAdapter = adapterManager.getAdapterForWorkspace(null);

      if (localAdapter && typeof localAdapter.addWorkspace === 'function') {
        await localAdapter.addWorkspace();
        logger.info('Workspace added successfully');

        // Refresh the map list to show the new workspace
        await refreshMapList();
      } else {
        logger.warn('Local adapter does not support workspace creation');
      }
    } catch (error) {
      logger.error('Failed to add workspace:', error);
      throw error;
    }
  }, [adapterManager, refreshMapList]);

  const removeWorkspace = useCallback(async (id: string): Promise<void> => {
    if (id === 'cloud') {
      // Handle cloud workspace removal
      const workspaceService = WorkspaceService.getInstance();
      await workspaceService.logoutFromCloud();

      if (adapterManager) {
        adapterManager.removeCloudAdapter();
        if (currentWorkspaceId === 'cloud') {
          await switchWorkspace(null); // Switch back to default
        }
      }
    } else {
      // Handle local workspace removal (ws_xxxxx)
      const adapter = adapterManager?.getAdapterForWorkspace(id);
      if (adapter && typeof adapter.removeWorkspace === 'function') {
        try {
          await adapter.removeWorkspace(id);
          logger.info(`Local workspace ${id} removed successfully`);

          // Switch to another workspace if currently viewing the deleted one
          if (currentWorkspaceId === id) {
            await switchWorkspace(null);
          }

          // Refresh workspace and map lists
          await refreshMapList();
        } catch (error) {
          logger.error(`Failed to remove workspace ${id}:`, error);
        }
      }
    }
    logger.info(`Workspace ${id} removal requested`);
  }, [adapterManager, currentWorkspaceId, switchWorkspace, refreshMapList]);

  return {
    // State
    allMindMaps,
    isInitialized,
    error,
    storageMode: config.mode,
    explorerTree,
    workspaces: workspaces.map(ws => ({ id: ws.id, name: ws.name })), // Convert to expected format
    currentWorkspaceId,

    // Operations
    refreshMapList,
    addMapToList,
    removeMapFromList,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    loadExplorerTree,

    // Adapter access
    storageAdapter: adapterManager?.getCurrentAdapter() || null,
    getAdapterForWorkspace: (workspaceId: string | null) => adapterManager?.getAdapterForWorkspace(workspaceId) || null,
  };
};