import { useCallback, useEffect, useState, useRef } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageAdapter, StorageConfig, ExplorerItem } from '@core/storage/types';
import { createStorageAdapter } from '@core/storage/StorageAdapterFactory';
import { logger } from '@shared/utils';

export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageAdapter, setStorageAdapter] = useState<StorageAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explorerTree, setExplorerTree] = useState<ExplorerItem | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);

  const prevConfigRef = useRef<StorageConfig | null>(null);
  
  useEffect(() => {
    const prevConfig = prevConfigRef.current;
    const modeChanged = prevConfig?.mode !== config.mode;
    

    if (!prevConfig || modeChanged ) {
      logger.debug(`(Re)initializing ${config.mode} storage adapter`, {
        reason: !prevConfig ? 'first-init' :  'mode-changed'
      });
      
      setIsInitialized(false);
      setAllMindMaps([]);
      
      const initStorage = async () => {
        try {
          setError(null);
          
          // 前のアダプターをクリーンアップ
          if (storageAdapter) {
          logger.debug('Cleaning up previous adapter');
            storageAdapter.cleanup();
          }
          
          logger.debug(`Creating ${config.mode} storage adapter`);
          const adapter = await createStorageAdapter();
          setStorageAdapter(adapter);
          setIsInitialized(true);
          logger.debug(`${config.mode} storage initialized successfully`);
        } catch (initError) {
          const errorMessage = initError instanceof Error ? initError.message : 'Storage initialization failed';
          logger.error('Storage initialization failed:', initError);
          setError(errorMessage);
          setIsInitialized(true); // エラーでも初期化完了扱いにして処理を続行
        }
      };
      initStorage();
      
      prevConfigRef.current = config;
    }
  }, [config, storageAdapter, isInitialized]);

  // ストレージアダプターのクリーンアップを単独のuseEffectで管理
  useEffect(() => {
    return () => {
      if (storageAdapter) {
        logger.info('Cleaning up adapter on unmount/change');
        storageAdapter.cleanup();
      }
    };
  }, [storageAdapter]);

  // エクスプローラーツリー読み込み
  const loadExplorerTree = useCallback(async (): Promise<void> => {
    if (!isInitialized || !storageAdapter || typeof storageAdapter.getExplorerTree !== 'function') {
      setExplorerTree(null);
      return;
    }
    try {
      const tree = await storageAdapter.getExplorerTree();
      setExplorerTree(tree);
    } catch (e) {
      setExplorerTree(null);
    }
  }, [isInitialized, storageAdapter]);

  // Workspaces management
  const loadWorkspaces = useCallback(async (): Promise<void> => {
    if (!isInitialized || !storageAdapter || typeof storageAdapter.listWorkspaces !== 'function') {
      // Don't clear workspaces during initialization - preserve existing ones
      // Only clear on first mount when there are no workspaces
      setWorkspaces(prev => prev.length > 0 ? prev : []);
      return;
    }
    try {
      const ws = await storageAdapter.listWorkspaces();
      setWorkspaces(ws);
    } catch (error) {
      // Don't clear workspaces on error - preserve existing ones
      // This prevents workspaces from disappearing when permissions are lost
      logger.warn('Failed to load workspaces, preserving existing list:', error);
    }
  }, [isInitialized, storageAdapter]);

  // マップ一覧を強制リフレッシュする関数
  const refreshMapList = useCallback(async () => {
    if (storageAdapter) {
      // Only refresh explorer tree for periodic updates - much lighter than loading all maps
      await loadExplorerTree();
      await loadWorkspaces();
    }
  }, [storageAdapter, loadExplorerTree, loadWorkspaces]);

  // 初期化完了時にワークスペースとマップを読み込む
  useEffect(() => {
    if (isInitialized && storageAdapter) {
      const initializeData = async () => {
        await loadWorkspaces();
        await refreshMapList();
      };
      initializeData();
    }
  }, [isInitialized, storageAdapter, loadWorkspaces, refreshMapList]);

  // マップをリストに追加
  const addMapToList = useCallback(async (newMap: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;

    try {
      await storageAdapter.addMapToList(newMap);
      setAllMindMaps(prevMaps => {
        // Check for duplicates before adding
        const existingMapIndex = prevMaps.findIndex(m =>
          m.mapIdentifier.mapId === newMap.mapIdentifier.mapId &&
          m.mapIdentifier.workspaceId === newMap.mapIdentifier.workspaceId
        );

        if (existingMapIndex !== -1) {
          return prevMaps; // Return unchanged if duplicate exists
        }

        return [...prevMaps, newMap];
      });
      logger.debug(`Added map to list (${config.mode}):`, newMap.title);
    } catch (addError) {
      logger.error(`Failed to add map to list (${config.mode}):`, addError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストから削除
  const removeMapFromList = useCallback(async (id: MapIdentifier): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.removeMapFromList(id);
      setAllMindMaps(prevMaps => prevMaps.filter(map => !(map.mapIdentifier.mapId === id.mapId && map.mapIdentifier.workspaceId === id.workspaceId)));
      logger.debug(`Removed map from list (${config.mode}):`, id.mapId);
    } catch (removeError) {
      logger.error(`Failed to remove map from list (${config.mode}):`, removeError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // Create folder wrapper
  const createFolder = useCallback(async (relativePath: string): Promise<void> => {
    if (!isInitialized || !storageAdapter || typeof storageAdapter.createFolder !== 'function') return;
    await storageAdapter.createFolder(relativePath);
    await refreshMapList();
  }, [isInitialized, storageAdapter, refreshMapList]);

  return {
    // 状態
    allMindMaps,
    isInitialized,
    error,
    storageMode: config.mode,
    explorerTree,
    workspaces,
    
    // 操作
    refreshMapList,
    addMapToList,
    removeMapFromList,
    createFolder,
    
    // ストレージアダプター（高度な使用のため）
    storageAdapter,
    // workspace ops
    addWorkspace: async () => { if (storageAdapter && typeof (storageAdapter as any).addWorkspace === 'function') { await (storageAdapter as any).addWorkspace(); await refreshMapList(); } },
    removeWorkspace: async (id: string) => { if (storageAdapter && typeof (storageAdapter as any).removeWorkspace === 'function') { await (storageAdapter as any).removeWorkspace(id); await refreshMapList(); } }
  };
};
