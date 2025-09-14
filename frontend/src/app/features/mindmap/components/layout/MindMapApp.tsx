import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '../../../../core';
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
import { resolveAnchorToNode, computeAnchorForNode } from '../../../../shared/utils/markdownLinkUtils';
import { navigateLink } from '../../../../shared/utils/linkNavigation';
import { useErrorHandler } from '../../../../shared/hooks/useErrorHandler';
import { useGlobalErrorHandlers } from '../../../../shared/hooks/useGlobalErrorHandlers';
import { useRetryableUpload } from '../../../../shared/hooks/useRetryableUpload';
import { useAI } from '../../../../core/hooks/useAI';
import { useTheme } from '../../../../shared/hooks/useTheme';
import { useMindMapModals } from './useMindMapModals';
import { useVimMode } from '../../../../core/hooks/useVimMode';
import { useFileHandlers } from './useFileHandlers';
import { useCloudAuthGate } from '../../../../core/hooks/useCloudAuthGate';
import MindMapProviders from './MindMapProviders';
import { logger } from '../../../../shared/utils/logger';
import MindMapOverlays from './MindMapOverlays';
import './MindMapApp.css';

// Types
import type { MindMapNode, MindMapData, NodeLink } from '@shared/types';
import type { StorageConfig } from '../../../../core/storage/types';
// Storage configurations
// Deprecated storage configs (Mindoodle uses markdown adapter internally)
// Login modal moved into MindMapOverlays

import { useShortcutHandlers } from './useShortcutHandlers';

interface MindMapAppProps {
  storageMode?: 'local' | 'cloud' | 'markdown';
  onModeChange?: (mode: 'local' | 'cloud' | 'markdown') => void;
  resetKey?: number;
}

const MindMapAppContent: React.FC<MindMapAppProps> = ({ 
  storageMode = 'local', 
  onModeChange,
  resetKey = 0
}) => {
  
  const { showNotification } = useNotification();
  const { handleError, handleAsyncError } = useErrorHandler();
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
  
  // Vim mode hook
  const vim = useVimMode();
  
  // VSCode風サイドバーの状態
  const [activeView, setActiveView] = useState<string | null>('maps');
  
  // グローバルエラーハンドラーの設定を簡潔に
  useGlobalErrorHandlers(handleError);
  const [isAppReady] = useState(true);
  const [internalResetKey, setResetKey] = useState(resetKey);
  // モーダル状態管理
  const {
    showExportModal, setShowExportModal,
    showImportModal, setShowImportModal,
    showLoginModal, setShowLoginModal,
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
  
  // Cloud 認証関連を独立したフックに委譲
  const { auth, isCloudMode } = useCloudAuthGate(
    storageMode,
    setShowLoginModal,
    () => setResetKey(prev => prev + 1)
  );
  const authAdapter = auth?.authAdapter;

  // Sync external resetKey with internal resetKey
  React.useEffect(() => {
    setResetKey(resetKey);
  }, [resetKey]);

  // Folder guide modal state (extracted)
  const { showFolderGuide, openGuide, closeGuide, markDismissed } = useFolderGuide();

  // Handle mode changes - reset modal state when switching to cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth && !auth.authState.isAuthenticated && auth.isReady) {
      logger.info('Mode switched to cloud, user not authenticated');
      setShowLoginModal(true);
    } else if (!isCloudMode) {
      logger.info('Mode switched to local, hiding login modal');
      setShowLoginModal(false);
    }
  }, [storageMode, isCloudMode, auth?.authState.isAuthenticated, auth?.isReady, auth, setShowLoginModal]);
  
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
    addImportedMapToList,
    applyAutoLayout,
    
    // 履歴操作
    undo,
    redo
  } = mindMap;

  // ファイルハンドラーを外部フックに委譲
  const { uploadFile, downloadFile, deleteFile } = useFileHandlers({
    data,
    storageMode,
    storageConfig,
    auth,
    updateNode,
    showNotification,
    handleError,
    handleAsyncError,
    retryableUpload,
  });

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
        const mapToUpdate = allMindMaps.find(map => map.id === update.id);
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

  // キーボードショートカット設定（ハンドラー組み立てを外部化）
  const finishEditingWrapper = (nodeId: string, text?: string) => {
    if (text !== undefined) finishEditing(nodeId, text);
  };
  const shortcutHandlers = useShortcutHandlers({
    data,
    ui,
    store,
    logger,
    showNotification,
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
  });
  useKeyboardShortcuts(shortcutHandlers as any, vim);

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
  const loadMapData = useCallback(async (mapId: string): Promise<MindMapData | null> => {
    try {
      if (data && mapId === data.id) {
        // 現在のマップの場合はそのまま返す
        return data;
      }
      
      // 他のマップのデータを読み込む
      // 永続化フックから適切なメソッドを使用
      const targetMap = allMindMaps.find(map => map.id === mapId);
      if (targetMap) {
        // 既に読み込み済みのマップデータがある場合はそれを返す
        return targetMap;
      }
      
      // マップが見つからない場合
      logger.warn('指定されたマップが見つかりません:', mapId);
      showNotification('warning', '指定されたマップが見つかりません');
      return null;
    } catch (error) {
      logger.error('マップデータの読み込みに失敗:', error);
      showNotification('error', 'マップデータの読み込みに失敗しました');
      return null;
    }
  }, [data, allMindMaps, showNotification]);

  // UI用のハンドラー
  const handleTitleChange = (title: string) => {
    if (data) {
      updateMapMetadata(data.id, { title });
    }
  };

  // エクスポートハンドラー
  const handleExport = () => {
    setShowExportModal(true);
  };

  // マークダウンインポートハンドラー
  const handleImport = () => {
    setShowImportModal(true);
  };

  // Listen to explorer selection events
  React.useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.mapId;
      if (id && typeof selectMapById === 'function') {
        selectMapById(id);
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

  // インポート成功時のハンドラー
  const handleImportSuccess = async (importedData: MindMapData, warnings?: string[]) => {
    try {
      logger.info('マークダウンインポートが成功しました', {
        title: importedData.title,
        nodeCount: countNodes(importedData.rootNode),
        warnings,
        rootNode: importedData.rootNode,
        rootNodeChildren: importedData.rootNode?.children?.length || 0
      });

      // インポートされたデータを直接ストアに設定
      logger.info('ストアにデータを設定中...', { 
        hasData: !!importedData, 
        hasRootNode: !!importedData?.rootNode,
        rootNodeText: importedData?.rootNode?.text 
      });
      store.setData(importedData);

      // マップをマップリストに追加（永続化）
      logger.info('マップリストに追加中...', { mapId: importedData.id, title: importedData.title });
      if (typeof addImportedMapToList === 'function') {
        await addImportedMapToList(importedData);
        logger.info('✅ マップリストに追加完了');
      } else {
        logger.warn('⚠️ addImportedMapToList関数が利用できません');
      }
      
      // 設定後の確認
      const currentData = store.data;
      logger.info('ストア設定後の確認', {
        currentTitle: currentData?.title,
        currentRootText: currentData?.rootNode?.text,
        currentChildrenCount: currentData?.rootNode?.children?.length || 0
      });

      // インポート後に自動整列を適用
      logger.info('インポート後の自動整列を適用中...');
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
        logger.info('✅ 自動整列が完了しました');
      } else {
        logger.warn('⚠️ applyAutoLayout関数が利用できません');
      }

      // 成功通知
      showNotification('success', `「${importedData.title}」をインポートしました`);
      
      // 警告がある場合は表示
      if (warnings && warnings.length > 0) {
        warnings.forEach(warning => {
          showNotification('warning', warning);
        });
      }
    } catch (error) {
      logger.error('インポート後の処理でエラーが発生しました:', error);
      handleError(error as Error, 'インポート処理', 'データ作成');
    }
  };

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
      const destNode = findNodeById(data.rootNode, linkModalNodeId);
      if (!destNode) return;

      const currentMapId = data.id;
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
          const targetNode = findNodeById(data.rootNode, linkData.targetNodeId);
          if (targetNode) {
            label = targetNode.text || 'リンク';
            const anchor = computeAnchorForNode(data.rootNode, targetNode.id) || label;
            href = `#${anchor}`;
          }
        } else {
          // Current map without node → center root (no anchor)
          label = data.title || 'このマップ';
          href = '';
        }
      } else {
        // Other map
        const targetMap = await loadMapData(targetMapId);
        if (targetMap) {
          if (linkData.targetNodeId) {
            const targetNode = findNodeById(targetMap.rootNode, linkData.targetNodeId);
            if (targetNode) {
              label = targetNode.text || targetMap.title || 'リンク';
              const anchor = computeAnchorForNode(targetMap.rootNode, targetNode.id);
              const rel = toRelPath(currentMapId, targetMap.id);
              href = anchor ? `${rel}#${encodeURIComponent(anchor)}` : rel;
            }
          } else {
            label = targetMap.title || 'リンク';
            const rel = toRelPath(currentMapId, targetMap.id);
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

  // ノードを画面中央に移動する関数
  const centerNodeInView = useCallback((nodeId: string, animate = true) => {
    if (!data) return;
    
    const targetNode = findNodeById(data.rootNode, nodeId);
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
      // アニメーション付きでパンを更新
      const currentPan = ui.pan;
      // const duration = 300; // 300ms (未使用)
      const steps = 20;
      
      const deltaX = (newPanX - currentPan.x) / steps;
      const deltaY = (newPanY - currentPan.y) / steps;
      
      let step = 0;
      const animateStep = () => {
        if (step < steps) {
          step++;
          const currentX = currentPan.x + (deltaX * step);
          const currentY = currentPan.y + (deltaY * step);
          setPan({ x: currentX, y: currentY });
          
          requestAnimationFrame(animateStep);
        }
      };
      
      requestAnimationFrame(animateStep);
    } else {
      // 即座にパンを更新
      setPan({ x: newPanX, y: newPanY });
    }
  }, [data, ui.zoom, ui.pan, setPan]);

  // ルートノードを中央に表示するハンドラー
  const handleCenterRootNode = useCallback(() => {
    if (data?.rootNode) {
      centerNodeInView(data.rootNode.id, true);
    }
  }, [data?.rootNode, centerNodeInView]);

  // Simplified link navigation via utility
  const handleLinkNavigate2 = async (link: NodeLink) => {
    await navigateLink(link, {
      currentMapId,
      dataRoot: data?.rootNode,
      selectMapById,
      selectNode,
      centerNodeInView,
      notify: showNotification,
      getCurrentRootNode: () => useMindMapStore.getState().data?.rootNode || null,
      resolveAnchorToNode,
    });
  };

  /* Helpers for resolving node by display text (exact or slug match)
  const slugify = useCallback((text: string) => (text || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''), []);
  const findNodeByTextLoose = useCallback((root: MindMapNode, targetText: string) => {
    if (!root || !targetText) return null;
    const targetSlug = slugify(targetText);
    const stack: MindMapNode[] = [root];
    while (stack.length) {
      const node = stack.pop()!;
      if (!node) continue;
      const byAnchor = resolveAnchorToNode(root, targetText);
      if (byAnchor) return byAnchor;
      if (node.text === targetText) return node;
      if (slugify(node.text) === targetSlug) return node;
      if (node.children && node.children.length) stack.push(...node.children);
    }
    return null;
  }, [slugify]);

  const handleLinkNavigate = async (link: NodeLink) => {
    try {
      // If targetMapId is specified and different from current map
      if (link.targetMapId && link.targetMapId !== currentMapId) {
        // Navigate to different map
        try {
          await selectMapById(link.targetMapId);
          showNotification('success', `マップ "${link.targetMapId}" に移動しました`);
          
          // If targetNodeId is specified, select that node after map loads
          if (link.targetNodeId) {
            setTimeout(() => {
              const tn = link.targetNodeId!;
              if (tn.startsWith('text:')) {
                const targetText = tn.slice(5);
                const current = useMindMapStore.getState().data;
                const root = current?.rootNode as MindMapNode | undefined;
                if (root) {
                  const node = findNodeByTextLoose(root, targetText);
                  if (node) {
                    selectNode(node.id);
                    setTimeout(() => centerNodeInView(node.id), 100);
                  }
                }
              } else {
                selectNode(tn);
                setTimeout(() => centerNodeInView(tn), 100);
              }
            }, 500); // Wait for map to load
          }
        } catch (error) {
          showNotification('error', `マップ "${link.targetMapId}" が見つかりません`);
          return;
        }
      } else if (link.targetNodeId) {
        // Navigate to node in current map
        if (data) {
          const tn = link.targetNodeId;
          if (tn.startsWith('text:')) {
            const targetText = tn.slice(5);
            const node = findNodeByTextLoose(data.rootNode, targetText);
            if (node) {
              selectNode(node.id);
              setTimeout(() => centerNodeInView(node.id), 50);
              showNotification('success', `ノード "${node.text}" に移動しました`);
            } else {
              showNotification('error', `ノード "${targetText}" が見つかりません`);
            }
          } else {
            const targetNode = findNodeById(data.rootNode, tn);
            if (targetNode) {
              selectNode(tn);
              setTimeout(() => centerNodeInView(tn), 50);
              showNotification('success', `ノード "${targetNode.text}" に移動しました`);
            } else {
              showNotification('error', `ノード "${tn}" が見つかりません`);
            }
          }
        }
      } else {
        showNotification('info', 'リンク先が指定されていません');
      }
    } catch (error) {
      logger.error('Link navigation error:', error);
      handleError(error as Error, 'リンク操作', 'リンク先への移動');
    }
  }; */

  const handleShowLinkActionMenu = openLinkActionMenu;
  const handleCloseLinkActionMenu = closeLinkActionMenu;

  // Outline save feature removed


  // Show loading while auth is initializing in cloud mode
  if (isCloudMode && auth && !auth.isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">認証システムを初期化中...</p>
        </div>
      </div>
    );
  }

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
        onSelectMap={(mapId) => { selectMapById(mapId); }}
        onCreateMap={createAndSelectMap}
        onDeleteMap={deleteMap}
        onRenameMap={(mapId, title) => updateMapMetadata(mapId, { title })}
        onChangeCategory={(mapId, category) => updateMapMetadata(mapId, { category })}
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
        onSelectFolder={handleSelectFolder}
        onShowFolderGuide={openGuide}
        currentFolderLabel={(mindMap as any).getSelectedFolderLabel?.() || null}
        explorerTree={(mindMap as any).explorerTree || null}
        onCreateFolder={async (path: string) => {
          if (typeof (mindMap as any).createFolder === 'function') {
            await (mindMap as any).createFolder(path);
          }
        }}
        onExport={handleExport}
        onImport={handleImport}
        currentMapData={data}
        onNodeSelect={(nodeId) => { selectNode(nodeId); centerNodeInView(nodeId); }}
        onMapSwitch={(mapId) => { selectMapById(mapId); }}
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
          onStorageModeChange={onModeChange}
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
                if (nodeId) selectNode(nodeId);
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
              availableMaps={allMindMaps.map(map => ({ id: map.id, title: map.title }))}
              currentMapData={data}
              onLinkNavigate={handleLinkNavigate2}
              zoom={ui.zoom}
              setZoom={setZoom}
              pan={ui.pan}
              setPan={setPan}
              onToggleAttachmentList={store.toggleAttachmentListForNode}
              onToggleLinkList={store.toggleLinkListForNode}
            />

          {ui.showNotesPanel && (
            <NodeNotesPanelContainer
              dataRoot={data?.rootNode || null}
              selectedNodeId={selectedNodeId}
              onUpdateNode={updateNode}
              onClose={() => store.setShowNotesPanel(false)}
              currentMapId={data?.id || null}
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
          findNode: (nodeId: string) => findNodeById(data?.rootNode, nodeId),
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
              const node = findNodeById(data.rootNode, nodeId);
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
        isCloudMode={isCloudMode}
        authAdapter={authAdapter}
        showLoginModal={showLoginModal}
        onLoginClose={() => {
          logger.info('Login modal closed, switching to local mode');
          setShowLoginModal(false);
          if (onModeChange) onModeChange('local');
        }}
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        onImportSuccess={handleImportSuccess}
        data={data}
      />

      <MindMapLinkOverlays
        dataRoot={data.rootNode}
        allMaps={allMindMaps.map(map => ({ id: map.id, title: map.title }))}
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
            const destNode = findNodeById(data.rootNode, linkModalNodeId);
            if (!destNode) return;
            const dirOf = (id: string) => { const i = id.lastIndexOf('/'); return i>=0? id.slice(0,i) : ''; };
            const fromDir = dirOf(data.id);
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
        dataRoot={data?.rootNode || null}
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
          const nodeToFind = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
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
