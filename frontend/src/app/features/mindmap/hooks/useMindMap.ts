import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapIdentifier, MindMapData, MindMapNode } from '@shared/types';
import { useMindMapData } from './useMindMapData';
import { MarkdownImporter } from '@markdown/markdownImporter';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import { useDataReset, useNotification, useStableCallback, useLatestRef } from '@shared/hooks';
import { useStorageConfigChange } from '@file-management/hooks/useStorageConfigChange';
import { logger, statusMessages } from '@shared/utils';
import type { StorageConfig, StorageAdapter } from '@core/types';
import { useMarkdownStream } from '@markdown/hooks/useMarkdownStream';
import { useMindMapStore } from '@mindmap/store';
import { getAdapterForWorkspace } from '@/app/core/utils';
import { MarkdownMemoizer } from '@mindmap/utils/nodeHash';

export const useMindMap = (
  storageConfig?: StorageConfig,
  resetKey: number = 0
) => {
  
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);
  const { showNotification } = useNotification();
  const settings = useMindMapStore((state) => state.settings);
  

  useDataReset(resetKey, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    refreshMapList: persistenceHook.refreshMapList,
    applyAutoLayout: dataHook.applyAutoLayout,
    currentWorkspaceId: dataHook.data?.mapIdentifier.workspaceId,
  });

  useStorageConfigChange(storageConfig, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    refreshMapList: persistenceHook.refreshMapList,
    applyAutoLayout: dataHook.applyAutoLayout,
    currentWorkspaceId: dataHook.data?.mapIdentifier.workspaceId
  });

  
  const [, setAutoSaveEnabled] = useState(true);
  const setAutoSaveEnabledStable = useStableCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
  });

  
  const mapWorkspaceId = dataHook.data?.mapIdentifier?.workspaceId;
  const stableAdapter = useMemo(() => {
    return getAdapterForWorkspace(persistenceHook, mapWorkspaceId);
  }, [persistenceHook, mapWorkspaceId]);

  
  const mapIdentifierWorkspaceId = dataHook.data?.mapIdentifier?.workspaceId;
  const mapIdentifierMapId = dataHook.data?.mapIdentifier?.mapId;

  const currentId = useMemo(() => {
    if (!mapIdentifierWorkspaceId || !mapIdentifierMapId) return null;
    
    return {
      workspaceId: mapIdentifierWorkspaceId,
      mapId: mapIdentifierMapId
    };
  }, [mapIdentifierWorkspaceId, mapIdentifierMapId]);

  
  const markdownStreamHook = useMarkdownStream(stableAdapter, currentId, { debounceMs: 200 });

  
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


  const lastSentMarkdownRef = useRef<string>('');

  // ✅ NEW: Markdown memoization for performance
  const markdownMemoizer = useRef(new MarkdownMemoizer());

  // Keep latest references to avoid stale closures in subscription callbacks
  const subscribeMdRef = useLatestRef(subscribeMd);
  const dataRef = useLatestRef(dataHook.data);
  const updateNodeRef = useLatestRef(dataHook.updateNode);
  const applyAutoLayoutRef = useLatestRef(dataHook.applyAutoLayout);

  // Timer to prevent nodes->markdown sync after editor changes
  const skipNodeToMarkdownSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ OPTIMIZED: Nodes -> markdown with memoization
  useEffect(() => {
    try {
      // Skip if we recently processed an editor change
      if (skipNodeToMarkdownSyncTimer.current) {
        logger.debug('⏭️ Skipping nodes->markdown sync (editor change in progress)');
        return;
      }

      const rootNodes = dataHook.data?.rootNodes || [];

      // ✅ Use memoized conversion (only converts if structure changed)
      const md = markdownMemoizer.current.convert(
        rootNodes,
        (nodes) => MarkdownImporter.convertNodesToMarkdown(nodes)
      );

      // Debug: Compare in detail
      const lastMd = lastSentMarkdownRef.current;
      const isChanged = md !== lastMd;

      // Log memoization stats periodically
      const stats = markdownMemoizer.current.getStats();
      if ((stats.hitCount + stats.missCount) % 10 === 0 && stats.hitCount > 0) {
        logger.debug('📊 Markdown memoization stats:', {
          hits: stats.hitCount,
          misses: stats.missCount,
          hitRate: `${(stats.hitRate * 100).toFixed(1)}%`
        });
      }

      logger.debug('🔍 Nodes->Markdown comparison', {
        changed: isChanged,
        newLength: md.length,
        lastLength: lastMd.length,
        newHash: md.slice(0, 50) + '...',
        lastHash: lastMd.slice(0, 50) + '...',
        trigger: dataHook.data?.updatedAt,
        memoHit: stats.hitCount > 0
      });


      if (isChanged) {
        logger.debug('📝 Nodes -> Markdown: sending update');
        lastSentMarkdownRef.current = md;
        setFromNodes(md);
      } else {
        logger.debug('⏸️ Nodes -> Markdown: no change, skipping');
      }
    } catch (e) {
      console.error('❌ Nodes->Markdown conversion error:', e);
    }
  }, [dataHook.data?.updatedAt, dataHook.data?.mapIdentifier.mapId, dataHook.data?.rootNodes, setFromNodes]);

  
  
  useEffect(() => {
    const unsub = subscribeMdRef.current(async (markdown: string, source: string) => {
      logger.debug('📨 useMindMap received markdown', {
        source,
        length: markdown.length,
        hash: markdown.slice(0, 50) + '...',
        dataUpdatedAt: dataRef.current?.updatedAt
      });
      try {
        
        if (source === 'external') {
          
          lastSentMarkdownRef.current = markdown;
        }

        

        const parsed = MarkdownImporter.parseMarkdownToNodes(markdown, {
          defaultCollapseDepth: settings.defaultCollapseDepth
        });

        
        const lineToNode: Record<number, string> = {};
        const nodeToLine: Record<string, number> = {};
        const walk = (nodes: MindMapNode[]) => {
          for (const n of nodes || []) {
            const ln = n?.markdownMeta?.lineNumber;
            
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

        
        
        
        const currentData = dataRef.current;
        if (source === 'editor' && currentData) {
          logger.debug('🖊️ Processing editor change');
          
          if (skipNodeToMarkdownSyncTimer.current) {
            clearTimeout(skipNodeToMarkdownSyncTimer.current);
          }
          skipNodeToMarkdownSyncTimer.current = setTimeout(() => {
            skipNodeToMarkdownSyncTimer.current = null;
            logger.debug('✅ Editor change window closed, nodes->markdown sync re-enabled');
          }, 300); 
          const safeRootNodes = Array.isArray(parsed?.rootNodes) ? parsed.rootNodes : [];

          
          type FlatItem = {
            id?: string; 
            text: string;
            note?: string;
            t?: string; 
            lvl?: number; 
            ind?: number; 
            k?: string; 
          };
          const flatten = (nodes: MindMapNode[], out: FlatItem[] = []): FlatItem[] => {
            for (const n of nodes || []) {
              const mm = n?.markdownMeta || {};
              out.push({
                id: n?.id,
                text: String(n?.text ?? ''),
                note: n?.note,
                t: mm?.type,
                lvl: typeof mm?.level === 'number' ? mm.level : undefined,
                ind: typeof mm?.indentLevel === 'number' ? mm.indentLevel : undefined,
                k: typeof n?.kind === 'string' ? n.kind : undefined,
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
              
              if ((a.t === 'unordered-list' || a.t === 'ordered-list')) {
                const ia = typeof a.ind === 'number' ? a.ind : 0;
                const ib = typeof b.ind === 'number' ? b.ind : 0;
                if (ia !== ib) return false;
              }
              
              if (a.k !== b.k) return false;
            }
            return true;
          })();

          if (sameStructure) {
            
            for (let i = 0; i < prevFlat.length; i++) {
              const a = prevFlat[i];
              const b = nextFlat[i];
              if (!a.id) continue;
              const updates: Partial<MindMapNode> = {};
              if (a.text !== b.text) updates.text = b.text;
              
              const aNote = a.note ?? '';
              const bNote = b.note ?? '';
              if (aNote !== bNote) updates.note = b.note ?? '';
              if (Object.keys(updates).length) {
                updateNodeRef.current(a.id, updates);
              }
            }
          } else {
            // Structure changed: replace root nodes and record in history (including kind changes)
            (dataHook as { setRootNodes: (nodes: MindMapNode[], options: { emit: boolean }) => void }).setRootNodes(safeRootNodes, { emit: true });
            // Apply unified auto-layout after structural markdown changes.
            // Positions are not serialized to markdown, so this won't cause loops.
            try { applyAutoLayoutRef.current?.(); } catch (e) { logger.warn('auto layout failed', e as Error); }
          }
        }
      } catch (error) {
        logger.warn('Markdown parse failed; keeping existing nodes', error as Error);
      }
    });
    return () => { try { unsub(); } catch (e) { logger.warn('unsubscribe failed', e as Error); } };
  }, [subscribeMdRef, dataRef, updateNodeRef, applyAutoLayoutRef, dataHook, settings.defaultCollapseDepth]);

  


  const selectRootFolder = useStableCallback(async (): Promise<boolean> => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook);
    if (adapter && typeof adapter.addWorkspace === 'function') {
      await adapter.addWorkspace();
      await persistenceHook.refreshMapList();
      return true;
    }
    
    if (adapter && typeof adapter.selectRootFolder === 'function') {
      await adapter.selectRootFolder();
      await persistenceHook.refreshMapList();
      return true;
    }
    return false;
  });

  const createFolder = useStableCallback(async (relativePath: string, workspaceId?: string): Promise<void> => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);

    if (adapter && typeof adapter.createFolder === 'function') {
      await adapter.createFolder(relativePath, workspaceId);

      
      const isCloudAdapter = adapter.constructor.name === 'CloudStorageAdapter';
      if (isCloudAdapter) {

        if (typeof (persistenceHook as { loadExplorerTree?: () => Promise<void> }).loadExplorerTree === 'function') {
          await (persistenceHook as { loadExplorerTree: () => Promise<void> }).loadExplorerTree();
        }
      } else {
        
        await persistenceHook.refreshMapList();
      }
    }
  });

  const renameItem = useStableCallback(async (path: string, newName: string): Promise<void> => {
    // Extract workspaceId from path (same pattern as deleteItem)
    const wsRe = /^\/?(ws_[^/]+|cloud)/;
    const wsMatch = wsRe.exec(path);
    const workspaceId = wsMatch ? wsMatch[1] : null;

    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter && typeof adapter.renameItem === 'function') {
      await adapter.renameItem(path, newName);
      await persistenceHook.refreshMapList();
    }
  });

  const deleteItem = useStableCallback(async (path: string): Promise<void> => {
    
    const wsRe = /^\/?(ws_[^/]+|cloud)/;
    const wsMatch = wsRe.exec(path);
    const workspaceId = wsMatch ? wsMatch[1] : null;

    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);

    if (adapter && typeof adapter.deleteItem === 'function') {
      await adapter.deleteItem(path);
      await persistenceHook.refreshMapList();
    }
  });


  const subscribeMarkdownFromNodes = useStableCallback((cb: (text: string) => void) => {
    return subscribeMd((text: string, source: string) => {
      if (source === 'nodes') cb(text);
    });
  });

  const moveItem = useStableCallback(async (sourcePath: string, targetFolderPath: string, workspaceId?: string | null): Promise<void> => {
    // Prefer explicitly provided workspaceId (from Explorer DnD event)
    let ws: string | null | undefined = workspaceId;
    if (!ws) {
      // Fallback: try to extract from sourcePath if it includes a workspace prefix
      const wsRe = /^\/?(ws_[^/]+|cloud)/;
      const wsMatch = wsRe.exec(sourcePath);
      ws = wsMatch ? wsMatch[1] : null;
    }

    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, ws ?? null);
    if (adapter && typeof adapter.moveItem === 'function') {
      await adapter.moveItem(sourcePath, targetFolderPath);
      await persistenceHook.refreshMapList();
    }
  });

  const readImageAsDataURL = useStableCallback(async (relativePath: string, workspaceId: string): Promise<string | null> => {

    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter && typeof adapter.readImageAsDataURL === 'function') {
      return await adapter.readImageAsDataURL(relativePath, workspaceId);
    }
    return null;
  });

  const getSelectedFolderLabel = useStableCallback((): string | null => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook);
    if (adapter && 'selectedFolderName' in (adapter as unknown as { selectedFolderName?: string })) {
      return (adapter as unknown as { selectedFolderName?: string }).selectedFolderName ?? null;
    }
    return null;
  });


  const getMapMarkdown = useStableCallback(async (id: MapIdentifier): Promise<string | null> => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, id.workspaceId);
    if (adapter && typeof adapter.getMapMarkdown === 'function') {
      try {
        return await adapter.getMapMarkdown(id);
      } catch {
        return null;
      }
    }
    return null;
  });

  const getMapLastModified = useStableCallback(async (id: MapIdentifier): Promise<number | null> => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, id.workspaceId);
    if (adapter && typeof adapter.getMapLastModified === 'function') {
      try {
        return await adapter.getMapLastModified(id);
      } catch {
        return null;
      }
    }
    return null;
  });


  const saveMapMarkdown = useStableCallback(async (id: MapIdentifier, markdown: string): Promise<void> => {
    const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, id.workspaceId);
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
  });

  
  const mapOperations = {
    createAndSelectMap: useStableCallback(async (title: string, workspaceId: string, category?: string): Promise<string> => {
      
      if (!workspaceId) {
        console.error('createAndSelectMap: workspaceId is required');
        throw new Error('workspaceId is required for creating a map');
      }

      
      
      let actualTitle: string;
      let actualCategory: string;

      if (title.includes('/')) {
        
        const parts = title.split('/').filter(Boolean);
        actualTitle = parts[parts.length - 1]; 
        actualCategory = parts.slice(0, -1).join('/'); 
      } else {
        
        actualTitle = title;
        actualCategory = category || '';
      }

      // mapIdentifier の初期値をストレージ別に決定
      // - cloud: R2のパスとして category/title を使う（.md なし）。
      // - local(markdown-folder): 同様に category/title を使う。
      const initialMapId = actualCategory ? `${actualCategory}/${actualTitle}` : actualTitle;
      const mapIdentifier: MapIdentifier = { mapId: initialMapId, workspaceId };

      // adapterを通じてファイルを作成
      const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
      if (!adapter) {
        console.error('createAndSelectMap: No storage adapter available');
        throw new Error('Storage adapter is not available');
      }

      if (adapter.saveMapMarkdown) {
        const initialMarkdown = `# ${actualTitle}\n`;
        try {
          await adapter.saveMapMarkdown(mapIdentifier, initialMarkdown);
          await persistenceHook.refreshMapList();
        } catch (error) {
          console.error('createAndSelectMap: Failed to save markdown file:', error);
          throw error;
        }
      } else {
        console.warn('createAndSelectMap: saveMapMarkdown not available on adapter');
      }

      logger.debug('createAndSelectMap: Adding map to list...');
      
      
      logger.debug('createAndSelectMap: Loading and selecting created map...');


      try {
        const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);
        const loadedMarkdown = adapter?.getMapMarkdown ? await adapter.getMapMarkdown(mapIdentifier) : null;

        if (loadedMarkdown) {
          const parseResult = MarkdownImporter.parseMarkdownToNodes(loadedMarkdown, {
            defaultCollapseDepth: settings.defaultCollapseDepth
          });

          
          const actualMapId = mapIdentifier.mapId;
          
          const parts = (actualMapId || '').split('/').filter(Boolean);
          const extractedCategory = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

          const now = new Date().toISOString();

          const loadedMapData: MindMapData = {
            title: actualTitle,
            category: extractedCategory || '',
            rootNodes: parseResult.rootNodes,
            createdAt: now,
            updatedAt: now,
            settings: {
              autoSave: true,
              autoLayout: true,
              showGrid: false,
              animationEnabled: true
            },
            mapIdentifier: { mapId: actualMapId, workspaceId: mapIdentifier.workspaceId }
          };

          actionsHook.selectMap(loadedMapData);
        }
      } catch (error) {
        console.error('createAndSelectMap: Failed to load created map:', error);
      }
      
      logger.debug('createAndSelectMap: Successfully created map:', mapIdentifier.mapId);
      return mapIdentifier.mapId;
    }),

    selectMapById: useStableCallback(async (target: MapIdentifier): Promise<boolean> => {
      const mapId = target.mapId;
      const workspaceId = target.workspaceId;

      // Do NOT trust cached allMindMaps content; always try to load fresh content
      // (cached list may be stale vs on-disk / stream-saved markdown)

      // Fallback: try to load markdown by id via adapter and parse
      // 重複実行を防ぐため、既に実行中の場合はスキップ
      const fallbackKey = `${workspaceId}:${mapId}`;
      const windowWithProgress = window as Window & { __selectMapFallbackInProgress?: Record<string, boolean> };
      if (windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey]) {
        return false;
      }
      // 実行中フラグを設定
      windowWithProgress.__selectMapFallbackInProgress = windowWithProgress.__selectMapFallbackInProgress || {};
      windowWithProgress.__selectMapFallbackInProgress[fallbackKey] = true;

      try {
        // Get adapter for the target workspace
        const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId);
        if (!adapter) {
          delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
          return false;
        }
        const text: string | null = adapter.getMapMarkdown ? await adapter.getMapMarkdown(target) : null;
        if (!text) {
          delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
          // ファイルがない場合はキャッシュも使わない（データが存在しない）
          logger.warn('⚠️ No file found for map:', mapId);
          return false;
        }

        // 再度チェック：他の処理で既にリストに追加されている可能性
        // ただし、キャッシュされたデータではなく、常にファイルから最新データを読み込む
        const existingMap = persistenceHook.allMindMaps.find(map => map.mapIdentifier.mapId === mapId && map.mapIdentifier.workspaceId === workspaceId);
        if (existingMap) {
          // キャッシュデータを使わず、ファイルから読み込んだ最新データを使用
          logger.debug('🔄 Found cached map but using fresh file data instead', { mapId, cached: existingMap.updatedAt });
          
        }
        
        const actualMapId = mapId;

        const parseResult = MarkdownImporter.parseMarkdownToNodes(text, {
          defaultCollapseDepth: settings.defaultCollapseDepth
        });
        const parts = (actualMapId || '').split('/').filter(Boolean);
        const category = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        
        // ファイルの実際の更新時刻を取得（自動保存トリガーを防ぐため）
        let fileLastModified: string;
        try {
          const lastModified = await adapter.getMapLastModified?.(target);
          fileLastModified = lastModified ? new Date(lastModified).toISOString() : new Date().toISOString();
        } catch {
          // getMapLastModifiedが利用できない場合は現在時刻を使用
          fileLastModified = new Date().toISOString();
        }
        
        const parsed: MindMapData = {
          title: mapId, // UIで表示されるタイトル
          category: category || '',
          rootNodes: parseResult.rootNodes,
          createdAt: fileLastModified,
          updatedAt: fileLastModified, // ファイルの実際の更新時刻を使用
          settings: {
            autoSave: true,
            autoLayout: true,
            showGrid: false,
            animationEnabled: true
          },
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

        delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/構造要素が見つかりません|見出しが見つかりません/.test(msg)) {
          statusMessages.customWarning(msg);
        } else {
          logger.error('Fallback error:', e);
        }
        delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
        return false;
      }
    }),

    updateMapMetadata: useStableCallback(async (target: MapIdentifier, updates: { title?: string; category?: string }): Promise<void> => {
      const mapId = target.mapId;
      // 現在選択中のマップの場合のみストアを更新
      if (dataHook.data?.mapIdentifier.mapId === mapId) {
        actionsHook.updateMapMetadata(target, updates);
      }
      
      // マップリストを常に更新（全マップ中から該当するマップを探して更新）
    }),

    addImportedMapToList: useStableCallback(async (mapData: MindMapData): Promise<void> => {
      await persistenceHook.addMapToList(mapData);
    })
  };

  // ファイル操作の統合
  const fileOperations = {
    exportCurrentMap: useStableCallback(() => {
      return actionsHook.exportData();
    }),

    importMap: useStableCallback(async (jsonData: string): Promise<boolean> => {
      const success = actionsHook.importData(jsonData);
      if (success && dataHook.data) {
        await persistenceHook.addMapToList(dataHook.data);
      }
      return success;
    })
  };

  // マップ一覧の初期化状態も返す
  const isReady = persistenceHook.isInitialized;

  // 通知付き移動関数
  const moveNodeWithNotification = useStableCallback((nodeId: string, newParentId: string) => {
    const result = dataHook.moveNode(nodeId, newParentId);
    if (result.success) {
      showNotification('success', 'ノードを移動しました');
    } else {
      showNotification('warning', result.reason || 'ノードの移動ができませんでした');
      logger.warn('moveNode constraint violation:', result.reason);
    }
  });

  const moveNodeWithPositionAndNotification = useStableCallback((nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
    const result = dataHook.moveNodeWithPosition(nodeId, targetNodeId, position);
    if (result.success) {
      showNotification('success', 'ノードを移動しました');
    } else {
      showNotification('warning', result.reason || 'ノードの移動ができませんでした');
      logger.warn('moveNodeWithPosition constraint violation:', result.reason);
    }
  });

  return {
    
    
    data: dataHook.data,
    normalizedData: dataHook.normalizedData,
    selectedNodeId: dataHook.selectedNodeId,
    editingNodeId: dataHook.editingNodeId,
    editText: dataHook.editText,
    editingMode: dataHook.editingMode,
    
    
    ui: uiHook.ui,
    
    
    canUndo: actionsHook.canUndo(),
    canRedo: actionsHook.canRedo(),
    
    
    allMindMaps: persistenceHook.allMindMaps,
    currentMapId: actionsHook.currentMapId,
    isReady,

    
    
    addNode: dataHook.addNode,
    updateNode: dataHook.updateNode,
    deleteNode: dataHook.deleteNode,
    moveNode: moveNodeWithNotification,
    moveNodeWithPosition: moveNodeWithPositionAndNotification,
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
    
    
    setZoom: uiHook.setZoom,
    setPan: uiHook.setPan,
    resetZoom: uiHook.resetZoom,
    closeAllPanels: uiHook.closeAllPanels,
    toggleSidebar: uiHook.toggleSidebar,
    setSidebarCollapsed: uiHook.setSidebarCollapsed,
    hideImageModal: uiHook.hideImageModal,
    showFileActionMenu: uiHook.showFileActionMenu,
    hideFileActionMenu: uiHook.hideFileActionMenu,

    
    undo: actionsHook.undo,
    redo: actionsHook.redo,

    
    ...mapOperations,
    
    
    ...fileOperations,

    
    selectRootFolder,
    getSelectedFolderLabel,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    readImageAsDataURL,
    explorerTree: (persistenceHook as { explorerTree?: import('@core/types').ExplorerItem | null }).explorerTree ?? null,
    workspaces: (persistenceHook as { workspaces?: Array<{ id: string; name: string }> }).workspaces || [],
    currentWorkspaceId: (persistenceHook as { currentWorkspaceId?: string | null }).currentWorkspaceId ?? null,
    addWorkspace: (persistenceHook as { addWorkspace?: () => Promise<void> }).addWorkspace,
    removeWorkspace: (persistenceHook as { removeWorkspace?: (id: string) => Promise<void> }).removeWorkspace,
    switchWorkspace: (persistenceHook as { switchWorkspace?: (workspaceId: string | null) => Promise<void> }).switchWorkspace,

    
    storageAdapter: persistenceHook.storageAdapter,
    getAdapterForWorkspace: (ws: string | null) => {
      try {
        const fn = (persistenceHook as { getAdapterForWorkspace?: (ws: string | null) => StorageAdapter | null })?.getAdapterForWorkspace;
        if (typeof fn === 'function') return fn(ws) || null;
      } catch {}
      return persistenceHook.storageAdapter || null;
    },
    refreshMapList: persistenceHook.refreshMapList,

    // Provide lightweight workspace-wide listing for KG vectorization
    getWorkspaceMapIdentifiers: useStableCallback(async (workspaceId?: string | null) => {
      try {
        const adapter: StorageAdapter | null = getAdapterForWorkspace(persistenceHook, workspaceId || (dataHook.data?.mapIdentifier?.workspaceId));
        if (adapter && typeof adapter.listMapIdentifiers === 'function') {
          const ids = await adapter.listMapIdentifiers();
          return Array.isArray(ids) ? ids : [];
        }
      } catch {}
      // Fallback to current in-memory list
      const ws = workspaceId || dataHook.data?.mapIdentifier?.workspaceId || null;
      return (persistenceHook.allMindMaps || [])
        .filter(m => (ws ? m.mapIdentifier?.workspaceId === ws : true))
        .map(m => ({ mapId: m.mapIdentifier.mapId, workspaceId: m.mapIdentifier.workspaceId }));
    }),

    
    getMapMarkdown,
    getMapLastModified,
    saveMapMarkdown,
    subscribeMarkdownFromNodes,
    
    onMapMarkdownInput: (text: string) => setFromEditor(text),
    
    getNodeIdByMarkdownLine: (line: number): string | null => {
      const map = lineToNodeIdRef.current || {};
      if (map[line]) return map[line];

      let bestLine = 0;
      for (const k of Object.keys(map)) {
        const ln = parseInt(k, 10);
        if (ln <= line && ln > bestLine) bestLine = ln;
      }
      return bestLine ? map[bestLine] : null;
    },

    // Get current markdown content from stream
    getCurrentMarkdownContent: useStableCallback(() => {
      return markdownStreamHook.stream.getMarkdown();
    }),

    setAutoSaveEnabled: setAutoSaveEnabledStable,

    // Force flush markdown stream (for immediate save)
    flushMarkdownStream: useStableCallback(async () => {
      await markdownStreamHook.stream.flush();
    })
  };
};
