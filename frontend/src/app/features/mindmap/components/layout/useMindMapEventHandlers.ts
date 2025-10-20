import { useCallback } from 'react';
import { findNodeInRoots } from '@mindmap/utils';
import { parseWorkspacePath } from '@shared/utils/pathOperations';
import type { MindMapData, MindMapNode } from '@shared/types';

/**
 * Custom hook for MindMap event handlers
 * Consolidates event handling logic from MindMapApp component
 */
interface UseMindMapEventHandlersProps {
  data: MindMapData | null;
  editingTableNodeId: string | null;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  handleCloseTableEditor: () => void;
  handleShowImageModal: (imageUrl: string, altText?: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  store: {
    setShowContextMenu: (show: boolean) => void;
  };
  mindMap: {
    readImageAsDataURL?: (path: string, workspaceId: string) => Promise<string | null>;
  };
  handleSelectFolderFromHook: (onSuccess: () => void) => Promise<void>;
  closeGuide: () => void;
  markDismissed: () => void;
}

export function useMindMapEventHandlers({
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
}: UseMindMapEventHandlersProps) {

  /**
   * Handle folder selection from guide
   */
  const handleSelectFolder = useCallback(async () => {
    await handleSelectFolderFromHook(() => {
      closeGuide();
      markDismissed();
    });
  }, [handleSelectFolderFromHook, closeGuide, markDismissed]);

  /**
   * Handle context menu close
   */
  const handleContextMenuClose = useCallback(() => {
    // Type: Optional panel close method on store
    const storeWithPanels = store as unknown as { closePanel?: (panel: string) => void };
    storeWithPanels.closePanel?.('contextMenu');
    store.setShowContextMenu(false);
  }, [store]);

  /**
   * Handle table editor save
   */
  const handleTableEditorSave = useCallback((newMarkdown: string) => {
    if (!editingTableNodeId) return;

    const node = findNodeInRoots(data?.rootNodes || [], editingTableNodeId);
    if (!node) return;

    updateNode(editingTableNodeId, { text: newMarkdown });
    handleCloseTableEditor();
    showNotification('success', 'テーブルを更新しました');
  }, [editingTableNodeId, data, updateNode, handleCloseTableEditor, showNotification]);

  /**
   * Global image open handler from Explorer (map list)
   */
  const handleOpenImageFile = useCallback((e: Event) => {
    const evt = e as CustomEvent;
    const path = evt?.detail?.path as (string | undefined);
    if (!path) return;
    try {
      const { workspaceId, relativePath } = parseWorkspacePath(path);
      const ws = workspaceId || data?.mapIdentifier?.workspaceId || '';
      if (!relativePath || !ws) return;
      // Ensure reader is available
      const reader = mindMap.readImageAsDataURL;
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

  return {
    handleSelectFolder,
    handleContextMenuClose,
    handleTableEditorSave,
    handleOpenImageFile,
  };
}
