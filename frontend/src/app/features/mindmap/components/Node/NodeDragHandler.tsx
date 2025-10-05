import React, { useCallback } from 'react';
import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { useDragHandler } from '@mindmap/handlers/BaseDragHandler';
import { convertScreenToSVG } from '@mindmap/handlers';
import { dispatchCanvasEvent } from '@mindmap/events/dispatcher';

interface NodeDragHandlerProps {
  node: MindMapNode;
  zoom: number;
  svgRef: React.RefObject<SVGSVGElement>;
  onDragStart?: (nodeId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (nodeId: string, x: number, y: number) => void;
}

export const useNodeDragHandler = ({
  node,
  zoom,
  svgRef,
  onDragStart,
  onDragMove,
  onDragEnd
}: NodeDragHandlerProps) => {

  // Use the shared drag handler
  const { dragState, handleStart, isDragging } = useDragHandler<string>(
    { dragThreshold: 5, enableDrag: true },
    {
      onDragStart: (nodeId) => {
        logger.debug('Node ドラッグ開始:', { nodeId });
        try { dispatchCanvasEvent({ type: 'nodeDragStart', x: 0, y: 0, targetNodeId: nodeId }); } catch {}
        if (onDragStart) {
          onDragStart(nodeId);
        }
      },
      onDragMove: (_nodeId, position) => {
        logger.debug('Node ドラッグ中:', { nodeId: node.id, clientX: position.x, clientY: position.y });
        try { dispatchCanvasEvent({ type: 'nodeDragMove', x: position.x, y: position.y, targetNodeId: node.id }); } catch {}
        if (onDragMove) {
          onDragMove(position.x, position.y);
        }
      },
      onDragEnd: (_nodeId, position) => {
        if (!svgRef.current) return;

        const svgCoords = convertScreenToSVG(position.x, position.y, svgRef, zoom, { x: 0, y: 0 });
        if (!svgCoords) return;

        const newX = svgCoords.svgX - (dragState.dragOffset?.x || 0);
        const newY = svgCoords.svgY - (dragState.dragOffset?.y || 0);

        logger.debug('Node ドラッグ終了通知:', {
          nodeId: node.id,
          newX,
          newY
        });
        try { dispatchCanvasEvent({ type: 'nodeDragEnd', x: newX, y: newY, targetNodeId: node.id }); } catch {}

        if (onDragEnd) {
          onDragEnd(node.id, newX, newY);
        }
      }
    }
  );

  // Handle mouse down to start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only react to primary button drags
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (!svgRef.current) return;

    const svgCoords = convertScreenToSVG(e.clientX, e.clientY, svgRef, zoom, { x: 0, y: 0 });
    if (!svgCoords) return;

    const dragOffset = {
      x: svgCoords.svgX - node.x,
      y: svgCoords.svgY - node.y
    };

    handleStart(e, node.id, dragOffset);
  }, [node.x, node.y, zoom, svgRef, handleStart]);

  return {
    isDragging,
    handleMouseDown
  };
};
