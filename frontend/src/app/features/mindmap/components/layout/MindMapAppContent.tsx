import React, { useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport, useWindowGlobalsBridge, useMarkdownOperations, useEditorEffects, useCommandExecution } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { findNodeById, findNodeInRoots, navigateLink } from '@mindmap/utils';
import { useMarkdownSync, resolveAnchorToNode } from '../../../markdown';
import ActivityBar from './common/ActivityBar';
import PrimarySidebarContainer from './sidebar/PrimarySidebarContainer';
import TopLeftTitlePanel from './panel/TopLeftTitlePanel';
import MindMapWorkspaceContainer from './MindMapWorkspaceContainer';
import FolderGuideModal from '../modals/FolderGuideModal';
import { useFolderGuide } from './useFolderGuide';
import SelectedNodeNotePanel from '../panels/SelectedNodeNotePanel';
import MarkdownPanelContainer from './panel/NodeNotesPanelContainer';
import { useNotification, useErrorHandler, useGlobalErrorHandlers } from '@shared/hooks';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { useTheme } from '../../../theme/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
import { MindMapController } from '@mindmap/controllers/MindMapController';
import { logger } from '@shared/utils';
import { useVim } from "../../../vim/context/vimContext";
import { useCommandPalette } from '@shared/hooks/ui/useCommandPalette';
import { useCommands } from '../../../../commands/system/useCommands';

import type { MindMapNode, NodeLink, MapIdentifier } from '@shared/types';

import { useShortcutHandlers } from './useShortcutHandlers';
import { useMindMapEventHandlers } from './useMindMapEventHandlers';
import { useMindMapViewportEffects } from './useMindMapViewportEffects';
import { MindMapAppModalsContainer } from './MindMapAppModalsContainer';
import { useNodeOperations } from './useNodeOperations';
import { useContextMenuHandlers } from './useContextMenuHandlers';

type MindMapControllerData = ReturnType<typeof useMindMap>;

interface MindMapAppContentProps {
  mindMap: MindMapControllerData;
}

const MindMapAppContent: React.FC<MindMapAppContentProps> = ({ mindMap }) => {
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
    showImageModal,
    currentImageUrl,
    currentImageAlt,
    handleShowImageModal,
    handleCloseImageModal,
    showTableEditor,
    editingTableNodeId,
    handleEditTable,
    handleCloseTableEditor,
    isAuthModalOpen,
    authCloudAdapter,
    setAuthCloudAdapter,
    setAuthOnSuccess,
    setIsAuthModalOpen,
    handleAuthModalClose,
    handleAuthModalSuccess,
  } = useMindMapModals();

  const commandPalette = useCommandPalette({ enabled: true, shortcut: 'ctrl+p' });

  useTheme();

  React.useEffect(() => {
    loadSettingsFromStorage();
    const controller = new MindMapController();
    const cleanup = controller.attachAuthModalBridge({ setAuthCloudAdapter, setAuthOnSuccess, setIsAuthModalOpen });
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
    addNode,
    updateNode,
    deleteNode,
    selectNode,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing,
    setZoom,
    setPan,
    setEditText,
    toggleNodeCollapse,
    createAndSelectMap,
    selectMapById,
    updateMapMetadata,
    applyAutoLayout,
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
  const setActiveView = useMindMapStore().setActiveView;

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

  const { loadMapData, onLoadRelativeImage, updateMultipleMapCategories, handleSelectFolder: handleSelectFolderFromHook } = useMindMapFileOps({
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

  const { handleSelectFolder, handleContextMenuClose, handleTableEditorSave, handleOpenImageFile } = useMindMapEventHandlers({
    data,
    editingTableNodeId,
    updateNode,
    handleCloseTableEditor,
    handleShowImageModal,
    showNotification,
    store: useMindMapStore(),
    mindMap,
    handleSelectFolderFromHook,
    closeGuide,
    markDismissed,
  });

  const { showKeyboardHelper, setShowKeyboardHelper } = {
    showKeyboardHelper: uiStore.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => useMindMapStore().setShowShortcutHelper(show)
  };

  const markdownOps = useMarkdownOperations({ data, markdownSync, store: useMindMapStore(), selectNode });

  useEditorEffects({ mindMap, showNotesPanel: uiStore.showNotesPanel, vim, editingNodeId });
  useMindMapEvents({ mindMap, selectMapById });
  useEventListener('mindoodle:openImageFile', handleOpenImageFile, { target: window });

  const linkOps = useMindMapLinks({
    data,
    loadMapData,
    onOpenModal: (editingLink, nodeId) => { setEditingLink(editingLink); setLinkModalNodeId(nodeId); setShowLinkModal(true); },
    onUpdateNode: (nodeId, updates) => useMindMapStore().updateNode(nodeId, updates),
    onDeleteLink: (nodeId, linkId) => useMindMapStore().deleteNodeLink(nodeId, linkId),
    showNotification,
    handleError,
  });

  const clipboardOps = useMindMapClipboard({
    data,
    clipboard: uiStore.clipboard,
    selectedNodeId,
    storageAdapter,
    updateNode,
    addChildNode: (parentId: string, text: string) => useMindMapStore().addChildNode(parentId, text),
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
    settings: useMindMapStore().settings || {},
    setPan,
  });

  const subscribeNoteChanges = React.useCallback((cb: (text: string) => void) => {
    const unsubStore = useMindMapStore.subscribe(
      (state) => {
        if (!selectedNodeId) return '';
        const node = findNodeInRoots(state.data?.rootNodes || [], selectedNodeId);
        return node?.note || '';
      },
      (note) => { cb(note); }
    );
    return unsubStore;
  }, [selectedNodeId]);

  const handleAddLink = (nodeId: string) => linkOps.handleAddLink(nodeId);
  const handleSaveLink = async (linkData: Partial<NodeLink>) => { if (!linkModalNodeId) return; await linkOps.handleSaveLink(linkData, linkModalNodeId); };
  const handleDeleteLink = async (linkId: string) => { if (!linkModalNodeId) return; await linkOps.handleDeleteLink(linkModalNodeId, linkId); };

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

  useMindMapViewportEffects({ selectedNodeId, centerNodeInView, ensureSelectedNodeVisible });

  const finishEditingWrapper = (nodeId: string, text?: string) => { if (text !== undefined) finishEditing(nodeId, text); };

  const calcTotalNodes = (node: MindMapNode): number => 1 + (node.children?.reduce((s, c) => s + calcTotalNodes(c), 0) || 0);

  const handleLinkNavigate2 = async (link: NodeLink) => {
    try {
      const current = useMindMapStore.getState().data;
      await navigateLink({ link, currentMapIdentifier: current?.mapIdentifier ?? null, storageAdapter, selectMapById, selectNode, showNotification });
    } catch (err) {
      logger.error('Navigation failed', err);
      showNotification('error', 'リンクの遷移に失敗しました');
    }
  };

  const shortcutHandlers = useShortcutHandlers({
    data,
    ui,
    selectedNodeId,
    editingNodeId,
    editText,
    addNode,
    updateNode,
    deleteNode,
    toggleNodeCollapse,
    applyAutoLayout,
    setEditText,
    setZoom,
    setPan,
    ensureSelectedNodeVisible,
    centerNodeInView,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing: finishEditingWrapper,
    updateNodeText: (nodeId: string, text: string) => useMindMapStore().updateNode(nodeId, { text }),
    changeSiblingOrder: useMindMapStore().changeSiblingOrder,
    pasteImageFromClipboard: clipboardOps.pasteImageFromClipboard,
    pasteNodeFromClipboard: clipboardOps.pasteNodeFromClipboard,
    changeNodeType: markdownOps.changeNodeType,
    getCurrentMarkdownContent: mindMap.getCurrentMarkdownContent,
  });

  type KeyboardShortcutHandlersT = Parameters<typeof useKeyboardShortcuts>[0];
  useKeyboardShortcuts(shortcutHandlers as unknown as KeyboardShortcutHandlersT, vim);

  type CommandsHandlers = Parameters<typeof useCommands>[0]['handlers'];
  const commands = useCommands({ selectedNodeId, editingNodeId, vim, handlers: shortcutHandlers as unknown as CommandsHandlers });
  const { handleExecuteCommand } = useCommandExecution({ commands, showNotification });

  const { nodeOperations, findNode, handleCopyNode, handlePasteNode } = useNodeOperations({ data, ui, updateNode, selectNode, deleteNode, showNotification });
  const { handleMarkdownNodeType, handleAddLinkFromContextMenu } = useContextMenuHandlers({ data, markdownSync, store: useMindMapStore(), selectNode, handleContextMenuClose });

  const handleConvertToMap = useCallback(async (nodeId: string) => {
    try {
      handleContextMenuClose();
      const result = await commands.execute(`convert-node-to-map ${nodeId}`);
      if (!result.success) { showNotification('error', result.error || 'マップへの変換に失敗しました'); return; }
      const { markdown, nodeText } = result.data as { markdown: string; nodeText: string; nodeId: string };
      logger.info('Step 1: Got node data with children');

      if (!storageAdapter?.saveMapMarkdown || !data?.mapIdentifier) { showNotification('error', 'ストレージアダプターが利用できません'); return; }

      const node = findNodeInRoots(data?.rootNodes || [], nodeId);
      if (node && node.children && node.children.length > 0) {
        for (const child of node.children) deleteNode(child.id);
        logger.info(`Step 2: Removed ${node.children.length} children from node`);
      } else { logger.info('Step 2: No children to remove'); }

      await flushMarkdownStream();
      logger.info('Step 3: Saved current map');

      const { sanitizeAndEnsureUnique } = await import('@mindmap/utils/fileNameUtils');
      const existingNames = new Set(
        allMindMaps
          .filter((m) => m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId)
          .map((m) => m.mapIdentifier.mapId.split('/').pop() || '')
      );
      const sanitizedName = sanitizeAndEnsureUnique(nodeText, existingNames);
      if (!currentMapId) { showNotification('error', '現在のマップIDが取得できません'); return; }
      const mapIdParts = currentMapId.split('/');
      const folderPath = mapIdParts.length > 1 ? mapIdParts.slice(0, -1).join('/') : '';
      const newMapId = folderPath ? `${folderPath}/${sanitizedName}` : sanitizedName;
      const newMapIdentifier = { mapId: newMapId, workspaceId: data.mapIdentifier.workspaceId };
      await storageAdapter.saveMapMarkdown(newMapIdentifier, markdown);
      logger.info('Step 4: Created new map file');

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
    <div className="mindmap-app" tabIndex={0} style={{ outline: 'none' }}>
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
          logger.debug('🖱️ Map clicked:', { clickedMapId: id.mapId, clickedWorkspaceId: id.workspaceId, currentMapId, currentWorkspaceId: data?.mapIdentifier?.workspaceId, isMapIdSame: currentMapId === id.mapId, isWorkspaceIdSame: data?.mapIdentifier?.workspaceId === id.workspaceId });
          if (currentMapId === id.mapId && data?.mapIdentifier?.workspaceId === id.workspaceId) { logger.debug('🔄 Same map already selected, skipping:', id.mapId); return; }
          await selectMapById(id);
        }}
        onCreateMap={(title: string, workspaceId: string, category?: string) => createAndSelectMap(title, workspaceId, category)}
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
            const trimmed = String(path || '').replace(/^\/+/, '');
            const parts = trimmed.split('/');
            const first = parts[0];
            if (first && (first.startsWith('ws_') || first === 'cloud')) {
              const workspaceId = first;
              const relativePath = parts.slice(1).join('/');
              await (mindMap).createFolder(relativePath, workspaceId);
            } else {
              await (mindMap).createFolder(path);
            }
          }
        }}
        currentMapData={data}
        onMapSwitch={React.useCallback(async (targetMapIdentifier: MapIdentifier) => {
          const currentMapData = useMindMapStore.getState().data;
          if (currentMapData?.mapIdentifier?.mapId === targetMapIdentifier.mapId && currentMapData?.mapIdentifier?.workspaceId === targetMapIdentifier.workspaceId) { return; }
          await selectMapById(targetMapIdentifier);
        }, [selectMapById])}
        onNodeSelectByLine={React.useCallback(async (lineNumber: number) => {
          const currentMapData = useMindMapStore.getState().data;
          if (!currentMapData || !storageAdapter) return;
          try {
            let foundNodeId: string | null = null;
            const findNodeByMarkdownLine = (nodes: MindMapNode[]): boolean => {
              for (const node of nodes) {
                const nodeLineNumber = node.markdownMeta?.lineNumber;
                if (typeof nodeLineNumber === 'number' && nodeLineNumber + 1 === lineNumber) { foundNodeId = node.id; return true; }
                if (node.children && node.children.length > 0 && findNodeByMarkdownLine(node.children)) { return true; }
              }
              return false;
            };
            findNodeByMarkdownLine(currentMapData.rootNodes || []);
            if (foundNodeId) { selectNode(foundNodeId); centerNodeInView(foundNodeId, false); }
          } catch (error) {
            console.error('Error finding node by line number:', error);
          }
        }, [selectNode, centerNodeInView, storageAdapter])}
      />

      <div className={`mindmap-main-content ${activeView ? 'with-sidebar' : ''}`}>
        <FolderGuideModal isOpen={showFolderGuide} onClose={closeGuide} onSelectFolder={async () => { await handleSelectFolder(); markDismissed(); }} />
        <TopLeftTitlePanel title={data?.title || ''} mapId={data?.mapIdentifier?.mapId || ''} totalNodes={(data?.rootNodes || []).reduce((s, n) => s + calcTotalNodes(n), 0)} onCenterRootNode={handleCenterRootNode} />
        <MindMapWorkspaceContainer
          data={data}
          ui={ui}
          selectedNodeId={selectedNodeId}
          editText={editText}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onSelectNode={selectNode}
          onStartEdit={startEditing}
          onFinishEdit={finishEditingWrapper}
          onSetEditText={setEditText}
          onSetZoom={setZoom}
          onSetPan={setPan}
          onToggleNodeCollapse={toggleNodeCollapse}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          onNavigate={handleLinkNavigate2}
          onOpenLinkModal={(link, nodeId) => { setEditingLink(link); setLinkModalNodeId(nodeId); setShowLinkModal(true); }}
          onOpenLinkActionMenu={(nodeId, e, data) => openLinkActionMenu(nodeId, e, data)}
          onCloseLinkActionMenu={closeLinkActionMenu}
          onPasteImageFromClipboard={clipboardOps.pasteImageFromClipboard}
          onPasteNodeFromClipboard={clipboardOps.pasteNodeFromClipboard}
          onChangeNodeType={markdownOps.changeNodeType}
          onChangeSiblingOrder={useMindMapStore().changeSiblingOrder}
          onMarkdownSync={markdownSync}
          onEnsureSelectedNodeVisible={ensureSelectedNodeVisible}
          onCenterNodeInView={centerNodeInView}
          onLoadRelativeImage={onLoadRelativeImage}
          storageAdapter={storageAdapter || undefined}
          onSelectMapById={selectMapById}
          onResolveAnchorToNode={(anchor) => resolveAnchorToNode(anchor, data?.rootNodes || [])}
        />

        <div className="markdown-panel-wrapper">
          {uiStore.showNotesPanel && (
            <MarkdownPanelContainer
              data={data}
              selectedNodeId={selectedNodeId}
              onSelectNode={selectNode}
              onUpdateNode={updateNode}
              onOpenModal={(link, nodeId) => { setEditingLink(link); setLinkModalNodeId(nodeId); setShowLinkModal(true); }}
              onOpenImage={handleShowImageModal}
              onCloseImage={handleCloseImageModal}
              onOpenTableEditor={handleEditTable}
            />
          )}

          {uiStore.showNodeNotePanel && (
            <SelectedNodeNotePanel
              nodeId={selectedNodeId}
              nodeTitle={(selectedNodeId ? (findNodeInRoots(data?.rootNodes || [], selectedNodeId)?.text || '') : '')}
              note={(selectedNodeId ? (findNodeInRoots(data?.rootNodes || [], selectedNodeId)?.note || '') : '')}
              onChange={(val) => { if (selectedNodeId) updateNode(selectedNodeId, { note: val }); }}
              onClose={() => useMindMapStore().setShowNodeNotePanel?.(false)}
              subscribeNoteChanges={subscribeNoteChanges}
            />
          )}
        </div>
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
        showKnowledgeGraph={!!useMindMapStore().ui.showKnowledgeGraph}
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
        onCopyNode={(nodeId) => { const node = findNode(nodeId); if (node) handleCopyNode(node); }}
        onPasteNode={async (parentId) => { await handlePasteNode(parentId); handleContextMenuClose(); }}
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
        onCloseKnowledgeGraph={() => useMindMapStore().setShowKnowledgeGraph?.(false)}
        nodeOperations={nodeOperations}
        storageAdapter={mindMap?.storageAdapter ?? undefined}
        mindMap={mindMap}
      />
    </div>
  );
};

export default MindMapAppContent;

