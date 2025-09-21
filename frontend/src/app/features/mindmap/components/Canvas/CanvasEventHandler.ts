import { useCallback } from 'react';
import { logger } from '../../../../shared/utils/logger';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { useBaseEventHandler } from '@shared/handlers';

interface CanvasEventHandlerProps {
  editingNodeId: string | null;
  editText: string;
  onSelectNode: (nodeId: string | null) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  getIsPanning?: () => boolean;
  svgRef: React.RefObject<SVGSVGElement>;
}

export const useCanvasEventHandler = ({
  editingNodeId,
  editText,
  onSelectNode,
  onFinishEdit,
  getIsPanning,
  svgRef
}: CanvasEventHandlerProps) => {
  const store = useMindMapStore();

  // Use shared base event handler
  const {
    handleMouseDown: baseHandleMouseDown,
    handleMouseUp: baseHandleMouseUp,
    handleContextMenu: baseHandleContextMenu
  } = useBaseEventHandler(svgRef, {
    thresholds: { clickThreshold: 5, dragThreshold: 5 },
    preventDefaults: true
  });

  // Override mouse down to track panning state
  let wasPanning = false;
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    wasPanning = getIsPanning ? getIsPanning() : false;
    baseHandleMouseDown(e);
  }, [getIsPanning, baseHandleMouseDown]);

  // Background click handler
  const handleBackgroundClick = useCallback(() => {
    // Skip if was panning
    if (wasPanning) {
      return;
    }

    // Finish editing if active
    if (editingNodeId) {
      onFinishEdit(editingNodeId, editText);
    }
    // Clear node selection
    onSelectNode(null);
    // Close attachment and link lists
    store.closeAttachmentAndLinkLists();
  }, [editingNodeId, editText, onFinishEdit, onSelectNode, store]);

  // Handle mouse up with background click detection
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    baseHandleMouseUp(e, handleBackgroundClick);
  }, [baseHandleMouseUp, handleBackgroundClick]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    baseHandleContextMenu(e);
  }, [baseHandleContextMenu]);

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    if (editingNodeId && editingNodeId !== nodeId) {
      logger.debug('Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
    }
    
    // ノード選択時に添付ファイル・リンク一覧を閉じる（ただし、アイコンクリックでの表示切り替えは除く）
    const { showAttachmentListForNode, showLinkListForNode } = store.ui;
    if (showAttachmentListForNode !== nodeId && showLinkListForNode !== nodeId) {
      store.closeAttachmentAndLinkLists();
    }
    
    onSelectNode(nodeId);
  }, [editingNodeId, onSelectNode, store]);

  return {
    handleMouseUp,
    handleContextMenu,
    handleNodeSelect,
    handleMouseDown
  };
};

export type { CanvasEventHandlerProps };