import { useCallback } from 'react';
import { logger } from '@shared/utils';
import { useMindMapStore } from '../../store';
import { useBaseEventHandler } from '@mindmap/handlers';


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
  

  
  const {
    handleMouseDown: baseHandleMouseDown,
    handleMouseUp: baseHandleMouseUp,
    handleContextMenu: baseHandleContextMenu
  } = useBaseEventHandler(svgRef, {
    thresholds: { clickThreshold: 5, dragThreshold: 5 },
    preventDefaults: true
  });

  
  let wasPanning = false;
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    wasPanning = getIsPanning ? getIsPanning() : false;
    baseHandleMouseDown(e);
    dispatchCanvasEvent({ type: 'mousedown', x: e.clientX, y: e.clientY });
  }, [getIsPanning, baseHandleMouseDown]);

  
  const handleBackgroundClick = useCallback(() => {
    
    if (wasPanning) return;

    
    if (editingNodeId) {
      onFinishEdit(editingNodeId, editText);
    }
    
    dispatchCanvasEvent({ type: 'bgclick', x: 0, y: 0 });
  }, [editingNodeId, editText, onFinishEdit]);

  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    baseHandleMouseUp(e, handleBackgroundClick);
    dispatchCanvasEvent({ type: 'mouseup', x: e.clientX, y: e.clientY });
  }, [baseHandleMouseUp, handleBackgroundClick]);

  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    baseHandleContextMenu(e);
    dispatchCanvasEvent({ type: 'contextmenu', x: e.clientX, y: e.clientY });
  }, [baseHandleContextMenu]);

  
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    
    if (editingNodeId && editingNodeId !== nodeId) {
      logger.debug('Canvas: 別ノード選択時の編集確定をNode.jsxに委任');
    }
    
    
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


