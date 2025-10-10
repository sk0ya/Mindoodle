import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapIdentifier } from '@shared/types';
import { useMindMapData } from './useMindMapData';
import { MarkdownImporter } from '@markdown/markdownImporter';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import { useDataReset, useNotification, useStableCallback, useLatestRef } from '@shared/hooks';
import { useStorageConfigChange } from '@file-management/hooks/useStorageConfigChange';
import { logger } from '@shared/utils';
import type { StorageConfig } from '@core/types';
import type { MindMapData } from '@shared/types';
import { useMarkdownStream } from '@markdown/hooks/useMarkdownStream';
import { statusMessages } from '@shared/utils';
import { useMindMapStore } from '@mindmap/store';
import { getAdapterForWorkspace } from '@/app/core/utils';

/**
 * 統合MindMapHook - 新しいアーキテクチャ
 * 
 * 専門化されたHookを組み合わせて完全なMindMap機能を提供
 * Single Responsibility Principleに従い、テスタブルで保守しやすい構造
 */
export const useMindMap = (
  storageConfig?: StorageConfig,
  resetKey: number = 0
) => {
  // 専門化されたHookを使用
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);
  const { showNotification } = useNotification();
  const settings = useMindMapStore((state) => state.settings);
  // const { mergeWithExistingNodes } = useMarkdownSync();

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

  // 自動保存機能
  const [, setAutoSaveEnabled] = useState(true);
  const setAutoSaveEnabledStable = useStableCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
  });

  // Stabilize adapter reference - get adapter for current map's workspace
  const mapWorkspaceId = dataHook.data?.mapIdentifier?.workspaceId;
  const stableAdapter = useMemo(() => {
    return getAdapterForWorkspace(persistenceHook, mapWorkspaceId);
  }, [persistenceHook, mapWorkspaceId]);

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

  // Keep latest references to avoid stale closures in subscription callbacks
  const subscribeMdRef = useLatestRef(subscribeMd);
  const dataRef = useLatestRef(dataHook.data);
  const updateNodeRef = useLatestRef(dataHook.updateNode);
  const applyAutoLayoutRef = useLatestRef(dataHook.applyAutoLayout);

  // Timer to prevent nodes->markdown sync after editor changes
  const skipNodeToMarkdownSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nodes -> markdown: only on confirmed updates (updatedAt changes)
  useEffect(() => {
    try {
      // Skip if we recently processed an editor change
      if (skipNodeToMarkdownSyncTimer.current) {
        logger.debug('⏭️ Skipping nodes->markdown sync (editor change in progress)');
        return;
      }

      const md = MarkdownImporter.convertNodesToMarkdown(dataHook.data?.rootNodes || []);

      // Debug: Compare in detail
      const lastMd = lastSentMarkdownRef.current;
      const isChanged = md !== lastMd;

      logger.debug('🔍 Nodes->Markdown comparison', {
        changed: isChanged,
        newLength: md.length,
        lastLength: lastMd.length,
        newHash: md.slice(0, 50) + '...',
        lastHash: lastMd.slice(0, 50) + '...',
        trigger: dataHook.data?.updatedAt
      });

      // Only send if markdown actually changed
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
  }, [dataHook.data?.updatedAt, dataHook.data?.mapIdentifier.mapId, setFromNodes]);

  // When markdown changes from editor, rebuild nodes (md -> nodes)
  // Keep this effect lightweight; heavy parsing only on 'editor' source
  useEffect(() => {
    const unsub = subscribeMdRef.current(async (markdown: string, source: string) => {
      logger.debug('📨 useMindMap received markdown', {
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

        const parsed = MarkdownImporter.parseMarkdownToNodes(markdown, {
          defaultCollapseDepth: settings.defaultCollapseDepth
        });

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
          logger.debug('🖊️ Processing editor change');
          // Clear existing timer and set new one to skip nodes->markdown sync for short period
          if (skipNodeToMarkdownSyncTimer.current) {
            clearTimeout(skipNodeToMarkdownSyncTimer.current);
          }
          skipNodeToMarkdownSyncTimer.current = setTimeout(() => {
            skipNodeToMarkdownSyncTimer.current = null;
            logger.debug('✅ Editor change window closed, nodes->markdown sync re-enabled');
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
            k?: string; // node kind (e.g., 'table')
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
                k: typeof n?.kind === 'string' ? n.kind : undefined,
              });
              if (n?.children?.length) flatten(n.children, out);
            }
            return out;
          };

          const prevFlat = flatten(currentData.rootNodes || []);
          const nextFlat = flatten(safeRootNodes);

          // sameStructure: t/lvl/ind/k must all match
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
              // if kind changed (e.g., to 'table'), treat as structural change
              if (a.k !== b.k) return false;
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
            // Structure changed: replace root nodes and record in history (including kind changes)
            (dataHook as any).setRootNodes(safeRootNodes, { emit: true });
            // Apply unified auto-layout after structural markdown changes.
            // Positions are not serialized to markdown, so this won't cause loops.
            try { applyAutoLayoutRef.current?.(); } catch {}
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
  const selectRootFolder = useStableCallback(async (): Promise<boolean> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook);
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
  });

  const createFolder = useStableCallback(async (relativePath: string, workspaceId?: string): Promise<void> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook, workspaceId);

    if (adapter && typeof adapter.createFolder === 'function') {
      await adapter.createFolder(relativePath, workspaceId);

      // Refresh explorer tree to show virtual folders
      const isCloudAdapter = adapter.constructor.name === 'CloudStorageAdapter';
      if (isCloudAdapter) {
        // For cloud, refresh only explorer tree (virtual folders)
        if (typeof (persistenceHook as any).loadExplorerTree === 'function') {
          await (persistenceHook as any).loadExplorerTree();
        }
      } else {
        // For local, refresh full map list
        await persistenceHook.refreshMapList();
      }
    }
  });

  const renameItem = useStableCallback(async (path: string, newName: string): Promise<void> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook);
    if (adapter && typeof adapter.renameItem === 'function') {
      await adapter.renameItem(path, newName);
      await persistenceHook.refreshMapList();
    }
  });

  const deleteItem = useStableCallback(async (path: string): Promise<void> => {
    // Extract workspaceId from path (e.g., /cloud/folder/file.md or /ws_xxx/folder/file.md)
    const wsMatch = path.match(/^\/?(ws_[^/]+|cloud)/);
    const workspaceId = wsMatch ? wsMatch[1] : null;

    const adapter: any = getAdapterForWorkspace(persistenceHook, workspaceId);

    if (adapter && typeof adapter.deleteItem === 'function') {
      await adapter.deleteItem(path);
      await persistenceHook.refreshMapList();
    }
  });

  // Stabilize markdown subscription to prevent excessive re-subscriptions
  const subscribeMarkdownFromNodes = useStableCallback((cb: (text: string) => void) => {
    return subscribeMd((text: string, source: any) => {
      if (source === 'nodes') cb(text);
    });
  });

  const moveItem = useStableCallback(async (sourcePath: string, targetFolderPath: string): Promise<void> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook);
    if (adapter && typeof adapter.moveItem === 'function') {
      await adapter.moveItem(sourcePath, targetFolderPath);
      await persistenceHook.refreshMapList();
    }
  });

  const readImageAsDataURL = useStableCallback(async (relativePath: string, workspaceId: string): Promise<string | null> => {
    // Resolve adapter per workspace when possible (cloud/local)
    const adapter: any = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter && typeof adapter.readImageAsDataURL === 'function') {
      return await adapter.readImageAsDataURL(relativePath, workspaceId);
    }
    return null;
  });

  const getSelectedFolderLabel = useStableCallback((): string | null => {
    const adapter: any = getAdapterForWorkspace(persistenceHook);
    if (adapter && 'selectedFolderName' in adapter) {
      return (adapter).selectedFolderName ?? null;
    }
    return null;
  });

  // Expose raw markdown fetch for current adapter (markdown mode only)
  const getMapMarkdown = useStableCallback(async (id: MapIdentifier): Promise<string | null> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook, id.workspaceId);
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
    const adapter: any = getAdapterForWorkspace(persistenceHook, id.workspaceId);
    if (adapter && typeof adapter.getMapLastModified === 'function') {
      try {
        return await adapter.getMapLastModified(id);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Save raw markdown for current adapter (markdown mode only)
  const saveMapMarkdown = useStableCallback(async (id: MapIdentifier, markdown: string): Promise<void> => {
    const adapter: any = getAdapterForWorkspace(persistenceHook, id.workspaceId);
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

  // マップ管理の高レベル操作（非同期対応）
  const mapOperations = {
    createAndSelectMap: useStableCallback(async (title: string, workspaceId: string, category?: string): Promise<string> => {
      // workspaceIdの検証
      if (!workspaceId) {
        console.error('createAndSelectMap: workspaceId is required');
        throw new Error('workspaceId is required for creating a map');
      }

      // If title contains '/', treat it as a full path (category/title)
      // Otherwise, use the provided category parameter
      let actualTitle: string;
      let actualCategory: string;

      if (title.includes('/')) {
        // title is a full path like "folder1/map1"
        const parts = title.split('/').filter(Boolean);
        actualTitle = parts[parts.length - 1]; // Last part is the title
        actualCategory = parts.slice(0, -1).join('/'); // Everything before is the category
      } else {
        // title is just the map name
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
      // map一覧を更新
      
      logger.debug('createAndSelectMap: Loading and selecting created map...');

      // 作成したファイルからマップをロードして選択
      try {
        const adapter: any = getAdapterForWorkspace(persistenceHook, workspaceId);
        const loadedMarkdown = await adapter.getMapMarkdown(mapIdentifier);

        if (loadedMarkdown) {
          const parseResult = MarkdownImporter.parseMarkdownToNodes(loadedMarkdown, {
            defaultCollapseDepth: settings.defaultCollapseDepth
          });

          // selectMapByIdと同じロジックでcategoryを抽出
          const actualMapId = mapIdentifier.mapId;
          // mapId からカテゴリを抽出
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
      if ((window as any).__selectMapFallbackInProgress?.[fallbackKey]) {
        return false;
      }
      // 実行中フラグを設定
      (window as any).__selectMapFallbackInProgress = (window as any).__selectMapFallbackInProgress || {};
      (window as any).__selectMapFallbackInProgress[fallbackKey] = true;

      try {
        // Get adapter for the target workspace
        const adapter: any = getAdapterForWorkspace(persistenceHook, workspaceId);
        if (!adapter) {
          delete (window as any).__selectMapFallbackInProgress[fallbackKey];
          return false;
        }
        const text: string | null = await (adapter.getMapMarkdown?.(target));
        if (!text) {
          delete (window as any).__selectMapFallbackInProgress[fallbackKey];
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
          // continue to use file data instead of cached data
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

        delete (window as any).__selectMapFallbackInProgress[fallbackKey];
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/構造要素が見つかりません|見出しが見つかりません/.test(msg)) {
          statusMessages.customWarning(msg);
        } else {
          logger.error('Fallback error:', e);
        }
        delete (window as any).__selectMapFallbackInProgress[fallbackKey];
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
    
    // UI操作
    setZoom: uiHook.setZoom,
    setPan: uiHook.setPan,
    resetZoom: uiHook.resetZoom,
    closeAllPanels: uiHook.closeAllPanels,
    toggleSidebar: uiHook.toggleSidebar,
    setSidebarCollapsed: uiHook.setSidebarCollapsed,
    hideImageModal: uiHook.hideImageModal,
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
    currentWorkspaceId: (persistenceHook as any).currentWorkspaceId,
    addWorkspace: (persistenceHook as any).addWorkspace,
    removeWorkspace: (persistenceHook as any).removeWorkspace,
    switchWorkspace: (persistenceHook as any).switchWorkspace,

    // Storage adapter access
    storageAdapter: persistenceHook.storageAdapter,
    refreshMapList: persistenceHook.refreshMapList,

    // markdown helpers
    getMapMarkdown,
    getMapLastModified,
    saveMapMarkdown,
    subscribeMarkdownFromNodes,
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
    setAutoSaveEnabled: setAutoSaveEnabledStable
  };
};
