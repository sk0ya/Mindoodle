import React, { useCallback, useState } from 'react';
import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { dispatchCanvasEvent } from '@mindmap/events/dispatcher';

// Local aliases to avoid inline union types
type DropPosition = 'child' | 'before' | 'after';
type DropAction = 'move-parent' | 'reorder-sibling';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: DropPosition | null;
  dropAction: DropAction | null;
  dragOffset: { x: number; y: number };
}

interface CanvasDragHandlerProps {
  allNodes: MindMapNode[];
  zoom: number;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement>;
  
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onMoveNodeWithPosition?: (nodeId: string, targetNodeId: string, position: DropPosition) => void;
  rootNodes: MindMapNode[];
}

export const useCanvasDragHandler = ({
  allNodes,
  zoom,
  pan,
  svgRef
}: CanvasDragHandlerProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    dropTargetId: null,
    dropPosition: null,
    dropAction: null,
    dragOffset: { x: 0, y: 0 }
  });

  
  const getDropTargetAndAction = useCallback((x: number, y: number, shiftKey?: boolean): { node: MindMapNode | null; position: DropPosition | null; action: DropAction | null } => {
    
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return { node: null, position: null, action: null };

    
    const svgX = (x - svgRect.left) / (zoom * 1.5) - pan.x;
    const svgY = (y - svgRect.top) / (zoom * 1.5) - pan.y;


    
    let closestNode: MindMapNode | null = null;
    let minDistance = Infinity;
    const maxDropDistance = 100; 

    allNodes.forEach(node => {
      if (node.id === dragState.draggedNodeId) return; 

      const distance = Math.sqrt(
        Math.pow(node.x - svgX, 2) + Math.pow(node.y - svgY, 2)
      );

      if (distance < maxDropDistance && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    if (!closestNode) {
      return { node: null, position: null, action: null };
    }

    
    const targetNode: MindMapNode = closestNode;

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    

    
    
    

    
    const nodeHeight = 40;
    const relativeY = svgY - targetNode.y;
    const topThreshold = -nodeHeight / 2;    
    const bottomThreshold = nodeHeight / 2;  

    let position: DropPosition | null = null;
    let action: DropAction | null = null;

    if (shiftKey) {
      
      position = 'child';
      action = 'move-parent';
    } else {
      
      if (relativeY < topThreshold) {
        position = 'before';
        action = 'reorder-sibling';
      } else if (relativeY > bottomThreshold) {
        position = 'after';
        action = 'reorder-sibling';
      } else {
        position = 'child';
        action = 'move-parent';
      }
    }


    return { node: targetNode, position, action };
  }, [allNodes, zoom, pan, dragState.draggedNodeId, svgRef]);

  
  const handleDragStart = useCallback((nodeId: string, _e: React.MouseEvent | React.TouchEvent) => {
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      dropTargetId: null,
      dropPosition: null,
      dropAction: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, []);

  
  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    const shiftKey = 'shiftKey' in e ? e.shiftKey : false;

    setDragState(prev => {
      if (!prev.isDragging) {
        return prev;
      }

      const { node: targetNode, position, action } = getDropTargetAndAction(clientX, clientY, shiftKey);

      
      if (prev.dropTargetId !== (targetNode?.id || null) ||
        prev.dropPosition !== position ||
        prev.dropAction !== action) {
        return {
          ...prev,
          dropTargetId: targetNode?.id || null,
          dropPosition: position,
          dropAction: action
        };
      }

      return prev;
    });
  }, [getDropTargetAndAction]);

  
  const handleDragEnd = useCallback(() => {
    setDragState(prevState => {

      if (prevState.dropTargetId &&
        prevState.dropTargetId !== prevState.draggedNodeId &&
        prevState.draggedNodeId &&
        prevState.dropAction) {
        try {
          dispatchCanvasEvent({
            type: 'nodeDragEnd',
            x: 0,
            y: 0,
            targetNodeId: prevState.dropTargetId,
            draggedNodeId: prevState.draggedNodeId,
            dropPosition: prevState.dropPosition || null
          });
        } catch {  }

        if (prevState.dropAction === 'reorder-sibling') {
          
          logger.debug('位置指定付き移動実行:', {
            draggedNodeId: prevState.draggedNodeId,
            targetNodeId: prevState.dropTargetId,
            position: prevState.dropPosition
          });

          
        } else if (prevState.dropAction === 'move-parent') {
          
          logger.debug('親変更実行:', {
            draggedNodeId: prevState.draggedNodeId,
            newParentId: prevState.dropTargetId
          });
          
        }
      }

      return {
        isDragging: false,
        draggedNodeId: null,
        dropTargetId: null,
        dropPosition: null,
        dropAction: null,
        dragOffset: { x: 0, y: 0 }
      };
    });
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  };
};
