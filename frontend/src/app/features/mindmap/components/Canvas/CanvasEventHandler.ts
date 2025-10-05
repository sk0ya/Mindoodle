import { useCallback } from 'react';
import { logger } from '@shared/utils';
import { useMindMapStore } from '../../store';
import { useBaseEventHandler } from '@mindmap/handlers';
import type { CanvasEvent } from '@mindmap/events/EventStrategy';
import { NormalModeStrategy } from '@mindmap/events/CanvasEvent.normal';
import { InsertModeStrategy } from '@mindmap/events/CanvasEvent.insert';
import { VisualModeStrategy } from '@mindmap/events/CanvasEvent.visual';

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
    dispatchToStrategy({ type: 'mousedown', x: e.clientX, y: e.clientY });
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
    dispatchToStrategy({ type: 'mouseup', x: e.clientX, y: e.clientY });
  }, [baseHandleMouseUp, handleBackgroundClick]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    baseHandleContextMenu(e);
    dispatchToStrategy({ type: 'contextmenu', x: e.clientX, y: e.clientY });
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

function getStrategy(mode: 'normal' | 'insert' | 'visual' | 'menu') {
  switch (mode) {
    case 'insert': return new InsertModeStrategy();
    case 'visual': return new VisualModeStrategy();
    case 'normal':
    default: return new NormalModeStrategy();
  }
}

function dispatchToStrategy(event: CanvasEvent) {
  try {
    // Retrieve mode inline to avoid stale closures if store changes frequently
    const currentMode = (useMindMapStore.getState()?.ui?.mode ?? 'normal') as 'normal'|'insert'|'visual'|'menu';
    const strategy = getStrategy(currentMode);
    strategy.handle(event);
  } catch {
    // no-op on dispatch failures to keep UI responsive
  }
}
