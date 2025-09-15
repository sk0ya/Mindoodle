import { useCallback, useEffect, useState, useRef } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { DEFAULT_WORKSPACE_ID } from '@shared/types';
import { createInitialData } from '../../shared/types/dataTypes';
import type { StorageAdapter, StorageConfig, ExplorerItem } from '../storage/types';
import { createStorageAdapter } from '../storage/StorageAdapterFactory';
import { logger } from '../../shared/utils/logger';
import { useInitializationWaiter } from './useInitializationWaiter';
import { isMindMapData, validateMindMapData } from '../../shared/utils/validation';

// 型検証は shared/utils/validation から import


/**
 * データ永続化に特化したHook
 * 設定可能なストレージアダプターでの保存・読み込みを担当
 */
export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageAdapter, setStorageAdapter] = useState<StorageAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explorerTree, setExplorerTree] = useState<ExplorerItem | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);

  // 前回の設定を記録して無用な再初期化を防ぐ
  const prevConfigRef = useRef<StorageConfig | null>(null);
  
  // ストレージアダプター初期化
  useEffect(() => {
    const prevConfig = prevConfigRef.current;
    const modeChanged = prevConfig?.mode !== config.mode;
    

    // 設定が実際に変更された場合のみ再初期化
    if (!prevConfig || modeChanged ) {
      logger.debug(`(Re)initializing ${config.mode} storage adapter`, {
        reason: !prevConfig ? 'first-init' : modeChanged ? 'mode-changed' : 'auth-changed'
      });
      
      // 初期化状態をリセット
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
          const adapter = await createStorageAdapter(config);
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

  const { waitForInitialization } = useInitializationWaiter();

  // 初期データ読み込み
  const loadInitialData = useCallback(async (defaultWorkspaceId: string = DEFAULT_WORKSPACE_ID): Promise<MindMapData> => {
    if (!isInitialized || !storageAdapter) {
      await waitForInitialization(() => isInitialized && !!storageAdapter);
    }

    if (!storageAdapter) {
      logger.warn('Storage adapter not available, creating default data');
      const mapIdentifier = { mapId: `map_${Date.now()}`, workspaceId: defaultWorkspaceId };
      return createInitialData(mapIdentifier);
    }

    try {
      const savedData = await storageAdapter.loadInitialData();
      if (savedData && isMindMapData(savedData)) {
        const validation = validateMindMapData(savedData);
        if (validation.isValid) {
          logger.debug(`Loaded saved data from ${config.mode} storage:`, savedData.title);
          return savedData;
        } else {
          logger.warn('Loaded data failed validation:', validation.errors);
        }
      }
    } catch (loadError) {
      logger.error(`Failed to load saved data from ${config.mode} storage:`, loadError);
    }
    
    // デフォルトデータを作成して返す
    const mapIdentifier = { mapId: `map_${Date.now()}`, workspaceId: defaultWorkspaceId };
    const initialData = createInitialData(mapIdentifier);
    logger.debug('Created initial data:', initialData.title);
    return initialData;
  }, [isInitialized, storageAdapter, config.mode, waitForInitialization]);

  // データ保存
  const saveData = useCallback(async (data: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveData(data);
      logger.debug(`Data saved successfully to ${config.mode} storage`);
    } catch (saveError) {
      logger.error(`Failed to save data to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 全マップ読み込み
  const loadAllMaps = useCallback(async (): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;

    try {
      const savedMaps = await storageAdapter.loadAllMaps();

      if (savedMaps && savedMaps.length > 0) {
        // Avoid unnecessary state updates if list is unchanged
        setAllMindMaps(prev => {
          const sameLength = prev.length === savedMaps.length;
          if (sameLength) {
            let same = true;
            for (let i = 0; i < prev.length; i++) {
              const a = prev[i];
              const b = savedMaps[i];
              if (a.mapIdentifier.mapId !== b.mapIdentifier.mapId || a.updatedAt !== b.updatedAt || a.title !== b.title || a.category !== b.category) {
                same = false; break;
              }
            }
            if (same) {
              return prev;
            }
          }
          return savedMaps;
        });
        logger.debug(`Loaded ${savedMaps.length} maps from ${config.mode} storage`);
      } else {
        logger.debug(`No saved maps found in ${config.mode} storage`);
        setAllMindMaps(prev => (prev.length === 0 ? prev : []));
      }
    } catch (loadError) {
      logger.error(`Failed to load maps from ${config.mode} storage:`, loadError);
      setAllMindMaps([]);
    }
  }, [isInitialized, storageAdapter, config.mode]);

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
      setWorkspaces([]);
      return;
    }
    try {
      const ws = await storageAdapter.listWorkspaces();
      setWorkspaces(ws);
    } catch {
      setWorkspaces([]);
    }
  }, [isInitialized, storageAdapter]);

  // 全マップ保存
  const saveAllMaps = useCallback(async (maps: MindMapData[]): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveAllMaps(maps);
      logger.debug(`Saved ${maps.length} maps to ${config.mode} storage`);
    } catch (saveError) {
      logger.error(`Failed to save maps to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

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

  // マップをリストで更新
  const updateMapInList = useCallback(async (updatedMap: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.updateMapInList(updatedMap);
      setAllMindMaps(prevMaps => 
        prevMaps.map(map => map.mapIdentifier.mapId === updatedMap.mapIdentifier.mapId ? updatedMap : map)
      );
      logger.debug(`Updated map in list (${config.mode}):`, updatedMap.title);
    } catch (updateError) {
      logger.error(`Failed to update map in list (${config.mode}):`, updateError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 初期化完了時に軽量データのみ読み込み
  useEffect(() => {
    if (isInitialized && storageAdapter) {
      // Skip loadAllMaps - maps will be loaded on-demand when selected
      loadExplorerTree();
      loadWorkspaces();
    }
  }, [isInitialized, storageAdapter, loadExplorerTree, loadWorkspaces]);


  // マップ一覧を強制リフレッシュする関数
  const refreshMapList = useCallback(async () => {
    if (storageAdapter) {
      // Only refresh explorer tree for periodic updates - much lighter than loading all maps
      await loadExplorerTree();
      await loadWorkspaces();
    }
  }, [storageAdapter, loadExplorerTree, loadWorkspaces]);

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
    loadInitialData,
    saveData,
    loadAllMaps,
    refreshMapList,
    saveAllMaps,
    addMapToList,
    removeMapFromList,
    updateMapInList,
    createFolder,
    
    // ストレージアダプター（高度な使用のため）
    storageAdapter,
    // workspace ops
    addWorkspace: async () => { if (storageAdapter && typeof (storageAdapter as any).addWorkspace === 'function') { await (storageAdapter as any).addWorkspace(); await refreshMapList(); } },
    removeWorkspace: async (id: string) => { if (storageAdapter && typeof (storageAdapter as any).removeWorkspace === 'function') { await (storageAdapter as any).removeWorkspace(id); await refreshMapList(); } }
  };
};
