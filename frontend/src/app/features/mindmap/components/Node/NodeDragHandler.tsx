import React, { useCallback } from 'react';
import { useMindMapStore } from '../../../../shared/store';
import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import {
  useDragHandler,
  convertScreenToSVG,
  snapToGrid
} from '@shared/handlers';

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
  const { settings } = useMindMapStore();

  // Use the shared drag handler
  const { dragState, handleStart, isDragging } = useDragHandler<string>(
    { dragThreshold: 5, enableDrag: true },
    {
      onDragStart: (nodeId) => {
        logger.debug('Node ドラッグ開始:', { nodeId });
        if (onDragStart) {
          onDragStart(nodeId);
        }
      },
      onDragMove: (_nodeId, position) => {
        logger.debug('Node ドラッグ中:', { nodeId: node.id, clientX: position.x, clientY: position.y });
        if (onDragMove) {
          onDragMove(position.x, position.y);
        }
      },
      onDragEnd: (_nodeId, position) => {
        if (!svgRef.current) return;

        const svgCoords = convertScreenToSVG(position.x, position.y, svgRef, zoom, { x: 0, y: 0 });
        if (!svgCoords) return;

        const rawX = svgCoords.svgX - (dragState.dragOffset?.x || 0);
        const rawY = svgCoords.svgY - (dragState.dragOffset?.y || 0);

        // Apply grid snapping
        const { x: newX, y: newY } = snapToGrid(rawX, rawY, 20, settings.snapToGrid);

        logger.debug('Node ドラッグ終了通知:', {
          nodeId: node.id,
          rawX,
          rawY,
          newX,
          newY,
          snapToGrid: settings.snapToGrid
        });

        if (onDragEnd) {
          onDragEnd(node.id, newX, newY);
        }
      }
    }
  );

  // Handle mouse down to start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

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