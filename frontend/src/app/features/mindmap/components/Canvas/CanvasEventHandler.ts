import { useCallback } from 'react';
import { logger } from '@shared/utils';
import { useMindMapStore } from '../../store';
import { useBaseEventHandler } from '@mindmap/handlers';
// Strategy event type import kept for reference if needed in future
// import type { CanvasEvent } from '@mindmap/events/EventStrategy';
import { dispatchCanvasEvent } from '@mindmap/events/dispatcher';

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
  // current mode is retrieved dynamically in dispatchToStrategy to avoid staleness

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
    dispatchCanvasEvent({ type: 'mousedown', x: e.clientX, y: e.clientY });
  }, [getIsPanning, baseHandleMouseDown]);

  // Background click handler
  const handleBackgroundClick = useCallback(() => {
    // Skip if was panning
    if (wasPanning) return;

    // Finish editing if active (keep in handler due to prop callback)
    if (editingNodeId) {
      onFinishEdit(editingNodeId, editText);
    }
    // Delegate bgclick behavior to strategy (selection/close panels etc.)
    dispatchCanvasEvent({ type: 'bgclick', x: 0, y: 0 });
  }, [editingNodeId, editText, onFinishEdit]);

  // Handle mouse up with background click detection
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    baseHandleMouseUp(e, handleBackgroundClick);
    dispatchCanvasEvent({ type: 'mouseup', x: e.clientX, y: e.clientY });
  }, [baseHandleMouseUp, handleBackgroundClick]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    baseHandleContextMenu(e);
    dispatchCanvasEvent({ type: 'contextmenu', x: e.clientX, y: e.clientY });
  }, [baseHandleContextMenu]);

  // ノード選択時に編集を確定する処理
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    // 編集中で、異なるノードが選択された場合は編集を確定
    if (editingNodeId && editingNodeId !== nodeId) {
      logger.debug('Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
    }
    
    // ノード選択時に添付ファイル・リンク一覧を閉じる（ただし、アイコンクリックでの表示切り替えは除く）
    const {  showLinkListForNode } = store.ui;
    if (showLinkListForNode !== nodeId) {
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

// Event strategy dispatch moved to '@mindmap/events/dispatcher'
