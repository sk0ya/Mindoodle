import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapIdentifier } from '@shared/types';
import { useMindMapData } from './useMindMapData';
import { MarkdownImporter } from '../../shared/utils/markdownImporter';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import { useInitialDataLoad } from './useInitialDataLoad';
import { useDataReset } from './useDataReset';
import { useStorageConfigChange } from './useStorageConfigChange';
import { useAutoSave } from './useAutoSave';
import { logger } from '../../shared/utils/logger';
import type { StorageConfig } from '../storage/types';
import type { MindMapData } from '@shared/types';
import { useMarkdownStream } from './useMarkdownStream';

/**
 * 統合MindMapHook - 新しいアーキテクチャ
 * 
 * 専門化されたHookを組み合わせて完全なMindMap機能を提供
 * Single Responsibility Principleに従い、テスタブルで保守しやすい構造
 */
export const useMindMap = (
  isAppReady: boolean = true, 
  storageConfig?: StorageConfig,
  resetKey: number = 0
) => {
  // 専門化されたHookを使用
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);

  // 各種データ処理を分離されたhookで管理
  useInitialDataLoad(isAppReady, {
    data: dataHook.data,
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData,
    applyAutoLayout: dataHook.applyAutoLayout
  });

  useDataReset(resetKey, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData,
    refreshMapList: persistenceHook.refreshMapList,
    applyAutoLayout: dataHook.applyAutoLayout,
    currentWorkspaceId: dataHook.data?.mapIdentifier.workspaceId
  });

  useStorageConfigChange(storageConfig, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData,
    refreshMapList: persistenceHook.refreshMapList,
    applyAutoLayout: dataHook.applyAutoLayout,
    currentWorkspaceId: dataHook.data?.mapIdentifier.workspaceId
  });

  // 自動保存機能
  const [, setAutoSaveEnabled] = useState(true);

  // Unify save route via markdown stream; keep manual save by flushing through adapter
  const adapterForStream: any = (persistenceHook as any).storageAdapter || null;
  const currentId = dataHook.data?.mapIdentifier || null;
  const forceSaveThroughStream = useCallback(async (_data: MindMapData) => {
    try {
      if (!adapterForStream || !currentId) return;
      const md = MarkdownImporter.convertNodesToMarkdown((_data.rootNodes || []));
      await (adapterForStream.saveMapMarkdown?.(currentId, md));
    } catch {
      // ignore
    }
  }, [adapterForStream, currentId]);

  const { saveManually } = useAutoSave(
    dataHook.data,
    { saveData: forceSaveThroughStream },
    { enabled: false },
    { autoSave: false, autoSaveInterval: 150 }
  );

  // Markdown stream for sync between nodes and raw markdown
  const { setFromEditor, setFromNodes, subscribe: subscribeMd } = useMarkdownStream(adapterForStream, currentId, { debounceMs: 200 });
  const lineToNodeIdRef = useRef<Record<number, string>>({});
  const nodeIdToLineRef = useRef<Record<string, number>>({});

  // Nodes -> markdown: only on confirmed updates (updatedAt changes)
  useEffect(() => {
    try {
      const md = MarkdownImporter.convertNodesToMarkdown(dataHook.data?.rootNodes || []);
      setFromNodes(md);
    } catch { /* ignore */ }
  }, [dataHook.data?.updatedAt, dataHook.data?.mapIdentifier.mapId, setFromNodes]);

  // When markdown changes from editor, rebuild nodes (md -> nodes)
  // Keep this effect lightweight; heavy parsing only on 'editor' source
  useEffect(() => {
    const unsub = subscribeMd(async (markdown, source) => {
      if (!dataHook.data) return;
      try {
        const parsed = MarkdownImporter.parseMarkdownToNodes(markdown);
        // Build line<->node maps from merged nodes (ids preserved, line numbers from parsed via merge)
        const lineToNode: Record<number, string> = {};
        const nodeToLine: Record<string, number> = {};
        const walk = (nodes: any[]) => {
          for (const n of nodes || []) {
            const ln = n?.markdownMeta?.lineNumber;
            // Normalize to 1-based editor line numbers
            if (typeof ln === 'number' && ln >= 0 && typeof n?.id === 'string') {
              const line1 = ln + 1;
              lineToNode[line1] = n.id;
              nodeToLine[n.id] = line1;
            }
            if (n?.children?.length) walk(n.children);
          }
        };
        walk(parsed.rootNodes || []);
        lineToNodeIdRef.current = lineToNode;
        nodeIdToLineRef.current = nodeToLine;

        // Apply node updates only when source is the editor (replace to match stream)
        if (source === 'editor') {
          const now = new Date().toISOString();
          dataHook.setData({ ...dataHook.data, rootNodes: parsed.rootNodes || [], updatedAt: now });
        }
      } catch (_e) {
        logger.warn('Markdown parse failed; keeping existing nodes');
      }
    });
    return () => { try { unsub(); } catch (_e) { /* ignore */ void 0; } };
  }, [subscribeMd, dataHook.data]);

  // Removed global CustomEvent echo path to avoid race/rollback

  // Folder selection helper to ensure we operate on the same adapter instance
  const selectRootFolder = useCallback(async (): Promise<boolean> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.addWorkspace === 'function') {
      await adapter.addWorkspace();
      await persistenceHook.refreshMapList();
      return true;
    }
    // fallback legacy
    if (adapter && typeof adapter.selectRootFolder === 'function') {
      await adapter.selectRootFolder();
      await persistenceHook.refreshMapList();
      return true;
    }
    return false;
  }, [persistenceHook]);

  const createFolder = useCallback(async (relativePath: string): Promise<void> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.createFolder === 'function') {
      await adapter.createFolder(relativePath);
      await persistenceHook.refreshMapList();
    }
  }, [persistenceHook]);

  const renameItem = useCallback(async (path: string, newName: string): Promise<void> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.renameItem === 'function') {
      await adapter.renameItem(path, newName);
      await persistenceHook.refreshMapList();
    }
  }, [persistenceHook]);

  const deleteItem = useCallback(async (path: string): Promise<void> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.deleteItem === 'function') {
      await adapter.deleteItem(path);
      await persistenceHook.refreshMapList();
    }
  }, [persistenceHook]);

  const moveItem = useCallback(async (sourcePath: string, targetFolderPath: string): Promise<void> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.moveItem === 'function') {
      await adapter.moveItem(sourcePath, targetFolderPath);
      await persistenceHook.refreshMapList();
    }
  }, [persistenceHook]);

  const readImageAsDataURL = useCallback(async (relativePath: string, workspaceId?: string): Promise<string | null> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.readImageAsDataURL === 'function') {
      return await adapter.readImageAsDataURL(relativePath, workspaceId);
    }
    return null;
  }, [persistenceHook]);

  const getSelectedFolderLabel = useCallback((): string | null => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && 'selectedFolderName' in adapter) {
      return (adapter as any).selectedFolderName ?? null;
    }
    return null;
  }, [persistenceHook]);

  // Expose raw markdown fetch for current adapter (markdown mode only)
  const getMapMarkdown = useCallback(async (id: MapIdentifier): Promise<string | null> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.getMapMarkdown === 'function') {
      try {
        return await adapter.getMapMarkdown(id);
      } catch {
        return null;
      }
    }
    return null;
  }, [persistenceHook]);

  const getMapLastModified = useCallback(async (id: MapIdentifier): Promise<number | null> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.getMapLastModified === 'function') {
      try {
        return await adapter.getMapLastModified(id.mapId);
      } catch {
        return null;
      }
    }
    return null;
  }, [persistenceHook]);

  // Save raw markdown for current adapter (markdown mode only)
  const saveMapMarkdown = useCallback(async (id: MapIdentifier, markdown: string): Promise<void> => {
    const adapter: any = persistenceHook.storageAdapter as any;
    if (adapter && typeof adapter.saveMapMarkdown === 'function') {
      try {
        await adapter.saveMapMarkdown(id, markdown);
      } catch (error) {
        console.error('Failed to save map markdown:', error);
        throw error;
      }
    } else {
      throw new Error('saveMapMarkdown not supported by current storage adapter');
    }
  }, [persistenceHook]);

  // マップ管理の高レベル操作（非同期対応）
  const mapOperations = {
    createAndSelectMap: useCallback(async (title: string, workspaceId: string, category?: string): Promise<string> => {
      const newMap = actionsHook.createMap(title, workspaceId, category);
      await persistenceHook.addMapToList(newMap);
      actionsHook.selectMap(newMap);
      return newMap.mapIdentifier.mapId;
    }, [actionsHook, persistenceHook]),

    selectMapById: useCallback(async (target: MapIdentifier): Promise<boolean> => {
      const mapId = target.mapId;
      const workspaceId = target.workspaceId;

      const targetMap = persistenceHook.allMindMaps.find(map => map.mapIdentifier.mapId === mapId && map.mapIdentifier.workspaceId === workspaceId);
      if (targetMap) {
        actionsHook.selectMap(targetMap);
        return true;
      }

      // Fallback: try to load markdown by id via adapter and parse
      // 重複実行を防ぐため、既に実行中の場合はスキップ
      const fallbackKey = `${workspaceId}:${mapId}`;
      if ((window as any).__selectMapFallbackInProgress?.[fallbackKey]) {
        return false;
      }
      // 実行中フラグを設定
      (window as any).__selectMapFallbackInProgress = (window as any).__selectMapFallbackInProgress || {};
      (window as any).__selectMapFallbackInProgress[fallbackKey] = true;

      try {
        const adapter: any = (persistenceHook as any).storageAdapter;
        if (!adapter) {
          delete (window as any).__selectMapFallbackInProgress[fallbackKey];
          return false;
        }
        const text: string | null = await (adapter.getMapMarkdown?.(target));
        if (!text) {
          delete (window as any).__selectMapFallbackInProgress[fallbackKey];
          return false;
        }

        // 再度チェック：他の処理で既にリストに追加されている可能性
        const existingMap = persistenceHook.allMindMaps.find(map => map.mapIdentifier.mapId === mapId && map.mapIdentifier.workspaceId === workspaceId);
        if (existingMap) {
          actionsHook.selectMap(existingMap);
          delete (window as any).__selectMapFallbackInProgress[fallbackKey];
          return true;
        }
        
        // allMindMapsから同じタイトルのマップを検索して、正しいmapIdentifierを取得
        const existingMapByTitle = persistenceHook.allMindMaps.find(map => 
          map.title === mapId && map.mapIdentifier.workspaceId === workspaceId
        );
        
        let actualMapId = mapId;
        if (existingMapByTitle) {
          // 既存のマップが見つかった場合、そのmapIdentifierを使用
          actualMapId = existingMapByTitle.mapIdentifier.mapId;
          console.log('🔄 Found existing map by title. Using mapId:', actualMapId, 'instead of requested:', mapId);
        }
        
        const parseResult = MarkdownImporter.parseMarkdownToNodes(text);
        const parts = (actualMapId || '').split('/').filter(Boolean);
        const category = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        const now = new Date().toISOString();
        const parsed: MindMapData = {
          title: mapId, // UIで表示されるタイトル
          category: category || undefined,
          rootNodes: parseResult.rootNodes,
          createdAt: now,
          updatedAt: now,
          settings: { autoSave: true, autoLayout: true },
          mapIdentifier: { mapId: actualMapId, workspaceId } // 正しいファイルベースのmapId
        };

        actionsHook.selectMap(parsed);

        // リストに追加（重複チェック後）
        try {
          // 最終重複チェック
          const stillNotExists = !persistenceHook.allMindMaps.find(m =>
            m.mapIdentifier.mapId === actualMapId && m.mapIdentifier.workspaceId === workspaceId
          );

          if (stillNotExists) {
            await persistenceHook.addMapToList(parsed);
          }
        } catch (e) {
          logger.error('Failed to add map to list:', e);
        }

        delete (window as any).__selectMapFallbackInProgress[fallbackKey];
        return true;
      } catch (e) {
        logger.error('Fallback error:', e);
        delete (window as any).__selectMapFallbackInProgress[fallbackKey];
        return false;
      }
    }, [persistenceHook, actionsHook]),

    deleteMap: useCallback(async (id: MapIdentifier): Promise<void> => {
      await persistenceHook.removeMapFromList(id);
      // 現在のマップが削除された場合は新しいマップを作成
      if (dataHook.data?.mapIdentifier.mapId === id.mapId) {
        const newMap = actionsHook.createMap('新しいマインドマップ', id.workspaceId);
        actionsHook.selectMap(newMap);
      }
    }, [persistenceHook, dataHook, actionsHook]),

    updateMapMetadata: useCallback(async (target: MapIdentifier, updates: { title?: string; category?: string }): Promise<void> => {
      const mapId = target.mapId;
      // 現在選択中のマップの場合のみストアを更新
      if (dataHook.data?.mapIdentifier.mapId === mapId) {
        actionsHook.updateMapMetadata(target, updates);
      }
      
      // マップリストを常に更新（全マップ中から該当するマップを探して更新）
      const mapToUpdate = persistenceHook.allMindMaps.find(map => map.mapIdentifier.mapId === mapId && map.mapIdentifier.workspaceId === target.workspaceId);
      if (mapToUpdate) {
        const updatedMap = {
          ...mapToUpdate,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        await persistenceHook.updateMapInList(updatedMap);
      }
    }, [actionsHook, dataHook, persistenceHook]),

    addImportedMapToList: useCallback(async (mapData: MindMapData): Promise<void> => {
      await persistenceHook.addMapToList(mapData);
    }, [persistenceHook])
  };

  // ファイル操作の統合
  const fileOperations = {
    exportCurrentMap: useCallback(() => {
      return actionsHook.exportData();
    }, [actionsHook]),

    importMap: useCallback(async (jsonData: string): Promise<boolean> => {
      const success = actionsHook.importData(jsonData);
      if (success && dataHook.data) {
        await persistenceHook.addMapToList(dataHook.data);
      }
      return success;
    }, [actionsHook, dataHook, persistenceHook])
  };

  // マップ一覧の初期化状態も返す
  const isReady = persistenceHook.isInitialized;


  return {
    // === 状態 ===
    // データ状態
    data: dataHook.data,
    normalizedData: dataHook.normalizedData,
    selectedNodeId: dataHook.selectedNodeId,
    editingNodeId: dataHook.editingNodeId,
    editText: dataHook.editText,
    editingMode: dataHook.editingMode,
    
    // UI状態
    ui: uiHook.ui,
    
    // 履歴状態
    canUndo: actionsHook.canUndo(),
    canRedo: actionsHook.canRedo(),
    
    // マップ一覧
    allMindMaps: persistenceHook.allMindMaps,
    currentMapId: actionsHook.currentMapId,
    isReady,

    // === 操作 ===
    // データ操作（ノード・編集・選択）
    addNode: dataHook.addNode,
    updateNode: dataHook.updateNode,
    deleteNode: dataHook.deleteNode,
    moveNode: dataHook.moveNode,
    changeSiblingOrder: dataHook.changeSiblingOrder,
    toggleNodeCollapse: dataHook.toggleNodeCollapse,
    startEditing: dataHook.startEditing,
    startEditingWithCursorAtEnd: dataHook.startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart: dataHook.startEditingWithCursorAtStart,
    finishEditing: dataHook.finishEditing,
    cancelEditing: dataHook.cancelEditing,
    setEditText: dataHook.setEditText,
    selectNode: dataHook.selectNode,
    setData: dataHook.setData,
    applyAutoLayout: dataHook.applyAutoLayout,
    
    // 手動保存
    saveCurrentMap: saveManually,

    // UI操作
    setZoom: uiHook.setZoom,
    setPan: uiHook.setPan,
    resetZoom: uiHook.resetZoom,
    setShowCustomizationPanel: uiHook.setShowCustomizationPanel,
    closeAllPanels: uiHook.closeAllPanels,
    toggleSidebar: uiHook.toggleSidebar,
    setSidebarCollapsed: uiHook.setSidebarCollapsed,
    showImageModal: uiHook.showImageModal,
    hideImageModal: uiHook.hideImageModal,
    showCustomization: uiHook.showCustomization,
    showFileActionMenu: uiHook.showFileActionMenu,
    hideFileActionMenu: uiHook.hideFileActionMenu,

    // アクション操作
    undo: actionsHook.undo,
    redo: actionsHook.redo,

    // 高レベルマップ操作
    ...mapOperations,
    
    // ファイル操作
    ...fileOperations,

    // 永続化の一部を表に出す（同一アダプターをUIから利用するため）
    updateMapInList: persistenceHook.updateMapInList,
    refreshMapList: persistenceHook.refreshMapList,
    selectRootFolder,
    getSelectedFolderLabel,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    readImageAsDataURL,
    explorerTree: (persistenceHook as any).explorerTree || null
    ,
    workspaces: (persistenceHook as any).workspaces || [],
    addWorkspace: (persistenceHook as any).addWorkspace,
    removeWorkspace: (persistenceHook as any).removeWorkspace,
    // markdown helpers
    getMapMarkdown,
    getMapLastModified,
    saveMapMarkdown,
    subscribeMarkdownFromNodes: (cb: (text: string) => void) => subscribeMd((text: string, source: any) => { if (source === 'nodes') cb(text); }),
    // live markdown input -> stream
    onMapMarkdownInput: (text: string) => setFromEditor(text),
    // mapping helper (editor -> node only)
    getNodeIdByMarkdownLine: (line: number): string | null => {
      const map = lineToNodeIdRef.current || {};
      if (map[line]) return map[line];
      // pick nearest previous line mapped
      let bestLine = 0;
      for (const k of Object.keys(map)) {
        const ln = parseInt(k, 10);
        if (ln <= line && ln > bestLine) bestLine = ln;
      }
      return bestLine ? map[bestLine] : null;
    },
    // autosave control
    setAutoSaveEnabled: (enabled: boolean) => setAutoSaveEnabled(enabled)
  };
};
