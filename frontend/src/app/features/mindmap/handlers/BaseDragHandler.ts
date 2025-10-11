

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClientCoordinates, calculateDistance } from '../utils/canvasCoordinateUtils';

export interface DragState<T = unknown> {
  isDragging: boolean;
  draggedItem: T | null;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  dragOffset: { x: number; y: number };
}

export interface BaseDragConfig {
  dragThreshold: number;
  enableDrag: boolean;
}

export interface DragCallbacks<T> {
  onDragStart?: (item: T, position: { x: number; y: number }) => void;
  onDragMove?: (item: T, position: { x: number; y: number }) => void;
  onDragEnd?: (item: T, position: { x: number; y: number }) => void;
  onDragCancel?: (item: T) => void;
}


export const useDragHandler = <T = unknown>(
  config: BaseDragConfig = { dragThreshold: 5, enableDrag: true },
  callbacks: DragCallbacks<T> = {}
) => {
  const [dragState, setDragState] = useState<DragState<T>>({
    isDragging: false,
    draggedItem: null,
    startPosition: null,
    currentPosition: null,
    dragOffset: { x: 0, y: 0 }
  });

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);

  const { onDragStart, onDragMove, onDragEnd, onDragCancel } = callbacks;

  
  const handleStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    item: T,
    offset: { x: number; y: number } = { x: 0, y: 0 }
  ) => {
    if (!config.enableDrag) return;

    e.preventDefault();
    const { clientX, clientY } = getClientCoordinates(e);

    mouseDownPosRef.current = { x: clientX, y: clientY };
    dragStartedRef.current = false;

    setDragState({
      isDragging: false,
      draggedItem: item,
      startPosition: { x: clientX, y: clientY },
      currentPosition: { x: clientX, y: clientY },
      dragOffset: offset
    });
  }, [config.enableDrag]);

  
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!mouseDownPosRef.current || !dragState.draggedItem) return;

    const { clientX, clientY } = getClientCoordinates(e);

    
    if (!dragStartedRef.current) {
      const distance = calculateDistance(
        mouseDownPosRef.current.x,
        mouseDownPosRef.current.y,
        clientX,
        clientY
      );

      if (distance > config.dragThreshold) {
        dragStartedRef.current = true;
        setDragState(prev => ({ ...prev, isDragging: true }));

        if (onDragStart) {
          onDragStart(dragState.draggedItem, { x: clientX, y: clientY });
        }
      }
    } else {
      
      setDragState(prev => ({
        ...prev,
        currentPosition: { x: clientX, y: clientY }
      }));

      if (onDragMove) {
        onDragMove(dragState.draggedItem, { x: clientX, y: clientY });
      }
    }
  }, [dragState.draggedItem, config.dragThreshold, onDragStart, onDragMove]);

  
  const handleEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState.draggedItem) return;

    const { clientX, clientY } = getClientCoordinates(e);

    if (dragStartedRef.current && onDragEnd) {
      onDragEnd(dragState.draggedItem, { x: clientX, y: clientY });
    }

    
    mouseDownPosRef.current = null;
    dragStartedRef.current = false;
    setDragState({
      isDragging: false,
      draggedItem: null,
      startPosition: null,
      currentPosition: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, [dragState.draggedItem, onDragEnd]);

  
  const cancelDrag = useCallback(() => {
    if (dragState.draggedItem && onDragCancel) {
      onDragCancel(dragState.draggedItem);
    }

    mouseDownPosRef.current = null;
    dragStartedRef.current = false;
    setDragState({
      isDragging: false,
      draggedItem: null,
      startPosition: null,
      currentPosition: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, [dragState.draggedItem, onDragCancel]);

  
  useEffect(() => {
    if (dragState.draggedItem) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
    return undefined;
  }, [dragState.draggedItem, handleMove, handleEnd]);

  return {
    dragState,
    handleStart,
    cancelDrag,
    isDragging: dragState.isDragging
  };
};