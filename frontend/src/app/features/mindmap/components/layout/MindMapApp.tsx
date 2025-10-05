import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport, useWindowGlobalsBridge, useAIOperations, useMarkdownOperations, useEditorEffects, useCommandExecution } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { findNodeById, findNodeInRoots } from '@mindmap/utils';
import { nodeToMarkdown } from '../../../markdown';
import ActivityBar from './ActivityBar';
import PrimarySidebarContainer from './PrimarySidebarContainer';
import TopLeftTitlePanel from './TopLeftTitlePanel';
import MindMapWorkspaceContainer from './MindMapWorkspaceContainer';
import MindMapModals from '../modals/MindMapModals';
import FolderGuideModal from '../modals/FolderGuideModal';
import { useFolderGuide } from './useFolderGuide';
import MindMapLinkOverlays from './MindMapLinkOverlays';
import SelectedNodeNotePanel from '../panels/SelectedNodeNotePanel';
import MarkdownPanelContainer from './NodeNotesPanelContainer';
import MindMapContextMenuOverlay from './MindMapContextMenuOverlay';
import ImageModal from '../modals/ImageModal';
import { useNotification, useErrorHandler, useGlobalErrorHandlers } from '@shared/hooks';
import { useMarkdownSync } from '../../../markdown';
import { resolveAnchorToNode } from '../../../markdown';
import { navigateLink } from '@mindmap/utils';
import { useAI } from '../../../ai/hooks/useAI';
import { useTheme } from '../../../theme/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
import MindMapProviders from './MindMapProviders';
import { MindMapController } from '@mindmap/controllers/MindMapController';
import { logger, statusMessages } from '@shared/utils';
import MindMapOverlays from './MindMapOverlays';
import '@shared/styles/layout/MindMapApp.css';
import { useVim, VimProvider } from "../../../vim/context/vimContext";
import { JumpyLabels } from "../../../vim";
import VimStatusBar from "../VimStatusBar";
import CommandPalette from '@shared/components/CommandPalette';
import { useCommandPalette } from '@shared/hooks/ui/useCommandPalette';
import { useCommands } from '../../../../commands/system/useCommands';
import { AuthModal } from '@shared/components';
import { CloudStorageAdapter } from '../../../../core/storage/adapters';
// panelManager usage removed for node right-click; strategies handle gating
import { selectNodeIdByMarkdownLine } from '@mindmap/selectors/mindMapSelectors';

import type { MindMapNode, NodeLink, MapIdentifier } from '@shared/types';
import type { StorageConfig } from '@core/types';

import { useShortcutHandlers } from './useShortcutHandlers';

interface MindMapAppProps {
  storageMode?: 'local' ;
  resetKey?: number;
}

interface MindMapAppContentProps extends MindMapAppProps {
  mindMap: any; // mindMap instance passed from wrapper
}

const MindMapAppContent: React.FC<MindMapAppContentProps> = ({
  storageMode = 'local', // Used in props passed to child components
  mindMap
}) => {

  const { showNotification } = useNotification();
  const { handleError } = useErrorHandler();
  const markdownSync = useMarkdownSync();

  const { loadSettingsFromStorage } = useMindMapStore();

  const vim = useVim();

  React.useEffect(() => {
    loadSettingsFromStorage();
  }, [loadSettingsFromStorage]);

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
  } = useMindMapModals();

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentImageAlt, setCurrentImageAlt] = useState<string>('');

  const handleShowImageModal = useCallback((imageUrl: string, altText?: string) => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageAlt(altText || '');
    setShowImageModal(true);
  }, []);

  const commandPalette = useCommandPalette({
    enabled: true,
    shortcut: 'ctrl+p'
  });

  const finishEditingWrapper = (nodeId: string, text?: string) => {
    if (text !== undefined) finishEditing(nodeId, text);
  };

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setCurrentImageUrl(null);
    setCurrentImageAlt('');
  }, []);

  const ai = useAI();

  useTheme();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authCloudAdapter, setAuthCloudAdapter] = useState<CloudStorageAdapter | null>(null);
  const [authOnSuccess, setAuthOnSuccess] = useState<((adapter: CloudStorageAdapter) => void) | null>(null);

  React.useEffect(() => {
    const controller = new MindMapController();
    return controller.attachAuthModalBridge({
      setAuthCloudAdapter,
      setAuthOnSuccess,
      setIsAuthModalOpen,
    });
  }, []);

  // Controller initialization removed (no-op)

  const handleAuthModalClose = () => {
    setIsAuthModalOpen(false);
    setAuthCloudAdapter(null);
    setAuthOnSuccess(null);
  };

  const handleAuthModalSuccess = (authenticatedAdapter: CloudStorageAdapter) => {
    if (authOnSuccess) {
      authOnSuccess(authenticatedAdapter);
    }
    handleAuthModalClose();
  };


  const { showFolderGuide, closeGuide, markDismissed } = useFolderGuide();

  React.useEffect(() => {
    // ログインモーダル関連は削除されました
  }, [storageMode]);

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
    refreshMapList
  } = mindMap;

  const uiStore = useMindMapStore().ui;
  const activeView = uiStore.activeView;
  const setActiveView = store.setActiveView;

  const explorerTree = (mindMap as any).explorerTree || null;
  useWindowGlobalsBridge({
    workspaces,
    addWorkspace,
    removeWorkspace,
    allMindMaps,
    currentMapId,
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
    mindMap,
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

  const handleContextMenuClose = () => {
    (store as any).closePanel?.('contextMenu');
    store.setShowContextMenu(false);
  };

  const aiOps = useAIOperations({
    ai,
    addNode,
    showNotification,
    onComplete: handleContextMenuClose,
  });

  const handleAIGenerate = aiOps.handleAIGenerate;

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

  const countNodes = (node: MindMapNode): number => {
    let count = 1; // 現在のノード
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
    settings: (store as any).settings || {},
    setPan,
  });

  const handleAddLink = (nodeId: string) => linkOps.handleAddLink(nodeId);
  const handleEditLink = (link: NodeLink, nodeId: string) => linkOps.handleEditLink(link, nodeId);
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

  React.useEffect(() => {
    if (!selectedNodeId) return;
    const raf = () => requestAnimationFrame(() => ensureSelectedNodeVisible());
    const id = window.setTimeout(raf, 0);
    return () => { window.clearTimeout(id); };
  }, [uiStore.showNodeNotePanel, uiStore.showNotesPanel, selectedNodeId, ensureSelectedNodeVisible]);

  React.useEffect(() => {
    const handler = () => { ensureSelectedNodeVisible(); };
    window.addEventListener('node-note-panel-resize', handler as EventListener);
    return () => window.removeEventListener('node-note-panel-resize', handler as EventListener);
  }, [ensureSelectedNodeVisible]);

  React.useEffect(() => {
    if (!selectedNodeId) return;
    ensureSelectedNodeVisible();
  }, [uiStore.nodeNotePanelHeight, selectedNodeId, ensureSelectedNodeVisible]);


  const handleLinkNavigate2 = async (link: NodeLink) => {
    await navigateLink(link, {
      currentMapId,
      dataRoot: null,
      selectMapById,
      currentWorkspaceId: (data as any)?.mapIdentifier?.workspaceId as string,
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
    applyAutoLayout,
    pasteImageFromClipboard: clipboardOps.pasteImageFromClipboard,
    pasteNodeFromClipboard: clipboardOps.pasteNodeFromClipboard,
    changeNodeType: markdownOps.changeNodeType,
    changeSiblingOrder: store.changeSiblingOrder,
  });

  useKeyboardShortcuts(shortcutHandlers as any, vim);
  const handleCloseLinkActionMenu = closeLinkActionMenu;

  const commands = useCommands({
    selectedNodeId,
    editingNodeId,
    vim,
    handlers: shortcutHandlers as any, // 型が複雑で完全に一致しないため、anyで回避
  });

  const { handleExecuteCommand } = useCommandExecution({
    commands,
    showNotification,
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

      <PrimarySidebarContainer
        activeView={activeView}
        allMindMaps={allMindMaps}
        currentMapId={currentMapId}
        storageAdapter={storageAdapter}
        onSelectMap={async (id) => {
          // デバッグログを追加
          logger.debug('🖱️ Map clicked:', {
            clickedMapId: id.mapId,
            clickedWorkspaceId: id.workspaceId,
            currentMapId,
            currentWorkspaceId: data?.mapIdentifier?.workspaceId,
            isMapIdSame: currentMapId === id.mapId,
            isWorkspaceIdSame: data?.mapIdentifier?.workspaceId === id.workspaceId
          });

          // 同じマップが既に選択されている場合は早期リターン
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
        workspaces={workspaces as any}
        currentWorkspaceId={currentWorkspaceId as any}
        onAddWorkspace={addWorkspace as any}
        onRemoveWorkspace={removeWorkspace as any}
        onSwitchWorkspace={switchWorkspace as any}
        explorerTree={(mindMap as any).explorerTree || null}
        onCreateFolder={async (path: string) => {
          if (typeof (mindMap as any).createFolder === 'function') {
            // フルパスからworkspaceIdと相対パスを分離
            const wsMatch = path.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
            if (wsMatch) {
              const workspaceId = wsMatch[1];
              const relativePath = wsMatch[2] || '';
              await (mindMap as any).createFolder(relativePath, workspaceId);
            } else {
              // フォールバック: 相対パスとして処理
              await (mindMap as any).createFolder(path);
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

              const findNodeByMarkdownLine = (nodes: any[]): boolean => {
                for (const node of nodes) {
                  // markdownMetaに保存されている行番号を確認
                  const nodeLineNumber = node.markdownMeta?.lineNumber;

                  // lineNumberは0-based、検索結果のlineNumberは1-based
                  if (typeof nodeLineNumber === 'number' && nodeLineNumber + 1 === lineNumber) {
                    foundNodeId = node.id;
                    return true;
                  }

                  if (node.children && node.children.length > 0) {
                    if (findNodeByMarkdownLine(node.children)) {
                      return true;
                    }
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
            // movement handled via event strategies
            onAddChild={(parentId) => { addNode(parentId); }}
            onAddSibling={(nodeId) => { store.addSiblingNode(nodeId); }}
            onDeleteNode={deleteNode}
            onToggleCollapse={toggleNodeCollapse}
            onShowLinkActionMenu={handleShowLinkActionMenu}
            onAddLink={handleAddLink}
            onUpdateNode={updateNode}
            onAutoLayout={applyAutoLayout}
            availableMaps={allMindMaps.map((map: any) => ({ id: map.mapIdentifier.mapId, title: map.title }))}
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
              getMapMarkdown={(mindMap as any).getMapMarkdown}
              onMapMarkdownInput={(mindMap as any).onMapMarkdownInput}
              subscribeMarkdownFromNodes={(mindMap as any).subscribeMarkdownFromNodes}
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
        vim={vim}
      />

      <JumpyLabels vim={vim} />
      <VimStatusBar vim={vim} />

      <MindMapLinkOverlays
        allMaps={allMindMaps.map((map: any) => ({ mapIdentifier: map.mapIdentifier, title: map.title }))}
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
        linkActionMenuData={linkActionMenuData as any}
        onCloseLinkActionMenu={handleCloseLinkActionMenu}
        onNavigate={handleLinkNavigate2}
        onEditLink={handleEditLink}
        onDeleteLinkFromMenu={handleDeleteLink}
      />

      {/* Outline Editor removed */}

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
        onMarkdownNodeType={(nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => {
          if (data?.rootNodes?.[0]) {
            // コンテキストメニューをすぐに閉じる
            handleContextMenuClose();

            // ノード変換を実行（markdownSyncのコールバック形式を使用）
            markdownSync.changeNodeType(data.rootNodes, nodeId, newType, (updatedNodes) => {
              // 変換エラーをチェック
              if ((updatedNodes as any).__conversionError) {
                const errorMessage = (updatedNodes as any).__conversionError;
                const typeDisplayName = newType === 'heading' ? '見出し' :
                  newType === 'unordered-list' ? '箇条書きリスト' : '番号付きリスト';
                statusMessages.customError(`${typeDisplayName}への変換に失敗しました: ${errorMessage}`);
                return;
              }

              // ルートノードを置き換え（履歴に積む）
              (store as any).setRootNodes(updatedNodes, { emit: true, source: 'contextMenu.changeNodeType' });
              // Ensure unified auto-layout after markdown-driven structure changes
              try { store.applyAutoLayout(); } catch {}
              // 選択状態を維持して即時再描画を促す
              setTimeout(() => {
                try { selectNode(nodeId); } catch { /* noop */ }
              }, 0);
            });
          }
        }}
        onAIGenerate={ai.aiSettings.enabled ? handleAIGenerate : undefined}
        onClose={handleContextMenuClose}
      />

      {/* Image Modal */}
      <ImageModal
        isOpen={showImageModal}
        imageUrl={currentImageUrl}
        altText={currentImageAlt}
        onClose={handleCloseImageModal}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onExecuteCommand={handleExecuteCommand}
        onSelectMap={async (mapId) => {
          await selectMapById(mapId);
        }}
        storageAdapter={mindMap?.storageAdapter}
      />

      {/* Auth Modal */}
      {isAuthModalOpen && authCloudAdapter && (
        <AuthModal
          isOpen={isAuthModalOpen}
          cloudAdapter={authCloudAdapter}
          onClose={handleAuthModalClose}
          onSuccess={handleAuthModalSuccess}
        />
      )}
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
    } catch { /* ignore */ }
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
