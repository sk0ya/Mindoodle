import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '../../../../core';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import ActivityBar from './ActivityBar';
import PrimarySidebarContainer from './PrimarySidebarContainer';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspaceContainer from './MindMapWorkspaceContainer';
import MindMapModals from '../modals/MindMapModals';
import FolderGuideModal from '../modals/FolderGuideModal';
import MindMapLinkOverlays from './MindMapLinkOverlays';
import NodeNotesPanel from '../panels/NodeNotesPanel';
// Outline mode removed
import ContextMenu from '../../../../shared/components/ui/ContextMenu';
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
import { useCloudAuthGate } from '../../../../core/hooks/useCloudAuthGate';
import MindMapProviders from './MindMapProviders';
import { logger } from '../../../../shared/utils/logger';
import MindMapOverlays from './MindMapOverlays';
import './MindMapApp.css';

// Types
import type { MindMapNode, FileAttachment, MindMapData, NodeLink } from '@shared/types';
import type { StorageConfig } from '../../../../core/storage/types';
// Storage configurations
// Deprecated storage configs (Mindoodle uses markdown adapter internally)
// Login modal moved into MindMapOverlays
import { validateFile } from '../../../../shared/types/dataTypes';

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
  const { retryableUpload, clearUploadState } = useRetryableUpload({
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

  // Folder guide modal state
  const [showFolderGuide, setShowFolderGuide] = React.useState<boolean>(() => {
    try {
      const dismissed = localStorage.getItem('mindoodle_guide_dismissed');
      return dismissed !== '1';
    } catch { return true; }
  });

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

  // Now that mindMap is initialized, define folder selection handler
  const handleSelectFolder = React.useCallback(async () => {
    try {
      if (typeof (mindMap as any).selectRootFolder === 'function') {
        const ok = await (mindMap as any).selectRootFolder();
        if (ok) {
          setShowFolderGuide(false);
          localStorage.setItem('mindoodle_guide_dismissed', '1');
        } else {
          console.warn('selectRootFolder is not available on current adapter');
        }
      }
    } catch (e) {
      console.error('Folder selection failed:', e);
    }
  }, [mindMap]);

  // フォルダ移動用の一括カテゴリ更新関数
  const updateMultipleMapCategories = React.useCallback(async (mapUpdates: Array<{id: string, category: string}>) => {
    console.log('Updating multiple map categories:', mapUpdates);
    
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
      
      console.log(`Batch updating ${updatedMaps.length} maps`);
      
      // 各マップを並列更新（非同期処理を並列実行）
      await Promise.all(
        updatedMaps.map(async (updatedMap) => {
          if (updatedMap) {
            console.log(`Updating map "${updatedMap.title}" to "${updatedMap.category}"`);
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
      
      console.log(`Successfully batch updated ${updatedMaps.length} maps`);
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
      // keep current image paste behavior via handleFileUpload
      try {
        if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('クリップボードAPIが利用できません');
        const items = await navigator.clipboard.read();
        for (const item of items) for (const type of item.types) if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type });
          await handleFileUpload(nodeId, file);
          showNotification('success', '画像を貼り付けました');
          return;
        }
        throw new Error('クリップボードに画像がありません');
      } catch (e) { throw e; }
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

  // ファイルハンドラー（クラウド対応）
  const handleFileUpload = async (nodeId: string, file: File): Promise<void> => {
    if (!data) {
      handleError(new Error('マインドマップデータが利用できません'), 'ファイルアップロード', 'データチェック');
      return;
    }

    // ファイルバリデーション
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      validationErrors.forEach((error: string) => showNotification('error', error));
      return;
    }

    const uploadKey = `${nodeId}_${file.name}_${Date.now()}`;
    
    try {
      await handleAsyncError((async () => {
        const fileAttachment = await retryableUpload(
          uploadKey,
          file.name,
          async (): Promise<FileAttachment> => {
            if (storageMode === 'cloud') {
              // クラウドモード: APIにアップロードしてCloudflareに保存
              logger.info('Uploading file to cloud storage...', { 
                fileName: file.name, 
                fileSize: file.size, 
                fileType: file.type,
                nodeId,
                mapId: data.id
              });
              
              // CloudStorageAdapterを直接使用
              const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
              logger.debug('CloudStorageAdapter imported successfully');
              
              if (!auth) {
                logger.error('Authentication not available for cloud upload');
                throw new Error('クラウドファイルアップロードには認証が必要です');
              }
              
              logger.info('🚀 Cloud mode file upload starting...', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                nodeId: nodeId,
                mapId: data?.id,
                hasAuth: !!auth,
                hasAuthAdapter: !!auth.authAdapter,
                isAuthenticated: auth.authAdapter?.isAuthenticated,
                userId: auth.authAdapter?.user?.id
              });
              
              const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
              logger.debug('CloudStorageAdapter created, initializing...');
              
              await storageAdapter.initialize();
              logger.debug('CloudStorageAdapter initialized');
              
              if (typeof storageAdapter.uploadFile === 'function') {
                logger.debug('Calling uploadFile method...');
                const uploadResult = await storageAdapter.uploadFile(data.id, nodeId, file);
                logger.debug('Upload result received:', uploadResult);
                
                const fileAttachment = {
                  id: uploadResult.id,
                  name: uploadResult.fileName,
                  type: uploadResult.mimeType,
                  size: uploadResult.fileSize,
                  isImage: uploadResult.attachmentType === 'image',
                  createdAt: uploadResult.uploadedAt,
                  downloadUrl: uploadResult.downloadUrl,
                  storagePath: uploadResult.storagePath,
                  r2FileId: uploadResult.id,
                  nodeId: nodeId // nodeIdも保存
                };
                logger.info('File uploaded to cloud successfully:', fileAttachment);
                logger.info('Upload result details:', {
                  uploadResultId: uploadResult.id,
                  fileName: uploadResult.fileName,
                  mapId: data.id,
                  nodeId: nodeId,
                  fullUploadResult: uploadResult
                });
                return fileAttachment;
              } else {
                logger.error('uploadFile method not available on storage adapter');
                throw new Error('Cloud storage adapter not available or uploadFile method missing');
              }
            } else {
              // ローカルモード: Base64エンコードしてローカル保存
              logger.debug('Processing file for local storage...');
              
              const reader = new FileReader();
              const dataURL = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              const fileAttachment = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                type: file.type,
                size: file.size,
                isImage: file.type.startsWith('image/'),
                createdAt: new Date().toISOString(),
                dataURL: dataURL,
                data: dataURL.split(',')[1] // Base64 part only
              };
              logger.debug('File processed for local storage:', fileAttachment.name);
              return fileAttachment;
            }
          }
        );
        
        // ノードにファイルを添付
        const node = data?.rootNode && findNodeById(data.rootNode, nodeId);
        if (node) {
          logger.info('📎 Attaching file to node...', {
            nodeId,
            fileName: fileAttachment.name,
            hasDownloadUrl: !!fileAttachment.downloadUrl,
            hasDataURL: !!fileAttachment.dataURL,
            downloadUrl: fileAttachment.downloadUrl ? fileAttachment.downloadUrl.substring(0, 100) + '...' : 'none',
            existingAttachments: node.attachments?.length || 0
          });
          
          const updatedNode = {
            ...node,
            attachments: [...(node.attachments || []), fileAttachment]
          };
          updateNode(nodeId, updatedNode);
          logger.info('✅ File attached to node successfully:', {
            nodeId,
            fileName: fileAttachment.name,
            totalAttachments: updatedNode.attachments.length
          });
          
          // ファイル添付後に自動整列を実行
          if (typeof applyAutoLayout === 'function') {
            logger.debug('🎯 Applying auto layout after file attachment');
            requestAnimationFrame(() => {
              applyAutoLayout();
            });
          }
        } else {
          throw new Error(`ノードが見つかりません: ${nodeId}`);
        }
      })(), 'ファイルアップロード', `${file.name}のアップロード`);
      
      // 成功時は自動削除に任せる（useFileUploadで1秒後に削除される）
      logger.debug('Upload completed successfully, waiting for auto-cleanup');
    } catch (error) {
      // エラー時のみ即座にクリア
      clearUploadState(uploadKey);
      logger.debug('Upload state cleared due to error:', uploadKey);
      throw error;
    }
  };

  // ファイルダウンロードハンドラー
  const handleFileDownload = async (file: FileAttachment): Promise<void> => {
    try {
      let downloadUrl: string;
      const fileName = file.name;

      if (storageMode === 'cloud' && (file.r2FileId || file.id)) {
        // クラウドモード: APIを使用してファイルをダウンロード
        const fileId = file.r2FileId || file.id; // 古いファイルとの互換性
        logger.info('Downloading file from cloud storage...', { 
          fileName: file.name, 
          fileId: fileId,
          r2FileId: file.r2FileId,
          originalId: file.id,
          nodeId: file.nodeId,
          mapId: data?.id,
          fullFile: file
        });

        if (!data) {
          throw new Error('マインドマップデータが利用できません');
        }

        if (!auth || !auth.authAdapter) {
          throw new Error('クラウドファイルダウンロードには認証が必要です');
        }

        // CloudStorageAdapterを直接使用してファイルをダウンロード
        const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
        const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
        
        await storageAdapter.initialize();
        
        if (typeof storageAdapter.downloadFile === 'function') {
          logger.debug('Calling downloadFile method...');
          const blob = await storageAdapter.downloadFile(data.id, file.nodeId || '', fileId);
          logger.debug('Download blob received:', { size: blob.size, type: blob.type });
          
          // BlobからダウンロードURLを作成
          downloadUrl = URL.createObjectURL(blob);
          logger.info('File downloaded from cloud successfully');
        } else {
          logger.error('downloadFile method not available on storage adapter');
          throw new Error('Cloud storage adapter downloadFile method not available');
        }
      } else if (file.data) {
        // ローカルモード: Base64データから直接使用
        downloadUrl = `data:${file.type};base64,${file.data}`;
      } else if (file.dataURL) {
        // 後方互換性: dataURLを使用
        downloadUrl = file.dataURL;
      } else if (storageMode === 'cloud' && file.downloadUrl) {
        // 古いクラウドファイル: downloadUrlを直接使用（認証なし、古い形式）
        logger.info('Using legacy downloadUrl for old cloud file');
        downloadUrl = file.downloadUrl;
      } else {
        logger.error('No download data found in file:', file);
        throw new Error('ダウンロード可能なファイルデータが見つかりません');
      }

      // ダウンロードを実行
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // BlobURLを使用した場合はメモリを解放
      if (downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      }

      logger.info('File download completed successfully:', fileName);
    } catch (error) {
      logger.error('File download failed:', error);
      showNotification('error', `${file.name} のダウンロードに失敗しました`);
      handleError(error as Error, 'ファイルダウンロード', file.name);
    }
  };

  // ファイル削除ハンドラー
  const handleFileDelete = async (nodeId: string, fileId: string): Promise<void> => {
    try {
      if (!data) {
        throw new Error('マインドマップデータが利用できません');
      }

      const node = findNodeById(data.rootNode, nodeId);
      if (!node || !node.attachments) {
        throw new Error('ノードまたは添付ファイルが見つかりません');
      }

      const fileToDelete = node.attachments.find(file => file.id === fileId);
      if (!fileToDelete) {
        throw new Error('削除するファイルが見つかりません');
      }

      // クラウドモードの場合はサーバーからも削除
      if (storageMode === 'cloud' && (fileToDelete.r2FileId || fileToDelete.id)) {
        const fileIdForDeletion = fileToDelete.r2FileId || fileToDelete.id;
        logger.info('Deleting file from cloud storage...', { 
          fileName: fileToDelete.name, 
          fileId: fileIdForDeletion,
          nodeId: nodeId,
          mapId: data.id
        });

        // ストレージアダプターを直接作成
        const { createStorageAdapter } = await import('../../../../core/storage/StorageAdapterFactory');
        const adapter = await createStorageAdapter(storageConfig);
        if (adapter && 'deleteFile' in adapter && typeof adapter.deleteFile === 'function') {
          await adapter.deleteFile(data.id, nodeId, fileIdForDeletion);
          logger.info('File deleted from cloud storage successfully');
        }
      }

      // ノードから添付ファイルを削除
      const updatedAttachments = node.attachments.filter(file => file.id !== fileId);
      const updatedNode = {
        ...node,
        attachments: updatedAttachments
      };

      updateNode(nodeId, updatedNode);
      showNotification('success', `${fileToDelete.name} を削除しました`);
      logger.debug('File deleted from node:', { nodeId, fileId, fileName: fileToDelete.name });
    } catch (error) {
      logger.error('File delete failed:', error);
      showNotification('error', 'ファイルの削除に失敗しました');
      handleError(error as Error, 'ファイル削除', fileId);
    }
  };

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
    console.log('🔥 handleEditLink called:', { link, nodeId });
    console.trace('Call stack:');
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
        onShowFolderGuide={() => setShowFolderGuide(true)}
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
          onClose={() => { setShowFolderGuide(false); localStorage.setItem('mindoodle_guide_dismissed','1'); }}
          onSelectFolder={handleSelectFolder}
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
            <NodeNotesPanel
              selectedNode={selectedNodeId ? findNodeById(data?.rootNode, selectedNodeId) : null}
              onUpdateNode={updateNode}
              onClose={() => store.setShowNotesPanel(false)}
              currentMapId={data?.id || null}
              getMapMarkdown={(mindMap as any).getMapMarkdown}
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
          onCopyNode: () => {},
          onPasteNode: () => {},
          onShowCustomization: () => {},
          onAddChild: (parentId: string, text?: string) => {
            return store.addChildNode(parentId, text || 'New Node');
          }
        }}
        fileOperations={{
          onFileDownload: handleFileDownload,
          onFileRename: () => {},
          onFileDelete: (fileId: string) => {
            // selectedFileとselectedNodeIdから適切なnodeIdを取得する必要があります
            if (ui.selectedFile && ui.selectedFile.nodeId) {
              handleFileDelete(ui.selectedFile.nodeId, fileId);
            } else if (ui.selectedFile && selectedNodeId) {
              // fallbackとしてselectedNodeIdを使用
              handleFileDelete(selectedNodeId, fileId);
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

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.nodeId && (
        <ContextMenu
          visible={contextMenu.visible}
          position={contextMenu.position}
          selectedNode={data?.rootNode ? findNodeById(data.rootNode, contextMenu.nodeId) : null}
          onDelete={deleteNode}
          onCustomize={(node) => {
            selectNode(node.id);
            store.showCustomization({ x: contextMenu.position.x, y: contextMenu.position.y });
            handleContextMenuClose();
          }}
          // onFileUpload removed (attachments not supported)
          onAddLink={(nodeId) => {
            setLinkModalNodeId(nodeId);
            setShowLinkModal(true);
            handleContextMenuClose();
          }}
          onCopy={(node) => {
            // ショートカットキーと同じcopyNode関数を使用
            const copyNode = (nodeId: string) => {
              const nodeToFind = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
              if (nodeToFind) {
                // 内部クリップボードに保存
                store.setClipboard(nodeToFind);
                
                // システムクリップボードにマークダウン形式で保存
                const convertNodeToMarkdown = (node: MindMapNode, level: number = 0): string => {
                  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
                  let markdown = `${prefix}${node.text}\n`;
                  
                  // ノートがあれば追加
                  if (node.note && node.note.trim()) {
                    markdown += `${node.note}\n`;
                  }
                  
                  // 子ノードを再帰的に処理
                  if (node.children && node.children.length > 0) {
                    node.children.forEach(child => {
                      markdown += convertNodeToMarkdown(child, level + 1);
                    });
                  }
                  
                  return markdown;
                };
                
                const markdownText = convertNodeToMarkdown(nodeToFind);
                
                // システムクリップボードに書き込み
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(markdownText).catch((error) => {
                    console.warn('システムクリップボードへの書き込みに失敗:', error);
                  });
                }
                
                showNotification('success', `「${nodeToFind.text}」をコピーしました`);
              }
            };
            
            copyNode(node.id);
            handleContextMenuClose();
          }}
          onPaste={async (parentId) => {
            // ショートカットキーと同じpasteNode関数を使用
            const pasteNode = async (parentId: string) => {
              // まずシステムクリップボードからMindMeisterのマークダウンを確認
              try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                  const clipboardText = await navigator.clipboard.readText();
                  
                  // MindMeisterのマークダウン形式かチェック
                  const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../../../shared/utils/mindMeisterParser');
                  
                  if (clipboardText && isMindMeisterFormat(clipboardText)) {
                    const parsedNode = parseMindMeisterMarkdown(clipboardText);
                    
                    if (parsedNode) {
                      // パースされたノード構造を貼り付け
                      const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
                        const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
                        
                        if (newNodeId) {
                          updateNode(newNodeId, {
                            fontSize: nodeToAdd.fontSize,
                            fontWeight: nodeToAdd.fontWeight,
                            color: nodeToAdd.color,
                            collapsed: false,
                            attachments: nodeToAdd.attachments || [],
                            note: nodeToAdd.note
                          });
                          
                          if (nodeToAdd.children && nodeToAdd.children.length > 0) {
                            nodeToAdd.children.forEach(child => {
                              pasteNodeRecursively(child, newNodeId);
                            });
                          }
                        }
                        
                        return newNodeId;
                      };
                      
                      const newNodeId = pasteNodeRecursively(parsedNode, parentId);
                      if (newNodeId) {
                        showNotification('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`);
                        selectNode(newNodeId);
                        return;
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn('システムクリップボードからの読み取りに失敗:', error);
              }
              
              // フォールバック: 内部クリップボードから貼り付け
              const clipboardNode = ui.clipboard;
              if (!clipboardNode) {
                showNotification('warning', 'コピーされたノードがありません');
                return;
              }
              
              const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
                const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
                
                if (newNodeId) {
                  updateNode(newNodeId, {
                    fontSize: nodeToAdd.fontSize,
                    fontWeight: nodeToAdd.fontWeight,
                    color: nodeToAdd.color,
                    collapsed: false,
                    attachments: nodeToAdd.attachments || []
                  });
                  
                  if (nodeToAdd.children && nodeToAdd.children.length > 0) {
                    nodeToAdd.children.forEach(child => {
                      pasteNodeRecursively(child, newNodeId);
                    });
                  }
                }
                
                return newNodeId;
              };
              
              const newNodeId = pasteNodeRecursively(clipboardNode, parentId);
              if (newNodeId) {
                showNotification('success', `「${clipboardNode.text}」を貼り付けました`);
                selectNode(newNodeId);
              }
            };
            
            await pasteNode(parentId);
            handleContextMenuClose();
          }}
          onAIGenerate={ai.aiSettings.enabled ? handleAIGenerate : undefined}
          onClose={handleContextMenuClose}
        />
      )}
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
