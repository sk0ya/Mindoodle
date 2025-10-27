import { useEffect, useState, useRef } from 'react';
import { useStableCallback } from '@shared/hooks';
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
  }, [config]);

  
  useEffect(() => {
    return () => {
      if (adapterManager) {
        logger.info('Cleaning up AdapterManager on unmount');
        adapterManager.cleanup();
      }
    };
  }, [adapterManager]);

  
  const loadExplorerTree = useStableCallback(async (): Promise<void> => {
    if (!isInitialized || !adapterManager) {
      setExplorerTree(null);
      return;
    }

    try {
      const availableWorkspaces = await adapterManager.getAvailableWorkspaces();

      
      const localWorkspaces = availableWorkspaces.filter(ws => ws.type === 'local');
      const cloudWorkspaces = availableWorkspaces.filter(ws => ws.type === 'cloud');

      let rootChildren: ExplorerItem[] = [];

      
      if (localWorkspaces.length > 0 && localWorkspaces[0].adapter) {
        const localAdapter = localWorkspaces[0].adapter;
        if (typeof localAdapter.getExplorerTree === 'function') {
          try {
            const localTree = await localAdapter.getExplorerTree();
            
            rootChildren = localTree.children || [];
          } catch (error) {
            logger.warn('Failed to load local workspace tree:', error);
          }
        }
      }

      
      for (const cloudWorkspace of cloudWorkspaces) {
        const adapter = cloudWorkspace.adapter;
        if (adapter && typeof adapter.getExplorerTree === 'function') {
          try {
            const cloudTree = await adapter.getExplorerTree();

            
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

  
  const refreshMapList = useStableCallback(async () => {
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

        
        logger.info(`Loading maps from adapter: ${currentAdapter.constructor.name}`);
        const maps = await currentAdapter.loadAllMaps();
        setAllMindMaps(maps);
        logger.info(`Loaded ${maps.length} maps from current adapter (${currentAdapter.constructor.name})`);

        
        if (maps.length > 0) {
          logger.info('Map titles:', maps.map(m => m.title));
        }
      } catch (error) {
        logger.error('Failed to refresh map list:', error);
      }
    } else {
      logger.warn('refreshMapList: No current adapter available');
    }
  });

  
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
        await loadWorkspaces();
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
        await loadWorkspaces();
        
        await refreshMapList();
      }
    };

    workspaceService.addListener(handleWorkspaceChange);
    return () => {
      workspaceService.removeListener(handleWorkspaceChange);
    };
  }, [adapterManager, config.mode, loadWorkspaces, refreshMapList]);

  
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
    removeMapFromList,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    loadExplorerTree,

    
    storageAdapter: adapterManager?.getCurrentAdapter() || null,
    getAdapterForWorkspace: (workspaceId: string | null) => adapterManager?.getAdapterForWorkspace(workspaceId) || null,
  };
};