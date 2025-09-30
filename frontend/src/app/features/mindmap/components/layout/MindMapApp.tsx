import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import { findNodeById, findNodeInRoots, calculateNodeSize } from '@mindmap/utils';
import { nodeToMarkdown } from '../../../markdown';
import { relPathBetweenMapIds } from '@shared/utils';
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
import { resolveAnchorToNode, computeAnchorForNode } from '../../../markdown';
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
import { imagePasteService } from '../../services/imagePasteService';
import CommandPalette from '@shared/components/CommandPalette';
import { useCommandPalette } from '@shared/hooks/ui/useCommandPalette';
import { useCommands } from '../../../../commands/system/useCommands';
import { AuthModal } from '@shared/components';
import { CloudStorageAdapter } from '../../../../core/storage/adapters';

import type { MindMapNode, MindMapData, NodeLink, MapIdentifier } from '@shared/types';
import type { StorageConfig } from '@core/types';

import { useShortcutHandlers } from './useShortcutHandlers';
import { findNodeByLineNumber } from '@shared/utils/searchUtils';

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
    addWorkspace,
    removeWorkspace,
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

  // Now that mindMap is initialized, define folder selection handler
  const handleSelectFolder = React.useCallback(async () => {
    try {
      if (typeof (mindMap as any).selectRootFolder === 'function') {
        const ok = await (mindMap as any).selectRootFolder();
        if (ok) {
          closeGuide();
          markDismissed();
        } else {
          console.warn('selectRootFolder is not available on current adapter');
        }
      }
    } catch (e) {
      console.error('Folder selection failed:', e);
    }
  }, [mindMap, closeGuide, markDismissed]);

  // フォルダ移動用の一括カテゴリ更新関数
  const updateMultipleMapCategories = React.useCallback(async (mapUpdates: Array<{ id: string, category: string }>) => {
    logger.debug('Updating multiple map categories:', mapUpdates);

    if (mapUpdates.length === 0) return;

    try {
      // 一括でマップ情報を更新
      const updatedMaps = mapUpdates.map(update => {
        const mapToUpdate = allMindMaps.find((map: any) => map.mapIdentifier.mapId === update.id);
        if (!mapToUpdate) return null;

        return {
          ...mapToUpdate,
          category: update.category,
          updatedAt: new Date().toISOString()
        };
      }).filter(Boolean);

      logger.debug(`Batch updating ${updatedMaps.length} maps`);

      // 成功後にマップリストを強制更新してUIを即座に反映
      if (typeof (mindMap as any).refreshMapList === 'function') {
        await (mindMap as any).refreshMapList();
      }

      logger.debug(`Successfully batch updated ${updatedMaps.length} maps`);
    } catch (error) {
      console.error('Failed to batch update map categories:', error);
      // エラーが発生した場合も、可能な限り状態を同期
      if (typeof (mindMap as any).refreshMapList === 'function') {
        await (mindMap as any).refreshMapList();
      }
    }
  }, [allMindMaps, mindMap]);

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

  // 他のマップのデータを取得する関数
  const loadMapData = useCallback(async (mapIdentifier: MapIdentifier): Promise<MindMapData | null> => {
    try {
      if (data && mapIdentifier.mapId === data.mapIdentifier.mapId && mapIdentifier.workspaceId === data.mapIdentifier.workspaceId) {
        // 現在のマップの場合はそのまま返す
        return data;
      }

      // 他のマップのデータを読み込む
      // 永続化フックから適切なメソッドを使用
      const targetMap = allMindMaps.find((map: any) => map.mapIdentifier.mapId === mapIdentifier.mapId && map.mapIdentifier.workspaceId === mapIdentifier.workspaceId);
      if (targetMap) {
        // 既に読み込み済みのマップデータがある場合はそれを返す
        return targetMap;
      }

      // マップが見つからない場合
      logger.warn('指定されたマップが見つかりません:', mapIdentifier);
      showNotification('warning', '指定されたマップが見つかりません');
      return null;
    } catch (error) {
      logger.error('マップデータの読み込みに失敗:', error);
      showNotification('error', 'マップデータの読み込みに失敗しました');
      return null;
    }
  }, [data, allMindMaps, showNotification]);

  // 相対パス画像を読み込む関数
  const onLoadRelativeImage = useCallback(async (relativePath: string): Promise<string | null> => {
    try {
      if (typeof (mindMap as any).readImageAsDataURL !== 'function') {
        return null;
      }

      const workspaceId = data?.mapIdentifier?.workspaceId;
      const currentMapId = data?.mapIdentifier?.mapId || '';

      // Resolve relativePath against current map directory
      const resolvePath = (baseFilePath: string, rel: string): string => {
        // absolute-like path inside workspace
        if (/^\//.test(rel)) {
          return rel.replace(/^\//, '');
        }
        // get base directory of current map
        const baseDir = baseFilePath.includes('/') ? baseFilePath.replace(/\/[^/]*$/, '') : '';
        const baseSegs = baseDir ? baseDir.split('/') : [];
        const relSegs = rel.replace(/^\.\//, '').split('/');
        const out: string[] = [...baseSegs];
        for (const seg of relSegs) {
          if (!seg || seg === '.') continue;
          if (seg === '..') {
            if (out.length > 0) out.pop();
          } else {
            out.push(seg);
          }
        }
        return out.join('/');
      };

      const resolvedPath = resolvePath(currentMapId, relativePath);
      return await (mindMap as any).readImageAsDataURL(resolvedPath, workspaceId);
    } catch (error) {
      console.warn('Failed to load relative image:', relativePath, error);
      return null;
    }
  }, [mindMap, data]);

  // Title editing disabled in UI (no-op removed)

  // インポート/エクスポート機能は削除済み

  // Listen to explorer selection events
  React.useEffect(() => {
    const handler = async (e: any) => {
      const id = e?.detail?.mapId as string | undefined;
      const ws = e?.detail?.workspaceId as string;
      const source = e?.detail?.source as string | undefined;
      const direction = e?.detail?.direction as ('prev' | 'next' | undefined);
      if (!id || typeof selectMapById !== 'function') return;

      const ordered: Array<{ mapId: string; workspaceId: string }> = (window as any).mindoodleOrderedMaps || [];
      const dirStep = direction === 'prev' ? -1 : 1;

      const trySelect = async (mapId: string, workspaceId: string): Promise<boolean> => {
        const ok = await selectMapById({ mapId, workspaceId: workspaceId as any });
        if (!ok) return false;
        // Allow state to settle
        await Promise.resolve();
        const current = useMindMapStore.getState().data;
        const roots = current?.rootNodes || [];
        const empty = !Array.isArray(roots) || roots.length === 0 || (roots.length === 1 && (!roots[0].children || roots[0].children.length === 0));
        return !empty;
      };

      if (source === 'keyboard' && (direction === 'prev' || direction === 'next') && Array.isArray(ordered) && ordered.length > 0) {
        // Start from requested id and skip empties following the direction
        let idx = ordered.findIndex(o => o.mapId === id);
        if (idx < 0) idx = 0;
        for (let step = 0; step < ordered.length; step++) {
          const i = (idx + (dirStep * step) + ordered.length) % ordered.length;
          const cand = ordered[i];
          const ok = await trySelect(cand.mapId, cand.workspaceId);
          if (ok) break;
        }
      } else {
        // Default behavior
        await selectMapById({ mapId: id, workspaceId: ws });
      }
    };
    window.addEventListener('mindoodle:selectMapById', handler as EventListener);
    return () => window.removeEventListener('mindoodle:selectMapById', handler as EventListener);
  }, [selectMapById]);

  // Refresh explorer/map list on external changes or when window regains focus
  React.useEffect(() => {
    const doRefresh = () => {
      try {
        if (typeof (mindMap as any).refreshMapList === 'function') {
          void (mindMap as any).refreshMapList();
        }
      } catch (e) {
        console.error('Explorer refresh failed:', e);
      }
    };
    const onVisibility = () => { if (!document.hidden) doRefresh(); };
    const onFocus = () => doRefresh();
    const onCustom = () => doRefresh();
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('mindoodle:refreshExplorer', onCustom as EventListener);
    const interval = window.setInterval(doRefresh, 7000);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('mindoodle:refreshExplorer', onCustom as EventListener);
      window.clearInterval(interval);
    };
  }, [mindMap]);

  // Handle rename/delete events from explorer
  React.useEffect(() => {
    const onRename = (e: any) => {
      try {
        const oldPath = e?.detail?.oldPath;
        const newName = e?.detail?.newName;
        if (oldPath && newName && typeof (mindMap as any).renameItem === 'function') {
          void (mindMap as any).renameItem(oldPath, newName).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Rename failed:', err));
        }
      } catch (err) {
        console.error('Rename handler failed:', err);
      }
    };
    const onDelete = (e: any) => {
      try {
        const path = e?.detail?.path;
        if (path && typeof (mindMap as any).deleteItem === 'function') {
          void (mindMap as any).deleteItem(path).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Delete failed:', err));
        }
      } catch (err) {
        console.error('Delete handler failed:', err);
      }
    };
    window.addEventListener('mindoodle:renameItem', onRename as EventListener);
    window.addEventListener('mindoodle:deleteItem', onDelete as EventListener);
    return () => {
      window.removeEventListener('mindoodle:renameItem', onRename as EventListener);
      window.removeEventListener('mindoodle:deleteItem', onDelete as EventListener);
    };
  }, [mindMap]);

  // Handle move events from explorer (drag & drop)
  React.useEffect(() => {
    const onMove = (e: any) => {
      try {
        const src = e?.detail?.sourcePath;
        const dst = e?.detail?.targetFolderPath ?? '';


        if (src !== undefined && typeof (mindMap as any).moveItem === 'function') {
          void (mindMap as any).moveItem(src, dst).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Move failed:', err));
        }
      } catch (err) {
        console.error('Move handler failed:', err);
      }
    };
    window.addEventListener('mindoodle:moveItem', onMove as EventListener);
    return () => window.removeEventListener('mindoodle:moveItem', onMove as EventListener);
  }, [mindMap]);

  // インポート成功時のハンドラー（未使用）
  // const handleImportSuccess = async () => {};


  // ノード数を数える補助関数
  const countNodes = (node: MindMapNode): number => {
    let count = 1; // 現在のノード
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

  // Link-related handlers
  const handleAddLink = (nodeId: string) => {
    // Open modal to choose target map/node, then append markdown on save
    setEditingLink(null);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  };

  const handleEditLink = (link: NodeLink, nodeId: string) => {
    logger.debug('handleEditLink', { link, nodeId });
    setEditingLink(link);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  };


  const handleSaveLink = async (linkData: Partial<NodeLink>) => {
    if (!linkModalNodeId || !data) return;
    try {
      const rootNodes = data.rootNodes || [];
      let destNode = null;
      for (const rootNode of rootNodes) {
        destNode = findNodeById(rootNode, linkModalNodeId);
        if (destNode) break;
      }
      if (!destNode) return;

      const currentMapId = data.mapIdentifier.mapId;
      const targetMapId = linkData.targetMapId || currentMapId;
      let label = 'リンク';
      let href = '';



      // Determine label and href
      if (targetMapId === currentMapId) {
        if (linkData.targetNodeId) {
          const targetNode = findNodeInRoots(data.rootNodes || [], linkData.targetNodeId);
          if (targetNode) {
            label = targetNode.text || 'リンク';
            // Use saved anchor if available, otherwise compute it
            const anchor = linkData.targetAnchor || computeAnchorForNode(data.rootNodes?.[0], targetNode.id) || label;
            href = `#${anchor}`;
          }
        } else {
          // Current map without node → center root (no anchor)
          label = data.title || 'このマップ';
          href = '';
        }
      } else {
        // Other map
        const targetMap = await loadMapData({ mapId: targetMapId, workspaceId: data.mapIdentifier.workspaceId });
        if (targetMap) {
          if (linkData.targetNodeId) {
            const targetRootNodes = targetMap.rootNodes || [];
            let targetNode = null;
            for (const rootNode of targetRootNodes) {
              targetNode = findNodeById(rootNode, linkData.targetNodeId);
              if (targetNode) break;
            }
            if (targetNode) {
              label = targetNode.text || targetMap.title || 'リンク';
              // Use saved anchor if available, otherwise compute it
              const anchor = linkData.targetAnchor || computeAnchorForNode(targetMap.rootNodes?.[0], targetNode.id);
              const rel = relPathBetweenMapIds(currentMapId, targetMap.mapIdentifier.mapId);
              href = anchor ? `${rel}#${encodeURIComponent(anchor)}` : rel;
            }
          } else {
            label = targetMap.title || 'リンク';
            const rel = relPathBetweenMapIds(currentMapId, targetMap.mapIdentifier.mapId);
            href = rel;
          }
        }
      }

      // Append to note
      const currentNote = destNode.note || '';
      const prefix = currentNote.trim().length > 0 ? '\n\n' : '';
      const linkText = href ? `[${label}](${href})` : `[${label}]`;
      const appended = `${currentNote}${prefix}${linkText}\n`;
      store.updateNode(linkModalNodeId, { note: appended });
      showNotification('success', 'ノートにリンクを追加しました');
    } catch (error) {
      logger.error('Link save error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの保存');
    }
  };;

  const handleDeleteLink = async (linkId: string) => {
    if (!linkModalNodeId) return;

    try {
      store.deleteNodeLink(linkModalNodeId, linkId);
      showNotification('success', 'リンクを削除しました');
    } catch (error) {
      logger.error('Link delete error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの削除');
    }
  };

  // Ensure selected node remains visible with minimal pan (no centering)
  const ensureSelectedNodeVisible = React.useCallback(() => {
    try {
      const st = useMindMapStore.getState() as any;
      const selId: string | null = st.selectedNodeId || null;
      const mapData = st.data || null;
      if (!selId || !mapData) return;
      const roots = mapData.rootNodes || [];
      const targetNode = findNodeInRoots(roots, selId);
      if (!targetNode) return;

      // Get current UI state from store (not from component closure)
      const currentUI = st.ui || {};
      const currentActiveView = currentUI.activeView;
      const currentSidebarCollapsed = currentUI.sidebarCollapsed;


      const mindmapContainer = document.querySelector('.mindmap-canvas-container') ||
                               document.querySelector('.workspace-container') ||
                               document.querySelector('.mindmap-app');

      let effectiveWidth = window.innerWidth;
      let effectiveHeight = window.innerHeight;
      let offsetX = 0;
      let offsetY = 0;


      if (mindmapContainer) {
        const rect = mindmapContainer.getBoundingClientRect();
        effectiveWidth = rect.width;
        effectiveHeight = rect.height;
        offsetX = rect.left;
        offsetY = rect.top;

        // Even when using container, we need to check if sidebar should be considered
        // Container might already account for sidebar, but let's verify the offsetX
        if (currentActiveView && !currentSidebarCollapsed && offsetX === 0) {
          // Container doesn't account for sidebar, so we need to adjust
          const ACTIVITY_BAR_WIDTH = 48;
          const sidebarPanel = document.querySelector('.mindmap-sidebar') as HTMLElement | null;
          let sidebarWidth = 0;
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              sidebarWidth = sidebarRect.width;
            } catch {}
          } else {
            sidebarWidth = 280; // fallback
          }
          const totalLeftOffset = ACTIVITY_BAR_WIDTH + sidebarWidth;
          offsetX = totalLeftOffset;
        }
      } else {
        // Left sidebar - use same pattern as panels: DOM first, fallback to store/fixed values
        const ACTIVITY_BAR_WIDTH = 48;
        const SIDEBAR_WIDTH = 280; // fallback
        let leftPanelWidth = ACTIVITY_BAR_WIDTH;

        if (currentActiveView && !currentSidebarCollapsed) {
          // Try to get actual sidebar width from DOM first (like panels)
          const sidebarPanel = document.querySelector('.mindmap-sidebar') as HTMLElement | null;
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              leftPanelWidth += sidebarRect.width;
            } catch {}
          } else {
            // Fallback to fixed width if DOM not available
            leftPanelWidth += SIDEBAR_WIDTH;
          }
        }


        effectiveWidth -= leftPanelWidth;
        offsetX = leftPanelWidth;

        // Right-side markdown panel (primary right panel in this app)
        const markdownPanel = document.querySelector('.markdown-panel') as HTMLElement | null;
        if (markdownPanel) {
          try {
            const pr = markdownPanel.getBoundingClientRect();
            effectiveWidth -= pr.width;
          } catch {}
        } else if (currentUI.showNotesPanel && currentUI.markdownPanelWidth) {
          // Fallback to store width if DOM not yet available
          const w = Math.max(0, currentUI.markdownPanelWidth);
          effectiveWidth -= w;
        }
      }

      // Bottom overlays (apply regardless of container measurement):
      // selected-node-note-panel is fixed overlay and not part of container height
      try {
        const notePanel = document.querySelector('.selected-node-note-panel') as HTMLElement | null;
        const noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
        effectiveHeight -= noteH;
      } catch {}
      // Vim status bar height
      effectiveHeight -= 24;

      const currentZoom = (st.ui?.zoom || 1) * 1.5; // Match CanvasRenderer transform
      const currentPan = st.ui?.pan || { x: 0, y: 0 };

      // Compute node size to align edges to bounds
      const fontSize = (st.settings?.fontSize ?? 14) as number;
      const nodeSize = calculateNodeSize(targetNode as any, undefined as any, false, fontSize);
      const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
      const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

      // Node center in screen coords relative to effective viewport origin
      const screenX = currentZoom * (targetNode.x + currentPan.x) - offsetX;
      const screenY = currentZoom * (targetNode.y + currentPan.y) - offsetY;

      const margin = 0;
      const topMargin = 0; // symmetric top/bottom
      const bottomExtra = (function() {
        // If no note panel height (not visible), keep 6px breathing room above Vim bar
        try {
          const notePanel = document.querySelector('.selected-node-note-panel') as HTMLElement | null;
          const noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
          return noteH === 0 ? 6 : 0;
        } catch { return 0; }
      })();
      const leftBound = margin;
      const rightBound = effectiveWidth - margin;
      const topBound = topMargin;
      const bottomBound = effectiveHeight - topMargin - bottomExtra;

      const isOutsideLeft = (screenX - halfW) < leftBound;
      const isOutsideRight = (screenX + halfW) > rightBound;
      const isOutsideTop = (screenY - halfH) < topBound;
      const isOutsideBottom = (screenY + halfH) > bottomBound;

      if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
        let newPanX = currentPan.x;
        let newPanY = currentPan.y;

        if (isOutsideLeft) {
          // Align node's left edge to leftBound
          newPanX = ((leftBound + offsetX + halfW) / currentZoom) - targetNode.x;
        } else if (isOutsideRight) {
          // Align node's right edge to rightBound
          newPanX = ((rightBound + offsetX - halfW) / currentZoom) - targetNode.x;
        }

        if (isOutsideTop) {
          // Align node's top edge to topBound
          newPanY = ((topBound + offsetY + halfH) / currentZoom) - targetNode.y;
        } else if (isOutsideBottom) {
          // Align node's bottom edge to bottomBound
          newPanY = ((bottomBound + offsetY - halfH) / currentZoom) - targetNode.y;
        }

        const setPanLocal = (st.setPan || setPan);
        setPanLocal({ x: newPanX, y: newPanY });
      }
    } catch {}
  }, [activeView, uiStore.sidebarCollapsed, uiStore.showNotesPanel, uiStore.markdownPanelWidth]);

  // ノードが見切れないように最小限のスクロールで可視範囲に入れる
  const centerNodeInView = useCallback((nodeId: string, animate = false, fallbackCoords?: { x: number; y: number } | { mode: string }) => {

    if (!data) return;

    // Check if special positioning mode is requested
    const isLeftMode = fallbackCoords && 'mode' in fallbackCoords && (fallbackCoords as any).mode === 'left';
    const isCenterMode = fallbackCoords && 'mode' in fallbackCoords && (fallbackCoords as any).mode === 'center';


    // ルートノードの場合は最適化（検索を省略）
    const rootNodes = data.rootNodes || [];
    let targetNode = rootNodes.length > 0 && rootNodes[0].id === nodeId
      ? rootNodes[0]
      : findNodeInRoots(rootNodes, nodeId);

    // UI状態に基づいて実際の利用可能な領域を計算
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 左側パネル幅はUI状態から推定（固定値を使用）
    const ACTIVITY_BAR_WIDTH = 48;
    const SIDEBAR_WIDTH = 280;
    const leftPanelWidth = ACTIVITY_BAR_WIDTH + (activeView && !uiStore.sidebarCollapsed ? SIDEBAR_WIDTH : 0);

    // 右側はUI状態から取得された実幅（パネル自体がストアへwidthを反映）
    const rightPanelWidth = uiStore.showNotesPanel ? (uiStore.markdownPanelWidth || 0) : 0;

    // 実際の利用可能なマップエリアを計算
    // 上端はツールバー固定高（CSSと一致させる）
    const VIM_HEIGHT = 24;
    const defaultNoteHeight = Math.round(window.innerHeight * 0.3);
    // Prefer store height, but unconditionally read DOM to avoid stale flags
    let noteHeight = uiStore.showNodeNotePanel
      ? (uiStore.nodeNotePanelHeight && uiStore.nodeNotePanelHeight > 0 ? uiStore.nodeNotePanelHeight : defaultNoteHeight)
      : 0;
    let domNoteHeight = 0;
    try {
      const el = document.querySelector('.selected-node-note-panel') as HTMLElement | null;
      domNoteHeight = el ? Math.round(el.getBoundingClientRect().height) : 0;
    } catch {}
    if (domNoteHeight > 0 && domNoteHeight !== noteHeight) {
      noteHeight = domNoteHeight;
      try { console.warn('[Viewport] noteHeight override via DOM', { domNoteHeight }); } catch {}
    }
    const bottomOverlay = Math.max(noteHeight, VIM_HEIGHT);

    const mapAreaRect = new DOMRect(
      leftPanelWidth,
      0,
      Math.max(0, viewportWidth - leftPanelWidth - rightPanelWidth),
      Math.max(0, viewportHeight - bottomOverlay)
    );

    if (!targetNode) {
      if (fallbackCoords && 'x' in fallbackCoords && 'y' in fallbackCoords) {
        // フォールバック座標を使用してセンタリング
        const nodeX = fallbackCoords.x;
        const nodeY = fallbackCoords.y;

        const positionRatio = isLeftMode ? 0.1 : 0.5; // 左寄り10%または中央50%
        const targetX = mapAreaRect.left + (mapAreaRect.width * positionRatio);
        const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
        const currentZoom = ui.zoom * 1.5;

        const newPanX = targetX / currentZoom - nodeX;
        const newPanY = targetY / currentZoom - nodeY;

        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // ノードの現在の座標
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    // 現在のズーム率を取得（SVGでは1.5倍されている）
    const currentZoom = uiStore.zoom * 1.5;

    // isLeftMode: 特例として左寄せに配置
    if (isLeftMode) {
      const targetX = mapAreaRect.left + (mapAreaRect.width * 0.1);
      const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
      const newPanX = targetX / currentZoom - nodeX;
      const newPanY = targetY / currentZoom - nodeY;

      if (animate) {
        const currentPan = uiStore.pan;
        const steps = 16;
        const duration = 250;
        const stepDuration = duration / steps;
        const deltaX = (newPanX - currentPan.x) / steps;
        const deltaY = (newPanY - currentPan.y) / steps;
        let step = 0;
        const animateStep = () => {
          if (step < steps) {
            step++;
            const currentX = currentPan.x + (deltaX * step);
            const currentY = currentPan.y + (deltaY * step);
            if (step % 2 === 0 || step === steps) {
              setPan({ x: currentX, y: currentY });
            }
            window.setTimeout(animateStep, stepDuration);
          }
        };
        window.setTimeout(animateStep, 0);
      } else {
        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // isCenterMode: 正確に中央に配置（zz 対応）
    if (isCenterMode) {
      const targetX = mapAreaRect.left + (mapAreaRect.width / 2);
      const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
      const newPanX = targetX / currentZoom - nodeX;
      const newPanY = targetY / currentZoom - nodeY;

      if (animate) {
        const currentPan = uiStore.pan;
        const steps = 16;
        const duration = 250;
        const stepDuration = duration / steps;
        const deltaX = (newPanX - currentPan.x) / steps;
        const deltaY = (newPanY - currentPan.y) / steps;
        let step = 0;
        const animateStep = () => {
          if (step < steps) {
            step++;
            const currentX = currentPan.x + (deltaX * step);
            const currentY = currentPan.y + (deltaY * step);
            if (step % 2 === 0 || step === steps) {
              setPan({ x: currentX, y: currentY });
            }
            window.setTimeout(animateStep, stepDuration);
          }
        };
        window.setTimeout(animateStep, 0);
      } else {
        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // 通常モード: 最小パンで可視域に入れる（ノードサイズも考慮）
      const margin = 0; // 余白なし（上下左右）
    const nodeSize = calculateNodeSize(targetNode as any, undefined as any, false, (store as any).settings?.fontSize || 14);
    const halfW = (nodeSize?.width || 80) / 2 * currentZoom;
    const halfH = (nodeSize?.height || 24) / 2 * currentZoom;
    // 現在のスクリーン座標（ノード中心）
    const screenX = currentZoom * (nodeX + uiStore.pan.x);
    const screenY = currentZoom * (nodeY + uiStore.pan.y);
    const leftBound = mapAreaRect.left + margin;
    const rightBound = mapAreaRect.right - margin;
    const topBound = mapAreaRect.top + margin;
    // If no note panel is visible, keep 6px breathing room above the Vim bar
    const bottomExtra = noteHeight > 0 ? 0 : 6;
    const bottomBound = mapAreaRect.bottom - (margin + bottomExtra);

    

    let deltaScreenX = 0;
    let deltaScreenY = 0;
    const epsilon = 0; // 余計なゆとりを排除
    // 左右
    if ((screenX - halfW) < (leftBound + epsilon)) {
      deltaScreenX = (leftBound + epsilon) - (screenX - halfW);
    } else if ((screenX + halfW) > (rightBound - epsilon)) {
      deltaScreenX = (rightBound - epsilon) - (screenX + halfW);
    }
    // 上下
    if ((screenY - halfH) < (topBound + epsilon)) {
      deltaScreenY = (topBound + epsilon) - (screenY - halfH);
    } else if ((screenY + halfH) > (bottomBound - epsilon)) {
      deltaScreenY = (bottomBound - epsilon) - (screenY + halfH);
    }

    

    if (deltaScreenX === 0 && deltaScreenY === 0) {
      try { logger.debug('[Viewport] no pan needed'); } catch {}
      return; // 既に可視範囲
    }

    const newPanX = uiStore.pan.x + (deltaScreenX / currentZoom);
    const newPanY = uiStore.pan.y + (deltaScreenY / currentZoom);

    if (animate) {
      // 非同期アニメーション（ユーザー操作をブロックしない）
      const currentPan = uiStore.pan;
      const steps = 16; // ステップ数
      const duration = 250; // 短時間
      const stepDuration = duration / steps;

      const deltaX = (newPanX - currentPan.x) / steps;
      const deltaY = (newPanY - currentPan.y) / steps;

      let step = 0;

      const animateStep = () => {
        if (step < steps) {
          step++;
          const currentX = currentPan.x + (deltaX * step);
          const currentY = currentPan.y + (deltaY * step);

          // setState を間引いて負荷軽減（2ステップごと）
          if (step % 2 === 0 || step === steps) {
            setPan({ x: currentX, y: currentY });
          }

          // setTimeout で間隔を空けてブロッキングを防ぐ
          window.setTimeout(animateStep, stepDuration);
        }
      };

      // 最初のステップを開始
      window.setTimeout(animateStep, 0);
    } else {
      // 即座にパンを更新
      setPan({ x: newPanX, y: newPanY });
      
    }
  }, [data, uiStore.zoom, uiStore.pan, setPan]);

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
    pasteImageFromClipboard: async (nodeId?: string) => {
      try {
        // Use provided nodeId or currently selected node
        const targetNodeId = nodeId || selectedNodeId;
        if (!targetNodeId) {
          showNotification('warning', '画像を貼り付けるノードを選択してください');
          return;
        }

        // Check if storage adapter is available
        if (!storageAdapter) {
          showNotification('error', 'ストレージが初期化されていません');
          return;
        }

        // Find the target node
        const targetNode = findNodeInRoots(data?.rootNodes || [], targetNodeId);
        if (!targetNode) {
          showNotification('error', 'ノードが見つかりません');
          return;
        }

        // Save image and get relative path
        const imagePath = await imagePasteService.pasteImageToNode(
          targetNodeId,
          storageAdapter,
          data?.mapIdentifier?.workspaceId,
          data?.mapIdentifier?.mapId
        );

        // Add image markdown to the end of the node's note
        const currentNote = targetNode.note || '';
        const imageMarkdown = `![](${imagePath})`;
        const newNote = currentNote
          ? `${currentNote}\n\n${imageMarkdown}`
          : imageMarkdown;

        // Update the node with new note
        updateNode(targetNodeId, { note: newNote });

        // Refresh the explorer to show the new image file
        await refreshMapList();

        showNotification('success', '画像を貼り付けました');
      } catch (error) {
        console.error('Failed to paste image:', error);
        const message = error instanceof Error ? error.message : '画像の貼り付けに失敗しました';
        showNotification('error', message);
      }
    },
    pasteNodeFromClipboard: async (parentId: string) => {
      const clipboardNode = uiStore.clipboard;
      if (!clipboardNode) { showNotification('warning', 'コピーされたノードがありません'); return; }
      const paste = (nodeToAdd: MindMapNode, parent: string): string | undefined => {
        const newNodeId = store.addChildNode(parent, nodeToAdd.text);
        if (newNodeId) {
          updateNode(newNodeId, { fontSize: nodeToAdd.fontSize, fontWeight: nodeToAdd.fontWeight, color: nodeToAdd.color, collapsed: false });
          nodeToAdd.children?.forEach(child => paste(child, newNodeId));
        }
        return newNodeId;
      };
      const newId = paste(clipboardNode, parentId);
      if (newId) { showNotification('success', `「${clipboardNode.text}」を貼り付けました`); selectNode(newId); }
    },
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
        onAddWorkspace={addWorkspace as any}
        onRemoveWorkspace={removeWorkspace as any}
        explorerTree={(mindMap as any).explorerTree || null}
        onCreateFolder={async (path: string) => {
          if (typeof (mindMap as any).createFolder === 'function') {
            // フルパスからworkspaceIdと相対パスを分離
            const wsMatch = path.match(/^\/?(ws_[^/]+)\/?(.*)$/);
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

            if (!currentMapData) return;

            const searchResult = findNodeByLineNumber(currentMapData, lineNumber);

            if (searchResult?.node?.id) {
              const foundNodeId = searchResult.node.id;
              selectNode(foundNodeId);
              centerNodeInView(foundNodeId, false);
            }
          },
          [selectNode, centerNodeInView])}
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
