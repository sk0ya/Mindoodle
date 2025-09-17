import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '../../../../core';
import { useVimMode } from '../../../../core/hooks/useVimMode';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import ActivityBar from './ActivityBar';
import PrimarySidebarContainer from './PrimarySidebarContainer';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspaceContainer from './MindMapWorkspaceContainer';
import MindMapModals from '../modals/MindMapModals';
import FolderGuideModal from '../modals/FolderGuideModal';
import { useFolderGuide } from './useFolderGuide';
import MindMapLinkOverlays from './MindMapLinkOverlays';
import NodeNotesPanelContainer from './NodeNotesPanelContainer';
// Outline mode removed
import MindMapContextMenuOverlay from './MindMapContextMenuOverlay';
import { useNotification } from '../../../../shared/hooks/useNotification';
import { useMarkdownSync } from '../../../../shared/hooks/useMarkdownSync';
import { resolveAnchorToNode, computeAnchorForNode } from '../../../../shared/utils/markdownLinkUtils';
import { navigateLink } from '../../../../shared/utils/linkNavigation';
import { useErrorHandler } from '../../../../shared/hooks/useErrorHandler';
import { useGlobalErrorHandlers } from '../../../../shared/hooks/useGlobalErrorHandlers';
import { useRetryableUpload } from '../../../../shared/hooks/useRetryableUpload';
import { useAI } from '../../../../core/hooks/useAI';
import { useTheme } from '../../../../shared/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
import { useFileHandlers } from './useFileHandlers';
import MindMapProviders from './MindMapProviders';
import { logger } from '../../../../shared/utils/logger';
import MindMapOverlays from './MindMapOverlays';
import './MindMapApp.css';

// Types
import type { MindMapNode, MindMapData, NodeLink, MapIdentifier } from '@shared/types';
import type { StorageConfig } from '../../../../core/storage/types';
// Storage configurations
// Deprecated storage configs (Mindoodle uses markdown adapter internally)
// Login modal moved into MindMapOverlays

import { useShortcutHandlers } from './useShortcutHandlers';

interface MindMapAppProps {
  storageMode?: 'local' | 'markdown';
  onModeChange?: (mode: 'local' | 'markdown') => void;
  resetKey?: number;
}

const MindMapAppContent: React.FC<MindMapAppProps> = ({ 
  storageMode = 'local', 
  onModeChange,
  resetKey = 0
}) => {
  
  const { showNotification } = useNotification();
  const { handleError, handleAsyncError } = useErrorHandler();
  const markdownSync = useMarkdownSync();
  const { retryableUpload } = useRetryableUpload({
    maxRetries: 3,
    retryDelay: 2000, // 2秒
    backoffMultiplier: 1.5, // 1.5倍ずつ増加
  });
  
  // Settings store for initialization
  const { loadSettingsFromStorage } = useMindMapStore();
  
  // Initialize settings on mount
  React.useEffect(() => {
    loadSettingsFromStorage();
  }, [loadSettingsFromStorage]);
  
  
  // VSCode風サイドバーの状態
  const [activeView, setActiveView] = useState<string | null>('maps');
  
  // グローバルエラーハンドラーの設定を簡潔に
  useGlobalErrorHandlers(handleError);
  const [isAppReady] = useState(true);
  const [internalResetKey, setResetKey] = useState(resetKey);
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
  
  const store = useMindMapStore();
  
  // AI functionality
  const ai = useAI();
  
  // テーマ管理
  useTheme();

  // Sync external resetKey with internal resetKey
  React.useEffect(() => {
    setResetKey(resetKey);
  }, [resetKey]);

  // Folder guide modal state (extracted)
  const { showFolderGuide, closeGuide, markDismissed } = useFolderGuide();

  // Handle mode changes (loginModal削除済み)
  React.useEffect(() => {
      // ログインモーダル関連は削除されました
  }, [storageMode]);
  
  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    return { mode: 'markdown' } as StorageConfig;
  }, []);
  
  // リセットキーでuseMindMapを強制リセット
  const mindMap = useMindMap(isAppReady, storageConfig, Math.max(resetKey, internalResetKey));
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
    selectNode,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing,
    
    // UI操作
    showImageModal,
    showFileActionMenu,
    closeAllPanels,
    setZoom,
    setPan,
    setEditText,
    changeSiblingOrder,
    toggleNodeCollapse,
    
    // マップ操作
    createAndSelectMap,
    selectMapById,
    deleteMap,
    updateMapMetadata,
    applyAutoLayout,
    
    // 履歴操作
    undo,
    redo,
    workspaces,
    addWorkspace,
    removeWorkspace
  } = mindMap;

  // ファイルハンドラーを外部フックに委譲
  const { uploadFile, downloadFile, deleteFile } = useFileHandlers({
    data,
    updateNode,
    showNotification,
    handleError,
    handleAsyncError,
    retryableUpload,
  });

  // Bridge workspaces to sidebar via globals (quick wiring)
  React.useEffect(() => {
    (window as any).mindoodleWorkspaces = workspaces || [];
    (window as any).mindoodleAddWorkspace = async () => { try { await (addWorkspace as any)?.(); await (mindMap as any).refreshMapList?.(); } catch {} };
    (window as any).mindoodleRemoveWorkspace = async (id: string) => { try { await (removeWorkspace as any)?.(id); await (mindMap as any).refreshMapList?.(); } catch {} };
  }, [workspaces, addWorkspace, removeWorkspace, mindMap]);

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
  const updateMultipleMapCategories = React.useCallback(async (mapUpdates: Array<{id: string, category: string}>) => {
    logger.debug('Updating multiple map categories:', mapUpdates);
    
    if (mapUpdates.length === 0) return;
    
    try {
      // 一括でマップ情報を更新
      const updatedMaps = mapUpdates.map(update => {
        const mapToUpdate = allMindMaps.find(map => map.mapIdentifier.mapId === update.id);
        if (!mapToUpdate) return null;
        
        return {
          ...mapToUpdate,
          category: update.category,
          updatedAt: new Date().toISOString()
        };
      }).filter(Boolean);
      
      logger.debug(`Batch updating ${updatedMaps.length} maps`);
      
      // 各マップを並列更新（非同期処理を並列実行）
      await Promise.all(
        updatedMaps.map(async (updatedMap) => {
          if (updatedMap) {
            logger.debug(`Updating map "${(updatedMap as any).title}" to "${(updatedMap as any).category}"`);
            if (typeof (mindMap as any).updateMapInList === 'function') {
              await (mindMap as any).updateMapInList(updatedMap);
            }
          }
        })
      );
      
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
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  };

  // ファイルハンドラーは useFileHandlers に移譲

  // ダウンロード/削除は useFileHandlers に委譲（downloadFile/deleteFile を直接使用）

  // ユーティリティ関数

  // Context menu handlers
  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    
    // リンクリストまたは添付ファイルリスト表示中は右クリックコンテキストメニューを無効化
    if (ui.showLinkListForNode || ui.showAttachmentListForNode) {
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
      const targetMap = allMindMaps.find(map => map.mapIdentifier.mapId === mapIdentifier.mapId && map.mapIdentifier.workspaceId === mapIdentifier.workspaceId);
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
      if (typeof (mindMap as any).readImageAsDataURL === 'function') {
        const workspaceId = data?.mapIdentifier?.workspaceId;
        return await (mindMap as any).readImageAsDataURL(relativePath, workspaceId);
      }

      return null;
    } catch (error) {
      console.warn('Failed to load relative image:', relativePath, error);
      return null;
    }
  }, [mindMap, data]);

  // UI用のハンドラー
  const handleTitleChange = (title: string) => {
    if (data) {
      updateMapMetadata(data.mapIdentifier, { title });
    }
  };

  // インポート/エクスポート機能は削除済み

  // Listen to explorer selection events
  React.useEffect(() => {
    const handler = async (e: any) => {
      const id = e?.detail?.mapId as string | undefined;
      const ws = e?.detail?.workspaceId as string;
      if (id && typeof selectMapById === 'function') {
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

      // Helper to compute relative path idA -> idB
      const toRelPath = (fromId: string, toId: string): string => {
        const fromSegs = (fromId.split('/') as string[]);
        fromSegs.pop(); // remove filename component
        const toSegs = toId.split('/');
        let i = 0; while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) i++;
        const up = new Array(fromSegs.length - i).fill('..');
        const down = toSegs.slice(i);
        const joined = [...up, ...down].join('/');
        return joined.length ? `${joined}.md` : `${toId.split('/').pop()}.md`;
      };

      // Determine label and href
      if (targetMapId === currentMapId) {
        if (linkData.targetNodeId) {
          const rootNodes = data.rootNodes || [];
          let targetNode = null;
          for (const rootNode of rootNodes) {
            targetNode = findNodeById(rootNode, linkData.targetNodeId);
            if (targetNode) break;
          }
          if (targetNode) {
            label = targetNode.text || 'リンク';
            const anchor = computeAnchorForNode(data.rootNodes?.[0], targetNode.id) || label;
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
              const anchor = computeAnchorForNode(targetMap.rootNodes?.[0], targetNode.id);
              const rel = toRelPath(currentMapId, targetMap.mapIdentifier.mapId);
              href = anchor ? `${rel}#${encodeURIComponent(anchor)}` : rel;
            }
          } else {
            label = targetMap.title || 'リンク';
            const rel = toRelPath(currentMapId, targetMap.mapIdentifier.mapId);
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
  };

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

  // ノードを画面中央に移動する関数（最適化済み）
  const centerNodeInView = useCallback((nodeId: string, animate = false) => {
    if (!data) return;

    // ルートノードの場合は最適化（検索を省略）
    const rootNodes = data.rootNodes || [];
    let targetNode = null;

    if (rootNodes.length > 0 && rootNodes[0].id === nodeId) {
      targetNode = rootNodes[0];
    } else {
      // その他のノードは検索
      for (const rootNode of rootNodes) {
        targetNode = findNodeById(rootNode, nodeId);
        if (targetNode) break;
      }
    }
    if (!targetNode) return;

    // ビューポートの中心座標を計算
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    // ノードの現在の座標
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    // 現在のズーム率を取得（SVGでは1.5倍されている）
    const currentZoom = ui.zoom * 1.5;

    // SVGの transform="scale(s) translate(tx, ty)" の場合、
    // 最終座標は s * (x + tx) となるため、中央に配置するには：
    // centerX = currentZoom * (nodeX + panX) → panX = centerX/currentZoom - nodeX
    const newPanX = viewportCenterX / currentZoom - nodeX;
    const newPanY = viewportCenterY / currentZoom - nodeY;

    if (animate) {
      // 非同期アニメーション（ユーザー操作をブロックしない）
      const currentPan = ui.pan;
      const steps = 16; // ステップ数を削減（20→16）
      const duration = 250; // 短時間化（300→250ms）
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
  }, [data, ui.zoom, ui.pan, setPan]);

  // ルートノードを中央に表示するハンドラー
  const handleCenterRootNode = useCallback(() => {
    if (data?.rootNodes?.[0]) {
      centerNodeInView(data.rootNodes[0].id, false);
    }
  }, [data?.rootNodes, centerNodeInView]);

  // マップが切り替わった時の前のマップIDを記録
  const [prevMapId, setPrevMapId] = React.useState<string | null>(null);

  // マップが初期化された時やマップ切り替え時にルートノードを選択し中央に表示（非同期化）
  React.useEffect(() => {
    const currentMapId = data?.mapIdentifier?.mapId;

    if (data?.rootNodes?.[0] && currentMapId) {
      const rootNodeId = data.rootNodes[0].id;

      // マップが切り替わった場合のみ処理を実行
      const mapChanged = currentMapId !== prevMapId;

      if (mapChanged) {
        // 即座にノード選択
        selectNode(rootNodeId);

        // 中央移動処理を非同期で実行（ユーザー操作をブロックしない）
        setTimeout(() => {
          // さらに非同期で中央移動を実行（UIスレッドを開放）
          requestIdleCallback(() => {
            centerNodeInView(rootNodeId, false);
          }, { timeout: 200 });
        }, 50); // より短い遅延
      }

      // 現在のマップIDを記録
      if (currentMapId !== prevMapId) {
        setPrevMapId(currentMapId);
      }
    }
  }, [data?.rootNodes, data?.mapIdentifier?.mapId, selectedNodeId, selectNode, centerNodeInView, prevMapId]);

  // Simplified link navigation via utility
  const handleLinkNavigate2 = async (link: NodeLink) => {
    await navigateLink(link, {
      currentMapId,
      dataRoot: data?.rootNodes?.[0],
      selectMapById,
      currentWorkspaceId: (data as any)?.mapIdentifier?.workspaceId as string,
      selectNode,
      centerNodeInView,
      notify: showNotification,
      getCurrentRootNode: () => useMindMapStore.getState().data?.rootNodes?.[0] || null,
      resolveAnchorToNode,
    });
  };

  const handleShowLinkActionMenu = openLinkActionMenu;

  // キーボードショートカット設定（ハンドラー組み立てを外部化）
  const finishEditingWrapper = (nodeId: string, text?: string) => {
    if (text !== undefined) finishEditing(nodeId, text);
  };
  const shortcutHandlers = useShortcutHandlers({
    data: data ? { rootNode: data.rootNodes?.[0] } : null,
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
    pasteImageFromClipboard: async (nodeId: string) => {
      const { readClipboardImageAsFile } = await import('../../../../shared/utils/clipboard');
      const file = await readClipboardImageAsFile();
      await uploadFile(nodeId, file);
      showNotification('success', '画像を貼り付けました');
    },
    pasteNodeFromClipboard: async (parentId: string) => {
      const clipboardNode = ui.clipboard;
      if (!clipboardNode) { showNotification('warning', 'コピーされたノードがありません'); return; }
      const paste = (nodeToAdd: MindMapNode, parent: string): string | undefined => {
        const newNodeId = store.addChildNode(parent, nodeToAdd.text);
        if (newNodeId) {
          updateNode(newNodeId, { fontSize: nodeToAdd.fontSize, fontWeight: nodeToAdd.fontWeight, color: nodeToAdd.color, collapsed: false, attachments: nodeToAdd.attachments || [] });
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
            showNotification('warning', `変換できません: ${errorMessage}`);
            return;
          }

          const newData = { ...data, rootNodes: updatedNodes };
          store.setData(newData);

          // 強制的に再レンダリングをトリガーしてマーカーを即座に更新
          setTimeout(() => {
            selectNode(null);
            setTimeout(() => {
              selectNode(nodeId);
            }, 1);
          }, 1);
        });
      }
    },
    changeSiblingOrder: store.changeSiblingOrder,
  });
  // Vim mode hook
  const vim = useVimMode();

  useKeyboardShortcuts(shortcutHandlers as any, vim);
  const handleCloseLinkActionMenu = closeLinkActionMenu;

  // Outline save feature removed

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="mindmap-app"
      tabIndex={0}
      onFocus={() => {
        // Vimium対策: アプリケーションにフォーカス時にフォーカス状態を維持
      }}
      style={{ outline: 'none' }}
    >
      <ActivityBar
        activeView={activeView}
        onViewChange={setActiveView}
        onShowKeyboardHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
      />
      
      <PrimarySidebarContainer
        activeView={activeView}
        storageMode={storageMode}
        onModeChange={onModeChange}
        allMindMaps={allMindMaps}
        currentMapId={currentMapId}
        onSelectMap={async (id) => {
          await selectMapById(id);
        }}
        onCreateMap={(title: string, category?: string) => createAndSelectMap(title, data?.mapIdentifier.workspaceId, category)}
        onDeleteMap={deleteMap}
        onRenameMap={(id, title) => updateMapMetadata(id, { title })}
        onChangeCategory={(id, category) => updateMapMetadata(id, { category })}
        onChangeCategoryBulk={updateMultipleMapCategories}
        onShowKeyboardHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
        onAutoLayout={() => {
          logger.info('Manual auto layout triggered');
          if (typeof mindMap.applyAutoLayout === 'function') {
            mindMap.applyAutoLayout();
          } else {
            logger.error('applyAutoLayout function not available');
          }
        }}
        workspaces={workspaces as any}
        onAddWorkspace={addWorkspace as any}
        onRemoveWorkspace={removeWorkspace as any}
        explorerTree={(mindMap as any).explorerTree || null}
        onCreateFolder={async (path: string) => {
          if (typeof (mindMap as any).createFolder === 'function') {
            await (mindMap as any).createFolder(path);
          }
        }}
        currentMapData={data}
        onNodeSelect={(nodeId) => { selectNode(nodeId); centerNodeInView(nodeId); }}
        onMapSwitch={async (id) => { await selectMapById(id); }}
      />

      <div className={`mindmap-main-content ${activeView ? 'with-sidebar' : ''}`}>
        <FolderGuideModal 
          isOpen={showFolderGuide}
          onClose={closeGuide}
          onSelectFolder={async () => { await handleSelectFolder(); markDismissed(); }}
        />
        <MindMapHeader 
          data={data}
          onTitleChange={handleTitleChange}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={ui.zoom}
          onZoomReset={() => setZoom(1.0)}
          onAutoLayout={() => {
            logger.info('Manual auto layout triggered');
            if (typeof mindMap.applyAutoLayout === 'function') {
              mindMap.applyAutoLayout();
            } else {
              logger.error('applyAutoLayout function not available');
            }
          }}
          storageMode={storageMode}
          onStorageModeChange={onModeChange as ((mode: 'local' | 'markdown') => void) | undefined}
          onToggleNotesPanel={() => store.toggleNotesPanel()}
          showNotesPanel={ui.showNotesPanel}
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
                // ノート表示フラグが有効な場合のみノートパネルを表示
                // ノートフラグが無効な場合はノード選択してもノートパネルを表示しない
              }}
              onStartEdit={startEditing}
              onFinishEdit={finishEditing}
              onMoveNode={moveNode}
              onChangeSiblingOrder={changeSiblingOrder}
              onAddChild={(parentId) => { addNode(parentId); }}
              onAddSibling={(nodeId) => { store.addSiblingNode(nodeId); }}
              onDeleteNode={deleteNode}
              onRightClick={handleRightClick}
              onToggleCollapse={toggleNodeCollapse}
              onShowImageModal={showImageModal}
              onShowFileActionMenu={(file, _nodeId, position) => showFileActionMenu(file, position)}
              onShowLinkActionMenu={handleShowLinkActionMenu}
              onAddLink={handleAddLink}
              onUpdateNode={updateNode}
              onAutoLayout={applyAutoLayout}
              availableMaps={allMindMaps.map(map => ({ id: map.mapIdentifier.mapId, title: map.title }))}
              currentMapData={data}
              onLinkNavigate={handleLinkNavigate2}
              zoom={ui.zoom}
              setZoom={setZoom}
              pan={ui.pan}
              setPan={setPan}
              onToggleAttachmentList={store.toggleAttachmentListForNode}
              onToggleLinkList={store.toggleLinkListForNode}
              onLoadRelativeImage={onLoadRelativeImage}
            />

          {ui.showNotesPanel && (
            <NodeNotesPanelContainer
              dataRoot={data}
              selectedNodeId={selectedNodeId}
              onUpdateNode={updateNode}
              onClose={() => store.setShowNotesPanel(false)}
              currentMapIdentifier={data ? data.mapIdentifier : null}
              getMapMarkdown={(mindMap as any).getMapMarkdown}
              saveMapMarkdown={(mindMap as any).saveMapMarkdown}
              setAutoSaveEnabled={(mindMap as any).setAutoSaveEnabled}
            />
          )}
        </div>
      </div>
      
      <MindMapModals 
        ui={ui}
        selectedNodeId={selectedNodeId}
        nodeOperations={{
          findNode: (nodeId: string) => {
            const rootNodes = data?.rootNodes || [];
            let targetNode = null;
            for (const rootNode of rootNodes) {
              targetNode = findNodeById(rootNode, nodeId);
              if (targetNode) break;
            }
            return targetNode;
          },
          onDeleteNode: deleteNode,
          onUpdateNode: updateNode,
          onCopyNode: (node: MindMapNode) => {
            // 内部クリップボードに保存
            store.setClipboard(node);
            // システムクリップボードにMarkdownで書き出し
            const toMd = (n: MindMapNode, level = 0): string => {
              const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
              let md = `${prefix}${n.text}\n`;
              if (n.note?.trim()) md += `${n.note}\n`;
              n.children?.forEach(c => { md += toMd(c, level + 1); });
              return md;
            };
            navigator.clipboard?.writeText?.(toMd(node)).catch(() => {});
            showNotification('success', `「${node.text}」をコピーしました`);
          },
          onPasteNode: async (parentId: string) => {
            // MindMeister形式 → 内部クリップボードの順に貼り付け
            try {
              if (navigator.clipboard && navigator.clipboard.readText) {
                const clipboardText = await navigator.clipboard.readText();
                const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../../../shared/utils/mindMeisterParser');
                if (clipboardText && isMindMeisterFormat(clipboardText)) {
                  const parsedNode = parseMindMeisterMarkdown(clipboardText);
                  if (parsedNode) {
                    const { pasteNodeTree } = await import('../../../../shared/utils/pasteTree');
                    const newId = pasteNodeTree(parsedNode, parentId, store.addChildNode, updateNode);
                    if (newId) { showNotification('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`); selectNode(newId); }
                    return;
                  }
                }
              }
            } catch {}
            const clip = ui.clipboard;
            if (!clip) { showNotification('warning', 'コピーされたノードがありません'); return; }
            const { pasteNodeTree } = await import('../../../../shared/utils/pasteTree');
            const newId = pasteNodeTree(clip, parentId, store.addChildNode, updateNode);
            if (newId) { showNotification('success', `「${clip.text}」を貼り付けました`); selectNode(newId); }
          },
          onShowCustomization: (node: MindMapNode) => {
            selectNode(node.id);
            store.showCustomization({ x: ui.contextMenuPosition.x, y: ui.contextMenuPosition.y });
          },
          onAddChild: (parentId: string, text?: string) => {
            return store.addChildNode(parentId, text || 'New Node');
          }
        }}
        fileOperations={{
          onFileDownload: downloadFile,
          onFileRename: async (fileId: string, newName: string) => {
            try {
              if (!data) return;
              const nodeId = ui.selectedFile?.nodeId || selectedNodeId;
              if (!nodeId) return;
              const rootNodes = data.rootNodes || [];
              let node = null;
              for (const rootNode of rootNodes) {
                node = findNodeById(rootNode, nodeId);
                if (node) break;
              }
              if (!node || !node.attachments) return;
              const updated = {
                ...node,
                attachments: node.attachments.map(f => f.id === fileId ? { ...f, name: newName } : f)
              };
              updateNode(nodeId, updated);
              showNotification('success', 'ファイル名を変更しました');
            } catch (e) {
              logger.error('Rename failed:', e);
              showNotification('error', 'ファイル名の変更に失敗しました');
            }
          },
          onFileDelete: (fileId: string) => {
            // selectedFileとselectedNodeIdから適切なnodeIdを取得する必要があります
            if (ui.selectedFile && ui.selectedFile.nodeId) {
              deleteFile(ui.selectedFile.nodeId, fileId);
            } else if (ui.selectedFile && selectedNodeId) {
              // fallbackとしてselectedNodeIdを使用
              deleteFile(selectedNodeId, fileId);
            }
          },
          onShowImageModal: showImageModal
        }}
        uiOperations={{
          onCloseContextMenu: closeAllPanels,
          onCloseCustomizationPanel: closeAllPanels,
          onCloseImageModal: closeAllPanels,
          onCloseFileActionMenu: closeAllPanels
        }}
      />
      
      <MindMapOverlays
        showKeyboardHelper={showKeyboardHelper}
        setShowKeyboardHelper={setShowKeyboardHelper}
      />

      <MindMapLinkOverlays
        dataRoot={data.rootNodes?.[0]}
        allMaps={allMindMaps.map(map => ({ mapIdentifier: map.mapIdentifier, title: map.title }))}
        currentMapData={data}
        showLinkModal={showLinkModal}
        linkModalNodeId={linkModalNodeId}
        editingLink={editingLink}
        onCloseLinkModal={closeLinkModal}
        onSaveLink={handleSaveLink}
        onDeleteLink={handleDeleteLink}
        onLoadMapData={loadMapData}
        onSaveFileLink={(filePath: string, label: string) => {
          try {
            if (!linkModalNodeId) return;
            const rootNodes = data.rootNodes || [];
            let destNode = null;
            for (const rootNode of rootNodes) {
              destNode = findNodeById(rootNode, linkModalNodeId);
              if (destNode) break;
            }
            if (!destNode) return;
            const dirOf = (id: string) => { const i = id.lastIndexOf('/'); return i>=0? id.slice(0,i) : ''; };
            const fromDir = dirOf(data.mapIdentifier.mapId);
            const fromSegs = fromDir? fromDir.split('/') : [];
            const toSegs = filePath.split('/');
            let i = 0; while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) i++;
            const up = new Array(fromSegs.length - i).fill('..');
            const down = toSegs.slice(i);
            const rel = [...up, ...down].join('/');
            const href = rel || filePath;
            const currentNote = destNode.note || '';
            const prefix = currentNote.trim().length > 0 ? '\n\n' : '';
            const appended = `${currentNote}${prefix}[${label}](${href})\n`;
            store.updateNode(linkModalNodeId, { note: appended });
            showNotification('success', 'ノートにファイルリンクを追加しました');
          } catch (e) {
            logger.error('Failed to append file link:', e);
            showNotification('error', 'ファイルリンクの追加に失敗しました');
          }
        }}
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
        nodeId={contextMenu.nodeId}
        onDelete={deleteNode}
        onCustomize={(node) => {
          selectNode(node.id);
          store.showCustomization({ x: contextMenu.position.x, y: contextMenu.position.y });
          handleContextMenuClose();
        }}
        onAddLink={(nodeId) => {
          setLinkModalNodeId(nodeId);
          setShowLinkModal(true);
          handleContextMenuClose();
        }}
        onCopyNode={(nodeId) => {
          const rootNodes = data?.rootNodes || [];
          let nodeToFind = null;
          for (const rootNode of rootNodes) {
            nodeToFind = findNodeById(rootNode, nodeId);
            if (nodeToFind) break;
          }
          if (!nodeToFind) return;
          store.setClipboard(nodeToFind);
          const toMd = (node: MindMapNode, level = 0): string => {
            const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
            let md = `${prefix}${node.text}\n`;
            if (node.note?.trim()) md += `${node.note}\n`;
            node.children?.forEach(child => { md += toMd(child, level + 1); });
            return md;
          };
          const markdownText = toMd(nodeToFind);
          navigator.clipboard?.writeText?.(markdownText).catch(() => {});
          showNotification('success', `「${nodeToFind.text}」をコピーしました`);
        }}
        onPasteNode={async (parentId: string) => {
          try {
            if (navigator.clipboard && navigator.clipboard.readText) {
              const clipboardText = await navigator.clipboard.readText();
              const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../../../shared/utils/mindMeisterParser');
              if (clipboardText && isMindMeisterFormat(clipboardText)) {
                const parsedNode = parseMindMeisterMarkdown(clipboardText);
                if (parsedNode) {
                  const paste = (n: MindMapNode, parent: string): string | undefined => {
                    const newId = store.addChildNode(parent, n.text);
                    if (newId) {
                      updateNode(newId, { fontSize: n.fontSize, fontWeight: n.fontWeight, color: n.color, collapsed: false, attachments: n.attachments || [], note: n.note });
                      n.children?.forEach(c => paste(c, newId));
                    }
                    return newId;
                  };
                  const newId = paste(parsedNode, parentId);
                  if (newId) { showNotification('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`); selectNode(newId); }
                  return;
                }
              }
            }
          } catch {}
          const clipboardNode = ui.clipboard;
          if (!clipboardNode) { showNotification('warning', 'コピーされたノードがありません'); return; }
          const paste = (n: MindMapNode, parent: string): string | undefined => {
            const newId = store.addChildNode(parent, n.text);
            if (newId) {
              updateNode(newId, { fontSize: n.fontSize, fontWeight: n.fontWeight, color: n.color, collapsed: false, attachments: n.attachments || [] });
              n.children?.forEach(c => paste(c, newId));
            }
            return newId;
          };
          const newId = paste(clipboardNode, parentId);
          if (newId) { showNotification('success', `「${clipboardNode.text}」を貼り付けました`); selectNode(newId); }
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
                showNotification('warning', `変換できません: ${errorMessage}`);
                return;
              }

              const newData = { ...data, rootNodes: updatedNodes };
              store.setData(newData);
            });
          }
        }}
        onAIGenerate={ai.aiSettings.enabled ? handleAIGenerate : undefined}
        onClose={handleContextMenuClose}
      />
    </div>
  );
};

const MindMapApp: React.FC<MindMapAppProps> = (props) => {
  return (
    <MindMapProviders>
      <MindMapAppContent {...props} />
    </MindMapProviders>
  );
};

export default MindMapApp;
