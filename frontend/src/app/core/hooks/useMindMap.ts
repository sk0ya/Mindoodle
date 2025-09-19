import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  // const { mergeWithExistingNodes } = useMarkdownSync();

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

  // Stabilize adapter reference - persistenceHook likely returns new references
  const stableAdapter = useMemo(() => {
    const adapter = (persistenceHook as any).storageAdapter || null;
    return adapter;
  }, [persistenceHook.storageAdapter]);

  // Stabilize currentId to prevent unnecessary stream recreation
  const mapIdentifierWorkspaceId = dataHook.data?.mapIdentifier?.workspaceId;
  const mapIdentifierMapId = dataHook.data?.mapIdentifier?.mapId;

  const currentId = useMemo(() => {
    if (!mapIdentifierWorkspaceId || !mapIdentifierMapId) return null;
    // Create stable reference based on actual values, not object identity
    return {
      workspaceId: mapIdentifierWorkspaceId,
      mapId: mapIdentifierMapId
    };
  }, [mapIdentifierWorkspaceId, mapIdentifierMapId]);
  const forceSaveThroughStream = useCallback(async (_data: MindMapData) => {
    try {
      if (!stableAdapter || !currentId) return;
      const md = MarkdownImporter.convertNodesToMarkdown((_data.rootNodes || []));
      await (stableAdapter.saveMapMarkdown?.(currentId, md));
    } catch {
      // ignore
    }
  }, [stableAdapter, currentId]);

  const { saveManually } = useAutoSave(
    dataHook.data,
    { saveData: forceSaveThroughStream },
    { enabled: false },
    { autoSave: false, autoSaveInterval: 150 }
  );

  // Markdown stream for sync between nodes and raw markdown
  const markdownStreamHook = useMarkdownStream(stableAdapter, currentId, { debounceMs: 200 });

  // Stabilize the destructured functions to prevent infinite re-subscriptions
  const stableMarkdownFunctions = useMemo(() => {
    return {
      setFromEditor: markdownStreamHook.setFromEditor,
      setFromNodes: markdownStreamHook.setFromNodes,
      subscribe: markdownStreamHook.subscribe
    };
  }, [markdownStreamHook.setFromEditor, markdownStreamHook.setFromNodes, markdownStreamHook.subscribe]);

  const { setFromEditor, setFromNodes, subscribe: subscribeMd } = stableMarkdownFunctions;
  const lineToNodeIdRef = useRef<Record<number, string>>({});
  const nodeIdToLineRef = useRef<Record<string, number>>({});

  // Track last markdown sent to prevent loops
  const lastSentMarkdownRef = useRef<string>('');

  // Keep latest subscribeMd reference to avoid useEffect dependency issues
  const subscribeMdRef = useRef(subscribeMd);
  subscribeMdRef.current = subscribeMd;

  // Keep latest data and mutators to avoid stale closures in subscription callback
  const dataRef = useRef(dataHook.data);
  useEffect(() => { dataRef.current = dataHook.data; }, [dataHook.data]);
  const setDataRef = useRef(dataHook.setData);
  useEffect(() => { setDataRef.current = dataHook.setData; }, [dataHook.setData]);
  const updateNodeRef = useRef(dataHook.updateNode);
  useEffect(() => { updateNodeRef.current = dataHook.updateNode; }, [dataHook.updateNode]);

  // Timer to prevent nodes->markdown sync after editor changes
  const skipNodeToMarkdownSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nodes -> markdown: only on confirmed updates (updatedAt changes)
  useEffect(() => {
    try {
      // Skip if we recently processed an editor change
      if (skipNodeToMarkdownSyncTimer.current) {
        console.log('⏭️ Skipping nodes->markdown sync (editor change in progress)');
        return;
      }

      const md = MarkdownImporter.convertNodesToMarkdown(dataHook.data?.rootNodes || []);

      // Debug: Compare in detail
      const lastMd = lastSentMarkdownRef.current;
      const isChanged = md !== lastMd;

      console.log('🔍 Nodes->Markdown comparison', {
        changed: isChanged,
        newLength: md.length,
        lastLength: lastMd.length,
        newHash: md.slice(0, 50) + '...',
        lastHash: lastMd.slice(0, 50) + '...',
        trigger: dataHook.data?.updatedAt
      });

      // Only send if markdown actually changed
      if (isChanged) {
        console.log('📝 Nodes -> Markdown: sending update');
        lastSentMarkdownRef.current = md;
        setFromNodes(md);
      } else {
        console.log('⏸️ Nodes -> Markdown: no change, skipping');
      }
    } catch (e) {
      console.error('❌ Nodes->Markdown conversion error:', e);
    }
  }, [dataHook.data?.updatedAt, dataHook.data?.mapIdentifier.mapId]);

  // When markdown changes from editor, rebuild nodes (md -> nodes)
  // Keep this effect lightweight; heavy parsing only on 'editor' source
  useEffect(() => {
    const unsub = subscribeMdRef.current(async (markdown, source) => {
      console.log('📨 useMindMap received markdown', {
        source,
        length: markdown.length,
        hash: markdown.slice(0, 50) + '...',
        dataUpdatedAt: dataRef.current?.updatedAt
      });
      try {
        // If content comes from external load, treat it as the canonical baseline
        if (source === 'external') {
          // Align last-sent baseline to avoid redundant nodes->markdown echo
          lastSentMarkdownRef.current = markdown;
        }

        // Immediate reflection: let the parser decide how to handle incomplete structures.

        const parsed = MarkdownImporter.parseMarkdownToNodes(markdown);

        // Build line<->node maps from parsed nodes
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

        // Apply node updates only when source is the editor.
        // Ignore 'nodes' source to prevent feedback loops (nodes->markdown->nodes)
        // Ignore 'external' source from initial load unless it's actually different
        const currentData = dataRef.current;
        if (source === 'editor' && currentData) {
          console.log('🖊️ Processing editor change');
          // Clear existing timer and set new one to skip nodes->markdown sync for short period
          if (skipNodeToMarkdownSyncTimer.current) {
            clearTimeout(skipNodeToMarkdownSyncTimer.current);
          }
          skipNodeToMarkdownSyncTimer.current = setTimeout(() => {
            skipNodeToMarkdownSyncTimer.current = null;
            console.log('✅ Editor change window closed, nodes->markdown sync re-enabled');
          }, 300); // 300ms window to allow for rapid typing
          const safeRootNodes = Array.isArray(parsed?.rootNodes) ? parsed.rootNodes : [];

          // Flatten helper (pre-order) to compare markdown structure
          type FlatItem = {
            id?: string; // only for existing tree
            text: string;
            note?: string;
            t?: string; // type
            lvl?: number; // level
            ind?: number; // indent level
          };
          const flatten = (nodes: any[], out: FlatItem[] = []): FlatItem[] => {
            for (const n of nodes || []) {
              const mm = n?.markdownMeta || {};
              out.push({
                id: n?.id,
                text: String(n?.text ?? ''),
                note: n?.note,
                t: mm?.type,
                lvl: typeof mm?.level === 'number' ? mm.level : undefined,
                ind: typeof mm?.indentLevel === 'number' ? mm.indentLevel : undefined,
              });
              if (n?.children?.length) flatten(n.children, out);
            }
            return out;
          };

          const prevFlat = flatten(currentData.rootNodes || []);
          const nextFlat = flatten(safeRootNodes);

          const sameStructure = (() => {
            if (prevFlat.length !== nextFlat.length) return false;
            for (let i = 0; i < prevFlat.length; i++) {
              const a = prevFlat[i];
              const b = nextFlat[i];
              if (a.t !== b.t) return false;
              if (a.lvl !== b.lvl) return false;
              // treat undefined and 0 differently only if types are lists
              if ((a.t === 'unordered-list' || a.t === 'ordered-list')) {
                const ia = typeof a.ind === 'number' ? a.ind : 0;
                const ib = typeof b.ind === 'number' ? b.ind : 0;
                if (ia !== ib) return false;
              }
            }
            return true;
          })();

          if (sameStructure) {
            // Update only changed text/note fields
            for (let i = 0; i < prevFlat.length; i++) {
              const a = prevFlat[i];
              const b = nextFlat[i];
              if (!a.id) continue;
              const updates: any = {};
              if (a.text !== b.text) updates.text = b.text;
              // Only update note when it actually changes; undefined vs '' normalization
              const aNote = a.note ?? '';
              const bNote = b.note ?? '';
              if (aNote !== bNote) updates.note = b.note ?? '';
              if (Object.keys(updates).length) {
                updateNodeRef.current(a.id, updates);
              }
            }
          } else {
            // Structure changed: replace and auto-layout
            const now = new Date().toISOString();
            const updatedData = { ...currentData, rootNodes: safeRootNodes, updatedAt: now } as any;
            setDataRef.current(updatedData);
            try { dataHook.applyAutoLayout?.(); } catch { /* ignore */ }
          }
        }
      } catch (error) {
        logger.warn('Markdown parse failed; keeping existing nodes');
      }
    });
    return () => { try { unsub(); } catch (_e) { /* ignore */ void 0; } };
  }, [markdownStreamHook.stream]);

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
