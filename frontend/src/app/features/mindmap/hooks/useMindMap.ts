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
import { getAdapterForWorkspace } from '@/app/core/utils';
import { MarkdownMemoizer } from '@mindmap/utils/nodeHash';
import { useSettings } from './useStoreSelectors';
import { MarkdownConversionService } from '@mindmap/services/MarkdownConversionService';
import { PathResolutionService } from '@mindmap/services/PathResolutionService';
import { MapOperationsService } from '@mindmap/services/MapOperationsService';

export const useMindMap = (storageConfig?: StorageConfig, resetKey: number = 0) => {
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);
  const { showNotification } = useNotification();
  const settings = useSettings();

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
  const setAutoSaveEnabledStable = useStableCallback((enabled: boolean) => setAutoSaveEnabled(enabled));

  const mapWorkspaceId = dataHook.data?.mapIdentifier?.workspaceId;
  const stableAdapter = useMemo(() => getAdapterForWorkspace(persistenceHook, mapWorkspaceId), [persistenceHook, mapWorkspaceId]);

  const currentId = useMemo(() => {
    const wsId = dataHook.data?.mapIdentifier?.workspaceId;
    const mId = dataHook.data?.mapIdentifier?.mapId;
    return wsId && mId ? { workspaceId: wsId, mapId: mId } : null;
  }, [dataHook.data?.mapIdentifier?.workspaceId, dataHook.data?.mapIdentifier?.mapId]);

  const markdownStreamHook = useMarkdownStream(stableAdapter, currentId, { debounceMs: 200 });

  const stableMarkdownFunctions = useMemo(() => ({
    setFromEditor: markdownStreamHook.setFromEditor,
    setFromNodes: markdownStreamHook.setFromNodes,
    subscribe: markdownStreamHook.subscribe
  }), [markdownStreamHook.setFromEditor, markdownStreamHook.setFromNodes, markdownStreamHook.subscribe]);

  const { setFromEditor, setFromNodes, subscribe: subscribeMd } = stableMarkdownFunctions;
  const lineToNodeIdRef = useRef<Record<number, string>>({});
  const nodeIdToLineRef = useRef<Record<string, number>>({});
  const lastSentMarkdownRef = useRef<string>('');
  const markdownMemoizer = useRef(new MarkdownMemoizer());

  const subscribeMdRef = useLatestRef(subscribeMd);
  const dataRef = useLatestRef(dataHook.data);
  const updateNodeRef = useLatestRef(dataHook.updateNode);
  const applyAutoLayoutRef = useLatestRef(dataHook.applyAutoLayout);

  const skipNodeToMarkdownSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (skipNodeToMarkdownSyncTimer.current) {
        logger.debug('⏭️ Skipping nodes->markdown sync (editor change in progress)');
        return;
      }

      const rootNodes = dataHook.data?.rootNodes || [];
      const md = markdownMemoizer.current.convert(rootNodes, MarkdownImporter.convertNodesToMarkdown);
      const lastMd = lastSentMarkdownRef.current;
      const isChanged = md !== lastMd;

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
      logger.error('❌ Nodes->Markdown conversion error:', e);
    }
  }, [dataHook.data?.updatedAt, dataHook.data?.mapIdentifier.mapId, setFromNodes]);

  useEffect(() => {
    const unsub = subscribeMdRef.current(async (markdown: string, source: string) => {
      logger.debug('📨 useMindMap received markdown', {
        source,
        length: markdown.length,
        hash: markdown.slice(0, 50) + '...',
        dataUpdatedAt: dataRef.current?.updatedAt
      });
      try {
        if (source === 'external') lastSentMarkdownRef.current = markdown;

        const parsed = MarkdownImporter.parseMarkdownToNodes(markdown, {
          defaultCollapseDepth: settings.defaultCollapseDepth
        });

        const { lineToNode, nodeToLine } = MarkdownConversionService.buildLineMapping(parsed.rootNodes || []);
        lineToNodeIdRef.current = lineToNode;
        nodeIdToLineRef.current = nodeToLine;

        const currentData = dataRef.current;
        if (source === 'editor' && currentData) {
          logger.debug('🖊️ Processing editor change');

          if (skipNodeToMarkdownSyncTimer.current) clearTimeout(skipNodeToMarkdownSyncTimer.current);
          skipNodeToMarkdownSyncTimer.current = setTimeout(() => {
            skipNodeToMarkdownSyncTimer.current = null;
            logger.debug('✅ Editor change window closed, nodes->markdown sync re-enabled');
          }, 300);

          const safeRootNodes = Array.isArray(parsed?.rootNodes) ? parsed.rootNodes : [];
          const prevFlat = MarkdownConversionService.flattenNodes(currentData.rootNodes || []);
          const nextFlat = MarkdownConversionService.flattenNodes(safeRootNodes);
          const sameStructure = MarkdownConversionService.checkStructureMatch(prevFlat, nextFlat);

          if (sameStructure) {
            prevFlat.forEach((a, i) => {
              const b = nextFlat[i];
              if (!a.id) return;
              const updates: Partial<MindMapNode> = {};
              if (a.text !== b.text) updates.text = b.text;
              const aNote = a.note ?? '';
              const bNote = b.note ?? '';
              if (aNote !== bNote) updates.note = b.note ?? '';
              if (Object.keys(updates).length) updateNodeRef.current(a.id, updates);
            });
          } else {
            (dataHook as { setRootNodes: (nodes: MindMapNode[], options: { emit: boolean }) => void }).setRootNodes(safeRootNodes, { emit: true });
            try { applyAutoLayoutRef.current?.(); } catch (e) { logger.warn('auto layout failed', e as Error); }
          }
        }
      } catch (error) {
        logger.warn('Markdown parse failed; keeping existing nodes', error as Error);
      }
    });
    return () => { try { unsub(); } catch (e) { logger.warn('unsubscribe failed', e as Error); } };
  }, [subscribeMdRef, dataRef, updateNodeRef, applyAutoLayoutRef, dataHook, settings.defaultCollapseDepth]);

  const createAdapterOp = <T,>(
    method: keyof StorageAdapter,
    fallback: T,
    workspaceId?: string | null
  ) => async (...args: unknown[]): Promise<T> => {
    const adapter = getAdapterForWorkspace(persistenceHook, workspaceId ?? null);
    const fn = adapter?.[method];
    if (typeof fn === 'function') {
      try {
        return await (fn as (...args: unknown[]) => Promise<T>).apply(adapter, args);
      } catch (e) {
        logger.error(`${String(method)} failed:`, e);
        return fallback;
      }
    }
    return fallback;
  };

  const selectRootFolder = useStableCallback(async (): Promise<boolean> => {
    const adapter = getAdapterForWorkspace(persistenceHook);
    if (adapter?.addWorkspace) {
      await adapter.addWorkspace();
      await persistenceHook.refreshMapList();
      return true;
    }
    if (adapter?.selectRootFolder) {
      await adapter.selectRootFolder();
      await persistenceHook.refreshMapList();
      return true;
    }
    return false;
  });

  const createFolder = useStableCallback(async (relativePath: string, workspaceId?: string): Promise<void> => {
    const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter?.createFolder) {
      await adapter.createFolder(relativePath, workspaceId);
      const isCloudAdapter = adapter.constructor.name === 'CloudStorageAdapter';
      if (isCloudAdapter && typeof (persistenceHook as { loadExplorerTree?: () => Promise<void> }).loadExplorerTree === 'function') {
        await (persistenceHook as { loadExplorerTree: () => Promise<void> }).loadExplorerTree();
      } else {
        await persistenceHook.refreshMapList();
      }
    }
  });

  const extractWorkspaceId = (path: string): string | null =>
    MapOperationsService.extractWorkspaceId(path);

  const renameItem = useStableCallback(async (path: string, newName: string): Promise<void> => {
    const workspaceId = extractWorkspaceId(path);
    const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter?.renameItem) {
      await adapter.renameItem(path, newName);
      await persistenceHook.refreshMapList();
    }
  });

  const deleteItem = useStableCallback(async (path: string): Promise<void> => {
    const workspaceId = extractWorkspaceId(path);
    const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
    if (adapter?.deleteItem) {
      await adapter.deleteItem(path);
      await persistenceHook.refreshMapList();
    }
  });

  const moveItem = useStableCallback(async (sourcePath: string, targetFolderPath: string, workspaceId?: string | null): Promise<void> => {
    const ws = workspaceId || extractWorkspaceId(sourcePath);
    const adapter = getAdapterForWorkspace(persistenceHook, ws ?? null);
    if (adapter?.moveItem) {
      await adapter.moveItem(sourcePath, targetFolderPath);
      await persistenceHook.refreshMapList();
    }
  });

  const readImageAsDataURL = useStableCallback(createAdapterOp<string | null>('readImageAsDataURL', null));
  const getMapMarkdown = useStableCallback(createAdapterOp<string | null>('getMapMarkdown', null));
  const getMapLastModified = useStableCallback(createAdapterOp<number | null>('getMapLastModified', null));

  const saveMapMarkdown = useStableCallback(async (id: MapIdentifier, markdown: string): Promise<void> => {
    const adapter = getAdapterForWorkspace(persistenceHook, id.workspaceId);
    if (adapter?.saveMapMarkdown) {
      await adapter.saveMapMarkdown(id, markdown);
    } else {
      throw new Error('saveMapMarkdown not supported by current storage adapter');
    }
  });

  const subscribeMarkdownFromNodes = useStableCallback((cb: (text: string) => void) =>
    subscribeMd((text: string, source: string) => { if (source === 'nodes') cb(text); })
  );

  const getSelectedFolderLabel = useStableCallback((): string | null => {
    const adapter = getAdapterForWorkspace(persistenceHook);
    return (adapter as unknown as { selectedFolderName?: string })?.selectedFolderName ?? null;
  });

  const mapOperations = {
    createAndSelectMap: useStableCallback(async (title: string, workspaceId: string, category?: string): Promise<string> => {
      if (!workspaceId) throw new Error('workspaceId is required for creating a map');

      const { title: actualTitle, category: actualCategory } = PathResolutionService.parseTitleAndCategory(title, category);
      const initialMapId = actualCategory ? `${actualCategory}/${actualTitle}` : actualTitle;
      const mapIdentifier: MapIdentifier = { mapId: initialMapId, workspaceId };

      const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
      if (!adapter) throw new Error('Storage adapter is not available');

      if (adapter.saveMapMarkdown) {
        await adapter.saveMapMarkdown(mapIdentifier, `# ${actualTitle}\n`);
        await persistenceHook.refreshMapList();
      }

      try {
        const loadedMarkdown = await adapter.getMapMarkdown?.(mapIdentifier);
        if (loadedMarkdown) {
          const parseResult = MarkdownImporter.parseMarkdownToNodes(loadedMarkdown, {
            defaultCollapseDepth: settings.defaultCollapseDepth
          });
          const loadedMapData = MapOperationsService.createMapData(
            mapIdentifier.mapId,
            mapIdentifier.workspaceId,
            parseResult.rootNodes,
            new Date().toISOString(),
            actualTitle
          );
          actionsHook.selectMap(loadedMapData);
        }
      } catch (error) {
        logger.error('createAndSelectMap: Failed to load created map:', error);
      }

      return mapIdentifier.mapId;
    }),

    selectMapById: useStableCallback(async (target: MapIdentifier): Promise<boolean> => {
      const { mapId, workspaceId } = target;
      const fallbackKey = `${workspaceId}:${mapId}`;
      const windowWithProgress = window as Window & { __selectMapFallbackInProgress?: Record<string, boolean> };

      if (windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey]) return false;

      windowWithProgress.__selectMapFallbackInProgress = windowWithProgress.__selectMapFallbackInProgress || {};
      windowWithProgress.__selectMapFallbackInProgress[fallbackKey] = true;

      try {
        const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
        if (!adapter) {
          delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
          return false;
        }

        const text = await adapter.getMapMarkdown?.(target);
        // Treat null/undefined as missing; empty string is a valid (empty) file
        if (text == null) {
          delete windowWithProgress.__selectMapFallbackInProgress?.[fallbackKey];
          logger.warn('⚠️ No file found for map:', mapId);
          return false;
        }

        const parseResult = MarkdownImporter.parseMarkdownToNodes(text, {
          defaultCollapseDepth: settings.defaultCollapseDepth
        });

        const fileLastModified = await adapter.getMapLastModified?.(target)
          .then(ts => ts ? new Date(ts).toISOString() : new Date().toISOString())
          .catch(() => new Date().toISOString());

        const parsed = MapOperationsService.createMapData(mapId || '', workspaceId || '', parseResult.rootNodes, String(fileLastModified));
        actionsHook.selectMap(parsed);

        try {
          const stillNotExists = !persistenceHook.allMindMaps.find(m =>
            m.mapIdentifier.mapId === mapId && m.mapIdentifier.workspaceId === workspaceId
          );
          if (stillNotExists) await persistenceHook.addMapToList(parsed);
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
      if (dataHook.data?.mapIdentifier.mapId === target.mapId) {
        actionsHook.updateMapMetadata(target, updates);
      }
    }),

    addImportedMapToList: useStableCallback(async (mapData: MindMapData): Promise<void> => {
      await persistenceHook.addMapToList(mapData);
    })
  };

  const fileOperations = {
    exportCurrentMap: useStableCallback(() => actionsHook.exportData()),
    importMap: useStableCallback(async (jsonData: string): Promise<boolean> => {
      const success = actionsHook.importData(jsonData);
      if (success && dataHook.data) await persistenceHook.addMapToList(dataHook.data);
      return success;
    })
  };

  const moveNodeWithNotification = useStableCallback((nodeId: string, newParentId: string) => {
    const result = dataHook.moveNode(nodeId, newParentId);
    showNotification(result.success ? 'success' : 'warning', result.success ? 'ノードを移動しました' : (result.reason || 'ノードの移動ができませんでした'));
    if (!result.success) logger.warn('moveNode constraint violation:', result.reason);
  });

  const moveNodeWithPositionAndNotification = useStableCallback((nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
    const result = dataHook.moveNodeWithPosition(nodeId, targetNodeId, position);
    showNotification(result.success ? 'success' : 'warning', result.success ? 'ノードを移動しました' : (result.reason || 'ノードの移動ができませんでした'));
    if (!result.success) logger.warn('moveNodeWithPosition constraint violation:', result.reason);
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
    isReady: persistenceHook.isInitialized,
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
    getWorkspaceMapIdentifiers: useStableCallback(async (workspaceId?: string | null) => {
      try {
        const adapter = getAdapterForWorkspace(persistenceHook, workspaceId || dataHook.data?.mapIdentifier?.workspaceId);
        if (adapter?.listMapIdentifiers) {
          const ids = await adapter.listMapIdentifiers();
          return Array.isArray(ids) ? ids : [];
        }
      } catch {}
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
    getNodeIdByMarkdownLine: (line: number): string | null =>
      MarkdownConversionService.getNodeIdByLine(lineToNodeIdRef.current || {}, line),
    getCurrentMarkdownContent: useStableCallback(() => markdownStreamHook.stream.getMarkdown()),
    setAutoSaveEnabled: setAutoSaveEnabledStable,
    flushMarkdownStream: useStableCallback(async () => { await markdownStreamHook.stream.flush(); })
  };
};
