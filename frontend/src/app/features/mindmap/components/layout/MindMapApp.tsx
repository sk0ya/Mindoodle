import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { findNodeById, findNodeInRoots } from '@mindmap/utils';
import { nodeToMarkdown } from '../../../markdown';
import ActivityBar from './ActivityBar';
import PrimarySidebarContainer from './PrimarySidebarContainer';
// Removed header; use compact top-left panel instead
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

  // Settings store for initialization
  const { loadSettingsFromStorage } = useMindMapStore();

  // Get vim instance from context
  const vim = useVim();

  // Initialize settings on mount
  React.useEffect(() => {
    loadSettingsFromStorage();
  }, [loadSettingsFromStorage]);

  const store = useMindMapStore();

  // グローバルエラーハンドラーの設定を簡潔に
  useGlobalErrorHandlers(handleError);
  // モーダル状態管理
  const {
    // showLoginModal削除済み
    showLinkModal, setShowLinkModal,
    editingLink, setEditingLink,
    linkModalNodeId, setLinkModalNodeId,
    showLinkActionMenu,
    linkActionMenuData,
    contextMenu, setContextMenu,
    closeLinkModal,
    openLinkActionMenu, closeLinkActionMenu,
  } = useMindMapModals();

  // 画像モーダル状態管理
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentImageAlt, setCurrentImageAlt] = useState<string>('');

  // 画像モーダルハンドラー
  const handleShowImageModal = useCallback((imageUrl: string, altText?: string) => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageAlt(altText || '');
    setShowImageModal(true);
  }, []);

  // コマンドパレット状態管理
  const commandPalette = useCommandPalette({
    enabled: true,
    shortcut: 'ctrl+p'
  });

  // Initialize shortcut handlers first (we'll need them for commands)
  const finishEditingWrapper = (nodeId: string, text?: string) => {
    if (text !== undefined) finishEditing(nodeId, text);
  };

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setCurrentImageUrl(null);
    setCurrentImageAlt('');
  }, []);

  // AI functionality
  const ai = useAI();

  // テーマ管理
  useTheme();

  // Auth modal state management
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authCloudAdapter, setAuthCloudAdapter] = useState<CloudStorageAdapter | null>(null);
  const [authOnSuccess, setAuthOnSuccess] = useState<((adapter: CloudStorageAdapter) => void) | null>(null);

  // Listen for global auth modal event
  React.useEffect(() => {
    const handleShowAuthModal = (event: CustomEvent) => {
      const { cloudAdapter, onSuccess } = event.detail;
      setAuthCloudAdapter(cloudAdapter);
      setAuthOnSuccess(() => onSuccess);
      setIsAuthModalOpen(true);
    };

    window.addEventListener('mindoodle:showAuthModal', handleShowAuthModal as EventListener);
    return () => {
      window.removeEventListener('mindoodle:showAuthModal', handleShowAuthModal as EventListener);
    };
  }, []);

  // Handle auth modal close
  const handleAuthModalClose = () => {
    setIsAuthModalOpen(false);
    setAuthCloudAdapter(null);
    setAuthOnSuccess(null);
  };

  // Handle auth success
  const handleAuthModalSuccess = (authenticatedAdapter: CloudStorageAdapter) => {
    if (authOnSuccess) {
      authOnSuccess(authenticatedAdapter);
    }
    handleAuthModalClose();
  };


  // Folder guide modal state (extracted)
  const { showFolderGuide, closeGuide, markDismissed } = useFolderGuide();

  // Handle mode changes (loginModal削除済み)
  React.useEffect(() => {
    // ログインモーダル関連は削除されました
  }, [storageMode]);

  // Destructure from the passed mindMap instance
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
    moveNode,
    moveNodeWithPosition,
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
    changeSiblingOrder,
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

  // VSCode風サイドバーの状態はUIストアから取得
  const uiStore = useMindMapStore().ui;
  const activeView = uiStore.activeView;
  const setActiveView = store.setActiveView;
  // Bridge workspaces to sidebar via globals (quick wiring)
  React.useEffect(() => {
    (window as any).mindoodleWorkspaces = workspaces || [];
    (window as any).mindoodleAddWorkspace = async () => { try { await (addWorkspace as any)?.(); await (mindMap as any).refreshMapList?.(); } catch { } };
    (window as any).mindoodleRemoveWorkspace = async (id: string) => { try { await (removeWorkspace as any)?.(id); await (mindMap as any).refreshMapList?.(); } catch { } };
  }, [workspaces, addWorkspace, removeWorkspace, mindMap]);

  // Expose map list and selector for keyboard shortcuts (Ctrl+P/N)
  const explorerTree = (mindMap as any).explorerTree || null;
  React.useEffect(() => {
    try {
      (window as any).mindoodleAllMaps = allMindMaps || [];
      (window as any).mindoodleCurrentMapId = currentMapId || null;
      // Build ordered list of maps based on explorer tree (visual order)
      const ordered: Array<{ mapId: string; workspaceId: string | undefined }> = [];
      const tree: any = explorerTree;
      const visit = (node: any) => {
        if (!node) return;
        if (node.type === 'folder') {
          (node.children || []).forEach((c: any) => visit(c));
        } else if (node.type === 'file' && node.isMarkdown && typeof node.path === 'string') {
          const workspaceId = node.path.startsWith('/ws_') ? node.path.split('/')[1] : undefined;
          const mapId = node.path.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '');
          if (mapId) ordered.push({ mapId, workspaceId });
        }
      };
      visit(tree);
      (window as any).mindoodleOrderedMaps = ordered; // array of { mapId, workspaceId }
      // Debounced selector to avoid heavy reflows when switching rapidly
      (window as any).mindoodleSelectMapById = (mapId: string) => {
        try {
          // Skip if selecting the same map (use latest reflected on window to avoid stale closure)
          const curr: string | null = (window as any).mindoodleCurrentMapId || null;
          if (curr === mapId) return;
          const target = (allMindMaps || []).find((m: any) => m?.mapIdentifier?.mapId === mapId);
          if (!target) return;
          const pendingKey = `pending:${target.mapIdentifier.workspaceId}:${target.mapIdentifier.mapId}`;
          (window as any).__mindoodlePendingMapKey = pendingKey;
          if ((window as any).__mindoodleMapSwitchTimer) {
            clearTimeout((window as any).__mindoodleMapSwitchTimer);
          }
          (window as any).__mindoodleMapSwitchTimer = setTimeout(() => {
            try {
              // Ensure latest pending is still this target
              if ((window as any).__mindoodlePendingMapKey === pendingKey) {
                selectMapById(target.mapIdentifier);
              }
            } catch { }
          }, 150);
        } catch { }
      };
    } catch { }
  }, [allMindMaps, currentMapId, selectMapById, explorerTree]);

  // File operations hook
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

  // Wrapper for handleSelectFolder to include closeGuide/markDismissed
  const handleSelectFolder = React.useCallback(async () => {
    await handleSelectFolderFromHook(() => {
      closeGuide();
      markDismissed();
    });
  }, [handleSelectFolderFromHook, closeGuide, markDismissed]);

  // キーボードショートカット設定は後で定義

  // UI state から個別に取得
  const { showKeyboardHelper, setShowKeyboardHelper } = {
    showKeyboardHelper: uiStore.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  };

  // ファイルハンドラーは useFileHandlers に移譲

  // ダウンロード/削除は useFileHandlers に委譲（downloadFile/deleteFile を直接使用）

  // ユーティリティ関数

  // Context menu handlers
  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();

    // リンクリストまたは添付ファイルリスト表示中は右クリックコンテキストメニューを無効化
    if (uiStore.showLinkListForNode) {
      return;
    }

    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      nodeId: nodeId
    });
    selectNode(nodeId); // Select the node when right-clicking
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      nodeId: null
    });
  };

  const handleAIGenerate = async (node: MindMapNode) => {
    // 生成開始の通知
    showNotification('info', 'AI子ノード生成中... 🤖');

    try {
      const childTexts = await ai.generateChildNodes(node);

      // Generate child nodes based on AI suggestions
      childTexts.forEach(text => {
        addNode(node.id, text.trim());
      });

      showNotification('success', `✅ ${childTexts.length}個の子ノードを生成しました`);
    } catch (error) {
      logger.error('AI child node generation failed:', error);
      showNotification('error', '❌ AI子ノード生成に失敗しました');
    } finally {
      handleContextMenuClose();
    }
  };

  // File operations (loadMapData, onLoadRelativeImage) moved to useMindMapFileOps hook

  // Title editing disabled in UI (no-op removed)

  // インポート/エクスポート機能は削除済み

  // Event handlers hook
  useMindMapEvents({ mindMap, selectMapById });

  // ノード数を数える補助関数
  const countNodes = (node: MindMapNode): number => {
    let count = 1; // 現在のノード
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

  // Link operations hook
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

  // Clipboard operations hook
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

  // Viewport/resize operations hook
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

  // Wrapper functions to maintain existing interface
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

  // Use viewport operations from hook
  const ensureSelectedNodeVisible = viewportOps.ensureSelectedNodeVisible;
  const centerNodeInView = viewportOps.centerNodeInView;

  // ルートノードを左端中央に表示するハンドラー
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

  // Keep selected node minimally visible when panels open/resize (no centering)
  React.useEffect(() => {
    if (!selectedNodeId) return;
    const raf = () => requestAnimationFrame(() => ensureSelectedNodeVisible());
    const id = window.setTimeout(raf, 0);
    return () => { window.clearTimeout(id); };
  }, [uiStore.showNodeNotePanel, uiStore.showNotesPanel, selectedNodeId, ensureSelectedNodeVisible]);

  // Listen to explicit note panel resize events to keep selection visible
  React.useEffect(() => {
    const handler = () => { ensureSelectedNodeVisible(); };
    window.addEventListener('node-note-panel-resize', handler as EventListener);
    return () => window.removeEventListener('node-note-panel-resize', handler as EventListener);
  }, [ensureSelectedNodeVisible]);

  // Also adjust when the stored height value changes (store-driven source of truth)
  React.useEffect(() => {
    if (!selectedNodeId) return;
    ensureSelectedNodeVisible();
  }, [uiStore.nodeNotePanelHeight, selectedNodeId, ensureSelectedNodeVisible]);


  // Simplified link navigation via utility
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

  // キーボードショートカット設定（ハンドラー組み立てを外部化）
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
    changeNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => {
      if (data?.rootNodes?.[0]) {
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
          (store as any).setRootNodes(updatedNodes, { emit: true, source: 'changeNodeType' });
          // Ensure unified auto-layout after markdown-driven structure changes
          try { store.applyAutoLayout(); } catch {}
          // 選択状態は維持しつつ再描画。明示的な selectNode(null) は行わない
          setTimeout(() => {
            selectNode(nodeId);
          }, 0);
        });
      }
    },
    changeSiblingOrder: store.changeSiblingOrder,
  });

  // Toggle autosave based on right markdown panel visibility to avoid feedback loops
  const setAutoSaveFnRef = React.useRef<null | ((enabled: boolean) => void)>(null);
  React.useEffect(() => {
    const fn = (mindMap as any)?.setAutoSaveEnabled;
    setAutoSaveFnRef.current = (typeof fn === 'function') ? fn : null;
  }, [mindMap]);
  React.useEffect(() => {
    try {
      setAutoSaveFnRef.current?.(!uiStore.showNotesPanel);
    } catch {}
  }, [uiStore.showNotesPanel]);

  // Ensure Vim mode returns to normal when editing ends (e.g., blur)
  React.useEffect(() => {
    if (vim.isEnabled && !editingNodeId && vim.mode !== 'normal' && vim.mode !== 'search' &&
      vim.mode !== 'jumpy' && vim.mode !== 'command'
    ) {
      vim.setMode('normal');
    }
  }, [vim.isEnabled, vim.mode, editingNodeId, vim.setMode]);

  useKeyboardShortcuts(shortcutHandlers as any, vim);
  const handleCloseLinkActionMenu = closeLinkActionMenu;

  // Initialize command system after shortcutHandlers
  const commands = useCommands({
    selectedNodeId,
    editingNodeId,
    vim,
    handlers: shortcutHandlers as any, // 型が複雑で完全に一致しないため、anyで回避
  });

  // Handle command execution from palette
  const handleExecuteCommand = useCallback(async (commandName: string, _args?: Record<string, any>) => {
    try {
      const result = await commands.execute(commandName);
      if (result.success) {
        if (result.message) {
          showNotification('success', result.message);
        }
      } else {
        showNotification('error', result.error || 'コマンドの実行に失敗しました');
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      showNotification('error', 'コマンドの実行中にエラーが発生しました');
    }
  }, [commands, showNotification]);

  // Outline save feature removed

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
            onMoveNode={moveNode}
            onMoveNodeWithPosition={moveNodeWithPosition}
            onChangeSiblingOrder={changeSiblingOrder}
            onAddChild={(parentId) => { addNode(parentId); }}
            onAddSibling={(nodeId) => { store.addSiblingNode(nodeId); }}
            onDeleteNode={deleteNode}
            onRightClick={handleRightClick}
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
              getNodeIdByMarkdownLine={(mindMap as any).getNodeIdByMarkdownLine}
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
        visible={contextMenu.visible}
        position={contextMenu.position}
        dataRoot={data?.rootNodes?.[0] || null}
        dataRoots={data?.rootNodes || []}
        nodeId={contextMenu.nodeId}
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
    (window as any).mindoodleCreateFolder = async (path: string) => {
      if (typeof (mindMap as any).createFolder === 'function') {
        const wsMatch = path.match(/^\/?(ws_[^/]+)\/?(.*)$/);
        if (wsMatch) {
          const workspaceId = wsMatch[1];
          const relativePath = wsMatch[2] || '';
          await (mindMap as any).createFolder(relativePath, workspaceId);
        } else {
          await (mindMap as any).createFolder(path);
        }
      }
    };

    (window as any).mindoodleCreateAndSelectMap = async (title: string, workspaceId: string, category?: string) => {
      if (typeof (mindMap as any).createAndSelectMap === 'function') {
        await (mindMap as any).createAndSelectMap(title, workspaceId, category);
      }
    };
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
