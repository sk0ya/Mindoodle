import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport, useWindowGlobalsBridge, useMarkdownOperations, useEditorEffects, useCommandExecution } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { findNodeById, findNodeInRoots, navigateLink } from '@mindmap/utils';
import { nodeToMarkdown, useMarkdownSync, resolveAnchorToNode } from '../../../markdown';
import ActivityBar from './common/ActivityBar';
import PrimarySidebarContainer from './sidebar/PrimarySidebarContainer';
import TopLeftTitlePanel from './panel/TopLeftTitlePanel';
import MindMapWorkspaceContainer from './MindMapWorkspaceContainer';
import MindMapModals from '../modals/MindMapModals';
import FolderGuideModal from '../modals/FolderGuideModal';
import { useFolderGuide } from './useFolderGuide';
import MindMapLinkOverlays from './overlay/MindMapLinkOverlays';
import SelectedNodeNotePanel from '../panels/SelectedNodeNotePanel';
import MarkdownPanelContainer from './panel/NodeNotesPanelContainer';
import MindMapContextMenuOverlay from './overlay/MindMapContextMenuOverlay';
import ImageModal from '../modals/ImageModal';
import { useNotification, useErrorHandler, useGlobalErrorHandlers } from '@shared/hooks';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { useTheme } from '../../../theme/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
import MindMapProviders from './MindMapProviders';
import { MindMapController } from '@mindmap/controllers/MindMapController';
import { logger, statusMessages } from '@shared/utils';
import MindMapOverlays from './overlay/MindMapOverlays';
import './MindMapApp.css';
import { useVim, VimProvider } from "../../../vim/context/vimContext";
import { JumpyLabels } from "../../../vim";
import VimStatusBar from "../VimStatusBar";
import CommandPalette from '@shared/components/CommandPalette';
import { useCommandPalette } from '@shared/hooks/ui/useCommandPalette';
import { useCommands } from '../../../../commands/system/useCommands';
import { AuthModal } from '@shared/components';
import { mindMapEvents } from '@core/streams';

import { selectNodeIdByMarkdownLine } from '@mindmap/selectors/mindMapSelectors';
import TableEditorModal from '../../../markdown/components/TableEditorModal';
import { KnowledgeGraphModal2D } from '../modals/KnowledgeGraphModal2D';
import { EmbeddingIntegration } from '@core/services/EmbeddingIntegration';
import { parseWorkspacePath } from '@shared/utils/pathOperations';

import type { MindMapNode, NodeLink, MapIdentifier } from '@shared/types';
import type { StorageConfig } from '@core/types';

import { useShortcutHandlers } from './useShortcutHandlers';

interface MindMapAppProps {
  storageMode?: 'local' ;
  resetKey?: number;
}

type MindMapControllerData = ReturnType<typeof useMindMap>;

interface MindMapAppContentProps extends MindMapAppProps {
  // Type: MindMap controller instance with all map operations
  mindMap: MindMapControllerData;
}

const MindMapAppContent: React.FC<MindMapAppContentProps> = ({
  mindMap
}) => {

  const { showNotification } = useNotification();
  const { handleError } = useErrorHandler();
  const markdownSync = useMarkdownSync();

  const { loadSettingsFromStorage } = useMindMapStore();

  const vim = useVim();

  const store = useMindMapStore();

  useGlobalErrorHandlers(handleError);
  const {
    showLinkModal, setShowLinkModal,
    editingLink, setEditingLink,
    linkModalNodeId, setLinkModalNodeId,
    showLinkActionMenu,
    linkActionMenuData,
    closeLinkModal,
    openLinkActionMenu, closeLinkActionMenu,
    // Image modal
    showImageModal,
    currentImageUrl,
    currentImageAlt,
    handleShowImageModal,
    handleCloseImageModal,
    // Table editor
    showTableEditor,
    editingTableNodeId,
    handleEditTable,
    handleCloseTableEditor,
    // Auth modal
    isAuthModalOpen,
    authCloudAdapter,
    setAuthCloudAdapter,
    setAuthOnSuccess,
    setIsAuthModalOpen,
    handleAuthModalClose,
    handleAuthModalSuccess,
  } = useMindMapModals();

  const commandPalette = useCommandPalette({
    enabled: true,
    shortcut: 'ctrl+p'
  });

  const finishEditingWrapper = (nodeId: string, text?: string) => {
    if (text !== undefined) finishEditing(nodeId, text);
  };

  // Moved below until data is available

  useTheme();

  // Consolidated initialization: settings + auth modal bridge
  React.useEffect(() => {
    loadSettingsFromStorage();

    const controller = new MindMapController();
    const cleanup = controller.attachAuthModalBridge({
      setAuthCloudAdapter,
      setAuthOnSuccess,
      setIsAuthModalOpen,
    });

    return cleanup;
  }, [loadSettingsFromStorage, setAuthCloudAdapter, setAuthOnSuccess, setIsAuthModalOpen]);

  const { showFolderGuide, closeGuide, markDismissed } = useFolderGuide();

  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    ui,
    canUndo,
    canRedo,
    allMindMaps,
    currentMapId,

    // 統合されたハンドラー
    addNode,
    updateNode,
    deleteNode,
    // movement handled by strategies: moveNode, moveNodeWithPosition
    selectNode,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing,

    // UI操作
    closeAllPanels,
    setZoom,
    setPan,
    setEditText,
    // changeSiblingOrder handled by strategies
    toggleNodeCollapse,

    // マップ操作
    createAndSelectMap,
    selectMapById,
    updateMapMetadata,
    applyAutoLayout,

    // 履歴操作
    undo,
    redo,
    workspaces,
    currentWorkspaceId,
    addWorkspace,
    removeWorkspace,
    switchWorkspace,
    storageAdapter,
    refreshMapList,
    flushMarkdownStream
  } = mindMap;

  const uiStore = useMindMapStore().ui;
  const activeView = uiStore.activeView;
  const setActiveView = store.setActiveView;

  const explorerTree = (mindMap).explorerTree || null;
  useWindowGlobalsBridge({
    workspaces,
    addWorkspace,
    removeWorkspace,
    allMindMaps,
    currentMapId,
    currentWorkspaceId,
    explorerTree,
    selectMapById,
    mindMap,
  });

  const {
    loadMapData,
    onLoadRelativeImage,
    updateMultipleMapCategories,
    handleSelectFolder: handleSelectFolderFromHook,
  } = useMindMapFileOps({
    data,
    allMindMaps,
    mindMap: {
      readImageAsDataURL: (path: string, workspaceId?: string) => {
        if (typeof mindMap.readImageAsDataURL !== 'function') return Promise.resolve(null);
        const ws = workspaceId ?? (data?.mapIdentifier?.workspaceId ?? '');
        return mindMap.readImageAsDataURL(path, ws);
      },
      refreshMapList: mindMap.refreshMapList,
      selectRootFolder: mindMap.selectRootFolder,
    },
    showNotification,
  });

  const handleSelectFolder = React.useCallback(async () => {
    await handleSelectFolderFromHook(() => {
      closeGuide();
      markDismissed();
    });
  }, [handleSelectFolderFromHook, closeGuide, markDismissed]);


  const { showKeyboardHelper, setShowKeyboardHelper } = {
    showKeyboardHelper: uiStore.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  };




  // Node right-click is handled by event strategies; no local handler needed

  const handleContextMenuClose = useCallback(() => {
    // Type: Optional panel close method on store
    const storeWithPanels = store as unknown as { closePanel?: (panel: string) => void };
    storeWithPanels.closePanel?.('contextMenu');
    store.setShowContextMenu(false);
  }, [store]);

  const handleTableEditorSave = useCallback((newMarkdown: string) => {
    if (!editingTableNodeId) return;

    const node = findNodeInRoots(data?.rootNodes || [], editingTableNodeId);
    if (!node) return;

    updateNode(editingTableNodeId, { text: newMarkdown });
    handleCloseTableEditor();
    showNotification('success', 'テーブルを更新しました');
  }, [editingTableNodeId, data, updateNode, handleCloseTableEditor, showNotification]);

  const markdownOps = useMarkdownOperations({
    data,
    markdownSync,
    store,
    selectNode,
  });

  useEditorEffects({
    mindMap,
    showNotesPanel: uiStore.showNotesPanel,
    vim,
    editingNodeId,
  });

  useMindMapEvents({ mindMap, selectMapById });

  // Global image open handler from Explorer (map list)
  const handleOpenImageFile = useCallback((e: Event) => {
    const evt = e as CustomEvent;
    const path = evt?.detail?.path as (string | undefined);
    if (!path) return;
    try {
      const { workspaceId, relativePath } = parseWorkspacePath(path);
      const ws = workspaceId || data?.mapIdentifier?.workspaceId || '';
      if (!relativePath || !ws) return;
      // Ensure reader is available
      const reader = (mindMap as unknown as { readImageAsDataURL?: (p: string, ws: string) => Promise<string | null> }).readImageAsDataURL;
      if (typeof reader !== 'function') return;
      reader(relativePath, ws)
        .then((dataURL) => {
          if (dataURL) {
            const fileName = relativePath.split('/').pop() || 'image';
            handleShowImageModal(dataURL, fileName);
          }
        })
        .catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }, [mindMap, data?.mapIdentifier?.workspaceId, handleShowImageModal]);

  useEventListener('mindoodle:openImageFile', handleOpenImageFile, { target: window });

  const countNodes = (node: MindMapNode): number => {
    let count = 1; 
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

  const linkOps = useMindMapLinks({
    data,
    loadMapData,
    onOpenModal: (editingLink, nodeId) => {
      setEditingLink(editingLink);
      setLinkModalNodeId(nodeId);
      setShowLinkModal(true);
    },
    onUpdateNode: (nodeId, updates) => store.updateNode(nodeId, updates),
    onDeleteLink: (nodeId, linkId) => store.deleteNodeLink(nodeId, linkId),
    showNotification,
    handleError,
  });

  const clipboardOps = useMindMapClipboard({
    data,
    clipboard: uiStore.clipboard,
    selectedNodeId,
    storageAdapter,
    updateNode,
    addChildNode: (parentId: string, text: string) => {
      return store.addChildNode(parentId, text);
    },
    selectNode,
    showNotification,
    refreshMapList,
  });

  const viewportOps = useMindMapViewport({
    data,
    activeView,
    uiStore: {
      sidebarCollapsed: uiStore.sidebarCollapsed ?? false,
      showNotesPanel: uiStore.showNotesPanel ?? false,
      markdownPanelWidth: uiStore.markdownPanelWidth || 0,
      showNodeNotePanel: uiStore.showNodeNotePanel ?? false,
      nodeNotePanelHeight: uiStore.nodeNotePanelHeight || 0,
      zoom: uiStore.zoom,
      pan: uiStore.pan,
    },
    settings: store.settings || {},
    setPan,
  });

  // Stable subscription callback for SelectedNodeNotePanel
  const subscribeNoteChanges = React.useCallback((cb: (text: string) => void) => {
    // Subscribe to node note changes from store
    const unsubStore = useMindMapStore.subscribe(
      (state) => {
        if (!selectedNodeId) return '';
        const node = findNodeInRoots(state.data?.rootNodes || [], selectedNodeId);
        return node?.note || '';
      },
      (note) => {
        cb(note);
      }
    );
    return unsubStore;
  }, [selectedNodeId]);

  const handleAddLink = (nodeId: string) => linkOps.handleAddLink(nodeId);
  const handleSaveLink = async (linkData: Partial<NodeLink>) => {
    if (!linkModalNodeId) return;
    await linkOps.handleSaveLink(linkData, linkModalNodeId);
  };
  const handleDeleteLink = async (linkId: string) => {
    if (!linkModalNodeId) return;
    await linkOps.handleDeleteLink(linkModalNodeId, linkId);
  };

  const ensureSelectedNodeVisible = viewportOps.ensureSelectedNodeVisible;
  const centerNodeInView = viewportOps.centerNodeInView;

  const handleCenterRootNode = useCallback(() => {
    const roots = data?.rootNodes || [];
    if (roots.length === 0) return;
    if (selectedNodeId) {
      const root = roots.find((r: MindMapNode) => !!findNodeById(r, selectedNodeId)) || roots[0];
      centerNodeInView(root.id, false, { mode: 'left' });
    } else {
      centerNodeInView(roots[0].id, false, { mode: 'left' });
    }
  }, [data?.rootNodes, selectedNodeId, centerNodeInView]);

  // Consolidated viewport effects: ensure selected node visibility on UI changes
  React.useEffect(() => {
    if (!selectedNodeId) return;

    const raf = () => requestAnimationFrame(() => ensureSelectedNodeVisible());
    const timeoutId = window.setTimeout(raf, 0);

    const resizeHandler = () => { ensureSelectedNodeVisible(); };
    window.addEventListener('node-note-panel-resize', resizeHandler as EventListener);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('node-note-panel-resize', resizeHandler as EventListener);
    };
  }, [
    selectedNodeId,
    uiStore.showNodeNotePanel,
    uiStore.showNotesPanel,
    uiStore.nodeNotePanelHeight,
    ensureSelectedNodeVisible
  ]);

  // Center root node only once after map changes (avoid fighting user pan)
  const centeredAfterOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (!data?.rootNodes || data.rootNodes.length === 0) return;

    // Reset flag for the new map
    centeredAfterOpenRef.current = false;

    logger.debug('📍 Map changed, resetting zoom');
    setZoom(1.0);

    // Listen for first layout completion only
    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type !== 'layout.applied') return;
      if (centeredAfterOpenRef.current) return;
      // If user already has a selection, don’t recenter to avoid jump
      if (selectedNodeId) return;

      const roots = data.rootNodes || [];
      if (roots.length === 0) return;

      logger.debug('📍 First layout after open; centering root node (left)');
      centeredAfterOpenRef.current = true;
      // Small delay to ensure DOM is updated
      window.setTimeout(() => {
        centerNodeInView(roots[0].id, false, { mode: 'left' });
      }, 10);
      // Stop listening after the first center
      unsubscribe();
    });

    // Fallback: if no layout event, center once after a short delay
    const timer = window.setTimeout(() => {
      if (centeredAfterOpenRef.current) return;
      if (selectedNodeId) return;
      const roots = data.rootNodes || [];
      if (roots.length > 0) {
        logger.debug('📍 No layout event; centering root node (left) once');
        centeredAfterOpenRef.current = true;
        centerNodeInView(roots[0].id, false, { mode: 'left' });
        unsubscribe();
      }
    }, 100);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [data?.mapIdentifier?.mapId, data?.mapIdentifier?.workspaceId, centerNodeInView, setZoom]);

  const handleLinkNavigate2 = async (link: NodeLink) => {
    await navigateLink(link, {
      currentMapId,
      dataRoot: null,
      selectMapById,
      currentWorkspaceId: data?.mapIdentifier?.workspaceId as string,
      selectNode,
      centerNodeInView,
      notify: showNotification,
      getCurrentRootNode: () => {
        const st = useMindMapStore.getState();
        const roots = st.data?.rootNodes || [];
        const sel = st.selectedNodeId;
        if (sel) {
          return roots.find(r => !!findNodeById(r, sel)) || roots[0] || null;
        }
        return roots[0] || null;
      },
      getAllRootNodes: () => useMindMapStore.getState().data?.rootNodes || null,
      resolveAnchorToNode,
    });
  };

  const handleShowLinkActionMenu = openLinkActionMenu;

  const shortcutHandlers = useShortcutHandlers({
    data: null,
    ui,
    store,
    logger,
    showNotification,
    centerNodeInView,
    selectedNodeId,
    editingNodeId,
    setEditText,
    editText,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing: finishEditingWrapper,
    updateNode,
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectNode,
    setPan,
    pasteImageFromClipboard: clipboardOps.pasteImageFromClipboard,
    pasteNodeFromClipboard: clipboardOps.pasteNodeFromClipboard,
    changeNodeType: markdownOps.changeNodeType,
    changeSiblingOrder: store.changeSiblingOrder,
    getCurrentMarkdownContent: mindMap.getCurrentMarkdownContent,
  });

  // Type: Shortcut handlers match expected keyboard hook signature
  // Type-safe shortcut handler wiring via parameter inference
  type KeyboardShortcutHandlersT = Parameters<typeof useKeyboardShortcuts>[0];
  useKeyboardShortcuts(shortcutHandlers as unknown as KeyboardShortcutHandlersT, vim);
  const handleCloseLinkActionMenu = closeLinkActionMenu;

  type CommandsHandlers = Parameters<typeof useCommands>[0]['handlers'];
  const commands = useCommands({
    selectedNodeId,
    editingNodeId,
    vim,
    handlers: shortcutHandlers as unknown as CommandsHandlers, 
  });

  const { handleExecuteCommand } = useCommandExecution({
    commands,
    showNotification,
  });

  // Convert node to map handler - defined after commands is initialized
  const handleConvertToMap = useCallback(async (nodeId: string) => {
    try {
      handleContextMenuClose();

      // Step 1: Get node data with children from command
      const result = await commands.execute(`convert-node-to-map ${nodeId}`);
      if (!result.success) {
        showNotification('error', result.error || 'マップへの変換に失敗しました');
        return;
      }
      const { markdown, nodeText } = result.data as { markdown: string; nodeText: string; nodeId: string };
      logger.info('Step 1: Got node data with children');

      if (!storageAdapter?.saveMapMarkdown || !data?.mapIdentifier) {
        showNotification('error', 'ストレージアダプターが利用できません');
        return;
      }

      // Step 2: Remove children from the original node
      const node = findNodeInRoots(data?.rootNodes || [], nodeId);
      if (node && node.children && node.children.length > 0) {
        // Delete each child node individually
        for (const child of node.children) {
          deleteNode(child.id);
        }
        logger.info(`Step 2: Removed ${node.children.length} children from node`);
      } else {
        logger.info('Step 2: No children to remove');
      }

      // Step 3: Save the current map (with children removed)
      await flushMarkdownStream();
      logger.info('Step 3: Saved current map');

      // Step 4: Create new map file
      const { sanitizeAndEnsureUnique } = await import('@mindmap/utils/fileNameUtils');
      const existingNames = new Set(
        allMindMaps
          .filter((m) => m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId)
          .map((m) => m.mapIdentifier.mapId.split('/').pop() || '')
      );
      const sanitizedName = sanitizeAndEnsureUnique(nodeText, existingNames);
      if (!currentMapId) {
        showNotification('error', '現在のマップIDが取得できません');
        return;
      }
      const mapIdParts = currentMapId.split('/');
      const folderPath = mapIdParts.length > 1 ? mapIdParts.slice(0, -1).join('/') : '';
      const newMapId = folderPath ? `${folderPath}/${sanitizedName}` : sanitizedName;
      const newMapIdentifier = {
        mapId: newMapId,
        workspaceId: data.mapIdentifier.workspaceId
      };
      await storageAdapter.saveMapMarkdown(newMapIdentifier, markdown);
      logger.info('Step 4: Created new map file');

      // Step 5: Open the new map
      await refreshMapList();
      await selectMapById(newMapIdentifier);
      logger.info('Step 5: Opened new map');

      showNotification('success', `マップ「${sanitizedName}」を作成しました`);
    } catch (error) {
      logger.error('handleConvertToMap error:', error);
      showNotification('error', 'マップへの変換中にエラーが発生しました');
    }
  }, [commands, handleContextMenuClose, showNotification, allMindMaps, data, currentMapId, storageAdapter, refreshMapList, selectMapById, deleteNode, flushMarkdownStream]);

  return (
    <div
      className="mindmap-app"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <ActivityBar
        activeView={activeView}
        onViewChange={setActiveView}
        onShowKeyboardHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
      />

      <PrimarySidebarContainer
        activeView={activeView}
        allMindMaps={allMindMaps}
        currentMapId={currentMapId}
        storageAdapter={storageAdapter || undefined}
        onSelectMap={async (id) => {
          
          logger.debug('🖱️ Map clicked:', {
            clickedMapId: id.mapId,
            clickedWorkspaceId: id.workspaceId,
            currentMapId,
            currentWorkspaceId: data?.mapIdentifier?.workspaceId,
            isMapIdSame: currentMapId === id.mapId,
            isWorkspaceIdSame: data?.mapIdentifier?.workspaceId === id.workspaceId
          });

          
          if (currentMapId === id.mapId &&
            data?.mapIdentifier?.workspaceId === id.workspaceId) {
            logger.debug('🔄 Same map already selected, skipping:', id.mapId);
            return;
          }
          await selectMapById(id);
        }}
        onCreateMap={(title: string, workspaceId: string, category?: string) => {
          return createAndSelectMap(title, workspaceId, category);
        }}
        onRenameMap={(id, title) => updateMapMetadata(id, { title })}
        onChangeCategory={(id, category) => updateMapMetadata(id, { category })}
        onChangeCategoryBulk={updateMultipleMapCategories}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onAddWorkspace={addWorkspace}
        onRemoveWorkspace={removeWorkspace}
        onSwitchWorkspace={switchWorkspace}
        explorerTree={(mindMap).explorerTree || { type: 'folder', name: '', path: '', children: [] }}
        onCreateFolder={async (path: string) => {
          if (typeof (mindMap).createFolder === 'function') {
            // Parse leading workspace segment without regex
            const trimmed = String(path || '').replace(/^\/+/, '');
            const parts = trimmed.split('/');
            const first = parts[0];
            if (first && (first.startsWith('ws_') || first === 'cloud')) {
              const workspaceId = first;
              const relativePath = parts.slice(1).join('/');
              await (mindMap).createFolder(relativePath, workspaceId);
            } else {
              // フォールバック: 相対パスとして処理
              await (mindMap).createFolder(path);
            }
          }
        }}
        currentMapData={data}
        onMapSwitch={useCallback(
          async (targetMapIdentifier: MapIdentifier) => {
            const currentMapData = useMindMapStore.getState().data;

            // Skip if same map is already selected
            if (currentMapData?.mapIdentifier?.mapId === targetMapIdentifier.mapId &&
                currentMapData?.mapIdentifier?.workspaceId === targetMapIdentifier.workspaceId) {
              return;
            }

            await selectMapById(targetMapIdentifier);
          },
          [selectMapById])}

        onNodeSelectByLine={useCallback(
          async (lineNumber: number) => {
            const currentMapData = useMindMapStore.getState().data;

            if (!currentMapData || !storageAdapter) return;

            try {
              // ノードツリーを走査して、markdownMeta.lineNumberが一致するノードを見つける
              let foundNodeId: string | null = null;

              // Type: Node array with optional markdownMeta property
              const findNodeByMarkdownLine = (nodes: MindMapNode[]): boolean => {
                for (const node of nodes) {
                  // markdownMetaに保存されている行番号を確認
                  const nodeLineNumber = node.markdownMeta?.lineNumber;

                  // lineNumberは0-based、検索結果のlineNumberは1-based
                  if (typeof nodeLineNumber === 'number' && nodeLineNumber + 1 === lineNumber) {
                    foundNodeId = node.id;
                    return true;
                  }

                  if (node.children && node.children.length > 0 &&
                      findNodeByMarkdownLine(node.children)) {
                    return true;
                  }
                }
                return false;
              };

              findNodeByMarkdownLine(currentMapData.rootNodes || []);

              if (foundNodeId) {
                selectNode(foundNodeId);
                centerNodeInView(foundNodeId, false);
              }
            } catch (error) {
              console.error('Error finding node by line number:', error);
            }
          },
          [selectNode, centerNodeInView, storageAdapter])}
      />

      <div className={`mindmap-main-content ${activeView ? 'with-sidebar' : ''}`}>
        <FolderGuideModal
          isOpen={showFolderGuide}
          onClose={closeGuide}
          onSelectFolder={async () => { await handleSelectFolder(); markDismissed(); }}
        />
        <TopLeftTitlePanel
          title={data?.title || ''}
          activeView={activeView}
          sidebarCollapsed={uiStore.sidebarCollapsed}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={uiStore.zoom}
          onZoomReset={() => setZoom(1.0)}
          onAutoLayout={() => {
            logger.info('Manual auto layout triggered');
            if (typeof mindMap.applyAutoLayout === 'function') {
              mindMap.applyAutoLayout();
            } else {
              logger.error('applyAutoLayout function not available');
            }
          }}
          onToggleNotesPanel={() => store.toggleNotesPanel()}
          showNotesPanel={uiStore.showNotesPanel}
          onToggleNodeNotePanel={() => store.toggleNodeNotePanel?.()}
          showNodeNotePanel={!!uiStore.showNodeNotePanel}
          onCenterRootNode={handleCenterRootNode}
        />

        <div className="workspace-container">
          <MindMapWorkspaceContainer
            data={data}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            setEditText={setEditText}
            onSelectNode={(nodeId) => {
              selectNode(nodeId);
            }}
            onStartEdit={startEditing}
            onFinishEdit={finishEditing}
            
            onAddChild={(parentId) => { addNode(parentId); }}
            onAddSibling={(nodeId) => { store.addSiblingNode(nodeId); }}
            onDeleteNode={deleteNode}
            onToggleCollapse={toggleNodeCollapse}
            onShowLinkActionMenu={handleShowLinkActionMenu}
            onAddLink={handleAddLink}
            onUpdateNode={updateNode}
            onAutoLayout={applyAutoLayout}
            availableMaps={allMindMaps.map((map: import('@shared/types').MindMapData) => ({
              id: map.mapIdentifier.mapId,
              title: map.title,
            }))}
            currentMapData={data}
            onLinkNavigate={handleLinkNavigate2}
            zoom={uiStore.zoom}
            setZoom={setZoom}
            pan={uiStore.pan}
            setPan={setPan}
            onToggleLinkList={store.toggleLinkListForNode}
            onLoadRelativeImage={onLoadRelativeImage}
            onImageClick={handleShowImageModal}
          />

          {uiStore.showNotesPanel && (
            <MarkdownPanelContainer
              currentMapIdentifier={data ? data.mapIdentifier : null}
              getMapMarkdown={(mindMap).getMapMarkdown}
              onMapMarkdownInput={(mindMap).onMapMarkdownInput}
              subscribeMarkdownFromNodes={(mindMap).subscribeMarkdownFromNodes}
              getNodeIdByMarkdownLine={(line: number) => {
                try {
                  return selectNodeIdByMarkdownLine(data?.rootNodes || [], line);
                } catch { return null; }
              }}
              onSelectNode={selectNode}
            />
          )}

          

          {uiStore.showNodeNotePanel && (
            <SelectedNodeNotePanel
              nodeId={selectedNodeId}
              nodeTitle={(selectedNodeId ? (findNodeInRoots(data?.rootNodes || [], selectedNodeId)?.text || '') : '')}
              note={(selectedNodeId ? (findNodeInRoots(data?.rootNodes || [], selectedNodeId)?.note || '') : '')}
              onChange={(val) => {
                if (selectedNodeId) updateNode(selectedNodeId, { note: val });
              }}
              onClose={() => store.setShowNodeNotePanel?.(false)}
              subscribeNoteChanges={subscribeNoteChanges}
            />
          )}
        </div>
      </div>

      <MindMapModals
        ui={ui}
        selectedNodeId={selectedNodeId}
        nodeOperations={{
          findNode: (nodeId: string) => findNodeInRoots(data?.rootNodes || [], nodeId),
          onDeleteNode: deleteNode,
          onUpdateNode: updateNode,
          onCopyNode: (node: MindMapNode) => {
            // 内部クリップボードに保存
            store.setClipboard(node);
            // システムクリップボードにMarkdownで書き出し
            navigator.clipboard?.writeText?.(nodeToMarkdown(node)).catch(() => { });
            showNotification('success', `「${node.text}」をコピーしました`);
          },
          onPasteNode: async (parentId: string) => {
            const { pasteFromClipboard } = await import('../../utils/clipboardPaste');
            await pasteFromClipboard(parentId, ui.clipboard, store.addChildNode, updateNode, selectNode, showNotification);
          },
          onAddChild: (parentId: string, text?: string) => {
            return store.addChildNode(parentId, text || 'New Node');
          }
        }}
        uiOperations={{
          onCloseContextMenu: closeAllPanels,
          onCloseImageModal: handleCloseImageModal,
          onCloseFileActionMenu: closeAllPanels,
          onShowImageModal: handleShowImageModal
        }}
      />

      <MindMapOverlays
        showKeyboardHelper={showKeyboardHelper}
        setShowKeyboardHelper={setShowKeyboardHelper}
      />

      <JumpyLabels vim={vim} />
      <VimStatusBar vim={vim} />

      <MindMapLinkOverlays
        allMaps={allMindMaps.map((map: import('@shared/types').MindMapData) => ({
          mapIdentifier: map.mapIdentifier,
          title: map.title,
        }))}
        currentMapData={data}
        showLinkModal={showLinkModal}
        linkModalNodeId={linkModalNodeId}
        editingLink={editingLink}
        onCloseLinkModal={closeLinkModal}
        onSaveLink={handleSaveLink}
        onDeleteLink={handleDeleteLink}
        onLoadMapData={loadMapData}
        loadExplorerTree={async () => explorerTree}
        showLinkActionMenu={showLinkActionMenu}
        linkActionMenuData={linkActionMenuData}
        onCloseLinkActionMenu={handleCloseLinkActionMenu}
        onNavigate={handleLinkNavigate2}
      />

      {}

      <MindMapContextMenuOverlay
        dataRoot={data?.rootNodes?.[0] || null}
        dataRoots={data?.rootNodes || []}
        onDelete={deleteNode}
        onAddLink={(nodeId) => {
          setLinkModalNodeId(nodeId);
          setShowLinkModal(true);
          handleContextMenuClose();
        }}
        onCopyNode={(nodeId) => {
          const nodeToFind = findNodeInRoots(data?.rootNodes || [], nodeId);
          if (!nodeToFind) return;
          store.setClipboard(nodeToFind);
          const markdownText = nodeToMarkdown(nodeToFind);
          navigator.clipboard?.writeText?.(markdownText).catch(() => { });
          showNotification('success', `「${nodeToFind.text}」をコピーしました`);
        }}
        onPasteNode={async (parentId: string) => {
          const { pasteFromClipboard } = await import('../../utils/clipboardPaste');
          await pasteFromClipboard(parentId, ui.clipboard, store.addChildNode, updateNode, selectNode, showNotification);
          handleContextMenuClose();
        }}
        onEditTable={handleEditTable}
        onConvertToMap={handleConvertToMap}
        commandRegistry={commands.registry}
        commandContext={commands.context}
        onMarkdownNodeType={(nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => {
          if (data?.rootNodes?.[0]) {
            
            handleContextMenuClose();

            // Type: changeNodeType callback receives nodes or error object
            markdownSync.changeNodeType(data.rootNodes, nodeId, newType, (updatedNodes) => {
              const nodesWithError = updatedNodes as unknown as { __conversionError?: string };
              if (nodesWithError.__conversionError) {
                const errorMessage = nodesWithError.__conversionError;
                let typeDisplayName: string;
                if (newType === 'heading') typeDisplayName = '見出し';
                else if (newType === 'unordered-list') typeDisplayName = '箇条書きリスト';
                else typeDisplayName = '番号付きリスト';
                statusMessages.customError(`${typeDisplayName}への変換に失敗しました: ${errorMessage}`);
                return;
              }

              // Type: Store extension with setRootNodes method
              const storeWithSetRootNodes = store as unknown as {
                setRootNodes: (nodes: MindMapNode[], options: { emit: boolean; source: string }) => void;
              };
              storeWithSetRootNodes.setRootNodes(updatedNodes, { emit: true, source: 'contextMenu.changeNodeType' });
              
              try { store.applyAutoLayout(); } catch {}
              
              setTimeout(() => {
                try { selectNode(nodeId); } catch {  }
              }, 0);
            });
          }
        }}
        onAIGenerate={undefined}
        onClose={handleContextMenuClose}
      />

      {}
      <ImageModal
        isOpen={showImageModal}
        imageUrl={currentImageUrl}
        altText={currentImageAlt}
        onClose={handleCloseImageModal}
      />

      {}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onExecuteCommand={handleExecuteCommand}
        onSelectMap={async (mapId) => {
          await selectMapById(mapId);
        }}
        storageAdapter={mindMap?.storageAdapter ?? undefined}
      />

      {}
      {isAuthModalOpen && authCloudAdapter && (
        <AuthModal
          isOpen={isAuthModalOpen}
          cloudAdapter={authCloudAdapter}
          onClose={handleAuthModalClose}
          onSuccess={handleAuthModalSuccess}
        />
      )}

      {}
      <TableEditorModal
        isOpen={showTableEditor}
        onClose={handleCloseTableEditor}
        onSave={handleTableEditorSave}
        initialMarkdown={
          editingTableNodeId
            ? (findNodeInRoots(data?.rootNodes || [], editingTableNodeId)?.text || '')
            : ''
        }
      />

      {/* Knowledge Graph Modal */}
      <KnowledgeGraphModal2D
        isOpen={!!store.ui.showKnowledgeGraph}
        onClose={() => store.setShowKnowledgeGraph?.(false)}
        mapIdentifier={data?.mapIdentifier || null}
        getMapMarkdown={mindMap.getMapMarkdown}
        getWorkspaceMapIdentifiers={(mindMap)?.getWorkspaceMapIdentifiers}
      />

      {/* Embedding Integration (監視のみ、レンダリングなし) */}
      <EmbeddingIntegration />
    </div>
  );
};

// Wrapper component that handles mindMap creation and VimProvider setup
const MindMapAppWrapper: React.FC<MindMapAppProps> = (props) => {
  const { resetKey = 0 } = props;
  const [internalResetKey, setInternalResetKey] = useState(resetKey);
  const store = useMindMapStore();

  // Sync external resetKey with internal resetKey
  React.useEffect(() => {
    setInternalResetKey(resetKey);
  }, [resetKey]);

  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    return {
      mode: store.settings.storageMode,
      cloudApiEndpoint: store.settings.cloudApiEndpoint
    } as StorageConfig;
  }, [store.settings.storageMode, store.settings.cloudApiEndpoint]);

  // Create mindMap instance first
  const mindMap = useMindMap(storageConfig, Math.max(resetKey, internalResetKey));

  // Make Explorer's createFolder and createAndSelectMap available globally for Vim
  React.useEffect(() => {
    try {
      const controller = new MindMapController();
      controller.attachExplorerGlobals(mindMap);
    } catch {  }
  }, [mindMap]);

  return (
    <VimProvider mindMap={mindMap}>
      <MindMapAppContent {...props} mindMap={mindMap} />
    </VimProvider>
  );
};

const MindMapApp: React.FC<MindMapAppProps> = (props) => {
  return (
    <MindMapProviders>
      <MindMapAppWrapper {...props} />
    </MindMapProviders>
  );
};

export default MindMapApp;
