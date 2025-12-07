import React, { useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport, useWindowGlobalsBridge, useMarkdownOperations, useEditorEffects, useCommandExecution } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { getRootNodes, getStoreState } from '../../hooks/useStoreSelectors';
import { findNodeById, findNodeInRoots, navigateLink } from '@mindmap/utils';
import { useMarkdownSync, resolveAnchorToNode } from '../../../markdown';
import ActivityBar from './common/ActivityBar';
import SidebarSection from './sections/SidebarSection';
import { useSidebarHandlers } from './useSidebarHandlers';
import { useExplorerFolderOps } from './useExplorerFolderOps';
import MindMapTopBar from './sections/MindMapTopBar';
import MindMapWorkspacePane from './sections/MindMapWorkspacePane';
import { useWorkspaceHandlers } from './useWorkspaceHandlers';
import FolderGuideModal from '../modals/FolderGuideModal';
import { useFolderGuide } from './useFolderGuide';
import SelectedNodeNotePanelSection from './sections/SelectedNodeNotePanelSection';
import MarkdownPanelSection from './sections/MarkdownPanelSection';
import { useNotification, useErrorHandler, useGlobalErrorHandlers } from '@shared/hooks';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { useTheme } from '../../../theme/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
// wrapper-only providers are imported in MindMapApp.tsx
import { MindMapController } from '@mindmap/controllers/MindMapController';
import { logger } from '@shared/utils';
import { useVim } from "../../../vim/context/vimContext";
import { useCommandPalette } from '@shared/hooks/ui/useCommandPalette';
import { useCommands } from '../../../../commands/system/useCommands';

// moved usage into MarkdownPanelSection

import type { MindMapNode, NodeLink, MapIdentifier } from '@shared/types';
// wrapper-only StorageConfig is used in MindMapApp.tsx

import { useShortcutHandlers } from './useShortcutHandlers';
import { useMindMapEventHandlers } from './useMindMapEventHandlers';
import { useMindMapViewportEffects } from './useMindMapViewportEffects';
import { MindMapAppModalsContainer } from './MindMapAppModalsContainer';
import { useNodeOperations } from './useNodeOperations';
import { useContextMenuHandlers } from './useContextMenuHandlers';
import VimStatusBar from '../VimStatusBar';

// props for wrapper are declared in MindMapApp.tsx

type MindMapControllerData = ReturnType<typeof useMindMap>;

interface MindMapAppContentProps {
  // Type: MindMap controller instance with all map operations
  mindMap: MindMapControllerData;
}

export const MindMapAppContent: React.FC<MindMapAppContentProps> = ({
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

  // Event handlers hook
  const {
    handleSelectFolder,
    handleContextMenuClose,
    handleTableEditorSave,
    handleOpenImageFile,
  } = useMindMapEventHandlers({
    data,
    editingTableNodeId,
    updateNode,
    handleCloseTableEditor,
    handleShowImageModal,
    showNotification,
    store,
    mindMap,
    handleSelectFolderFromHook,
    closeGuide,
    markDismissed,
  });

  const { showKeyboardHelper, setShowKeyboardHelper } = {
    showKeyboardHelper: uiStore.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  };

  // Node right-click is handled by event strategies; no local handler needed

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
  // Takes nodeId as parameter to track the correct node's note
  const subscribeNoteChanges = React.useCallback((nodeId: string, cb: (text: string) => void) => {
    // Subscribe to node note changes from store
    const unsubStore = useMindMapStore.subscribe(
      (state) => {
        const node = findNodeInRoots(state.data?.rootNodes || [], nodeId);
        return node?.note || '';
      },
      (note) => cb(note)
    );
    return unsubStore;
  }, []); // Empty deps - callback is now stable

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

  // Viewport effects hook
  useMindMapViewportEffects({
    selectedNodeId,
    data,
    uiStore,
    ensureSelectedNodeVisible,
    centerNodeInView,
    setZoom,
    setPan,
    autoEnsureVisible: false,
  });

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
        const st = getStoreState();
        const roots = getRootNodes();
        const sel = st.selectedNodeId;
        if (sel) {
          return roots.find(r => !!findNodeById(r, sel)) || roots[0] || null;
        }
        return roots[0] || null;
      },
      getAllRootNodes: () => getRootNodes().length > 0 ? getRootNodes() : null,
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
    ensureSelectedNodeVisible,
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
  // no-op: removed unused alias

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

  const { nodeOperations, findNode, handleCopyNode, handlePasteNode } = useNodeOperations({
    data,
    ui,
    updateNode,
    selectNode,
    deleteNode,
    showNotification,
  });

  const { handleMarkdownNodeType, handleAddLinkFromContextMenu } = useContextMenuHandlers({
    data,
    markdownSync,
    store,
    selectNode,
    handleContextMenuClose,
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

  const wsHandlers = useWorkspaceHandlers({
    selectNode,
    startEditing,
    finishEditing,
    addNode,
    addSiblingNode: useMindMapStore().addSiblingNode,
    deleteNode,
    toggleNodeCollapse,
    handleShowLinkActionMenu,
    handleAddLink,
    updateNode,
    applyAutoLayout,
    allMindMaps,
    data,
    handleLinkNavigate2,
  });

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

      {(() => {
        const sidebarHandlers = useSidebarHandlers({ selectMapById, selectNode, centerNodeInView, storageAdapter });
        return (
      <SidebarSection
        activeView={activeView}
        allMindMaps={allMindMaps}
        currentMapId={currentMapId}
        storageAdapter={storageAdapter || undefined}
        onSelectMap={async (id: MapIdentifier): Promise<void> => {
          
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
        onRenameMap={(id: MapIdentifier, title: string) => updateMapMetadata(id, { title })}
        onChangeCategory={(id: MapIdentifier, category: string) => updateMapMetadata(id, { category })}
        onChangeCategoryBulk={updateMultipleMapCategories}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onAddWorkspace={addWorkspace}
        onRemoveWorkspace={removeWorkspace}
        onSwitchWorkspace={switchWorkspace}
        explorerTree={(mindMap).explorerTree || { type: 'folder', name: '', path: '', children: [] }}
        onCreateFolder={useExplorerFolderOps(mindMap).handleCreateFolder}
        currentMapData={data}
        onMapSwitch={sidebarHandlers.onMapSwitch}
        onNodeSelectByLine={sidebarHandlers.onNodeSelectByLine}
      />
        );
      })()}

      <div className={`mindmap-main-content ${activeView ? 'with-sidebar' : ''}`}>
        <FolderGuideModal
          isOpen={showFolderGuide}
          onClose={closeGuide}
          onSelectFolder={async () => { await handleSelectFolder(); markDismissed(); }}
        />
        <MindMapTopBar
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
          <MindMapWorkspacePane
            data={data}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            setEditText={setEditText}
            onSelectNode={wsHandlers.onSelectNode}
            onStartEdit={wsHandlers.onStartEdit}
            onFinishEdit={wsHandlers.onFinishEdit}
            onAddChild={wsHandlers.onAddChild}
            onAddSibling={wsHandlers.onAddSibling}
            onDeleteNode={wsHandlers.onDeleteNode}
            onToggleCollapse={wsHandlers.onToggleCollapse}
            onShowLinkActionMenu={wsHandlers.onShowLinkActionMenu}
            onAddLink={wsHandlers.onAddLink}
            onUpdateNode={wsHandlers.onUpdateNode}
            onAutoLayout={wsHandlers.onAutoLayout}
            availableMaps={wsHandlers.availableMaps}
            currentMapData={wsHandlers.currentMapData}
            onLinkNavigate={wsHandlers.onLinkNavigate}
            zoom={uiStore.zoom}
            setZoom={setZoom}
            pan={uiStore.pan}
            setPan={setPan}
            onToggleLinkList={store.toggleLinkListForNode}
            onLoadRelativeImage={onLoadRelativeImage}
            onImageClick={handleShowImageModal}
          />

          {uiStore.showNotesPanel && (
            <MarkdownPanelSection
              data={data}
              mindMap={{
                getMapMarkdown: (mindMap).getMapMarkdown,
                onMapMarkdownInput: (mindMap).onMapMarkdownInput,
                subscribeMarkdownFromNodes: (mindMap).subscribeMarkdownFromNodes,
              }}
              onSelectNode={selectNode}
              onClose={() => store.setShowNotesPanel?.(false)}
            />
          )}

        </div>

        {uiStore.showNodeNotePanel && selectedNodeId && (
          <SelectedNodeNotePanelSection
            selectedNodeId={selectedNodeId}
            data={data}
            updateNode={updateNode}
            onClose={() => store.setShowNodeNotePanel?.(false)}
            subscribeNoteChanges={subscribeNoteChanges}
          />
        )}
        <VimStatusBar vim={vim} />
      </div>

      <MindMapAppModalsContainer
        showKeyboardHelper={showKeyboardHelper}
        setShowKeyboardHelper={setShowKeyboardHelper}
        showLinkModal={showLinkModal}
        linkModalNodeId={linkModalNodeId}
        editingLink={editingLink}
        showLinkActionMenu={showLinkActionMenu}
        linkActionMenuData={linkActionMenuData}
        showImageModal={showImageModal}
        currentImageUrl={currentImageUrl}
        currentImageAlt={currentImageAlt}
        showTableEditor={showTableEditor}
        editingTableNodeId={editingTableNodeId}
        isAuthModalOpen={isAuthModalOpen}
        authCloudAdapter={authCloudAdapter}
        showKnowledgeGraph={!!store.ui.showKnowledgeGraph}
        commandPaletteIsOpen={commandPalette.isOpen}
        commandPaletteClose={commandPalette.close}
        data={data}
        allMindMaps={allMindMaps}
        ui={ui}
        selectedNodeId={selectedNodeId}
        explorerTree={explorerTree}
        vim={vim}
        commands={commands}
        onCloseKeyboardHelper={() => setShowKeyboardHelper(false)}
        onCloseLinkModal={closeLinkModal}
        onSaveLink={handleSaveLink}
        onDeleteLink={handleDeleteLink}
        onLoadMapData={loadMapData}
        onCloseLinkActionMenu={closeLinkActionMenu}
        onNavigate={handleLinkNavigate2}
        onCloseContextMenu={handleContextMenuClose}
        onDeleteNode={deleteNode}
        onAddLink={(nodeId) => handleAddLinkFromContextMenu(nodeId, setLinkModalNodeId, setShowLinkModal)}
        onCopyNode={(nodeId) => {
          const node = findNode(nodeId);
          if (node) handleCopyNode(node);
        }}
        onPasteNode={async (parentId) => {
          await handlePasteNode(parentId);
          handleContextMenuClose();
        }}
        onEditTable={handleEditTable}
        onConvertToMap={handleConvertToMap}
        onMarkdownNodeType={handleMarkdownNodeType}
        onCloseImageModal={handleCloseImageModal}
        onShowImageModal={handleShowImageModal}
        onExecuteCommand={handleExecuteCommand}
        onSelectMap={selectMapById}
        onCloseTableEditor={handleCloseTableEditor}
        onTableEditorSave={handleTableEditorSave}
        onAuthModalClose={handleAuthModalClose}
        onAuthModalSuccess={handleAuthModalSuccess}
        onCloseKnowledgeGraph={() => store.setShowKnowledgeGraph?.(false)}
        nodeOperations={nodeOperations}
        storageAdapter={mindMap?.storageAdapter ?? undefined}
        mindMap={mindMap}
      />
    </div>
  );
};

// (moved wrapper to MindMapApp.tsx)

export default MindMapAppContent;
