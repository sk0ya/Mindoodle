

import { useCallback, useRef } from 'react';
import { isNodeElement, getClientCoordinates, calculateDistance } from '../utils/canvasCoordinateUtils';

export interface BaseEventState {
  isActive: boolean;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
}

export interface EventThresholds {
  clickThreshold: number;  
  dragThreshold: number;   
}

export interface BaseEventConfig {
  thresholds: EventThresholds;
  preventDefaults: boolean;
}


export const useBaseEventHandler = (
  _svgRef: React.RefObject<SVGSVGElement>,
  config: BaseEventConfig = {
    thresholds: { clickThreshold: 5, dragThreshold: 5 },
    preventDefaults: true
  }
) => {
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  
  const checkIsNodeElement = useCallback((target: Element): boolean => {
    return isNodeElement(target);
  }, []);

  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = getClientCoordinates(e);
    mouseDownPosRef.current = { x: clientX, y: clientY };

    if (config.preventDefaults) {
      e.preventDefault();
    }
  }, [config.preventDefaults]);

  
  const getMovementSinceMouseDown = useCallback((e: React.MouseEvent | MouseEvent): number => {
    if (!mouseDownPosRef.current) return 0;

    const { clientX, clientY } = getClientCoordinates(e);
    return calculateDistance(
      mouseDownPosRef.current.x,
      mouseDownPosRef.current.y,
      clientX,
      clientY
    );
  }, []);

  
  const isClickMovement = useCallback((e: React.MouseEvent | MouseEvent): boolean => {
    const movement = getMovementSinceMouseDown(e);
    return movement <= config.thresholds.clickThreshold;
  }, [getMovementSinceMouseDown, config.thresholds.clickThreshold]);

  
  const isDragMovement = useCallback((e: React.MouseEvent | MouseEvent): boolean => {
    const movement = getMovementSinceMouseDown(e);
    return movement > config.thresholds.dragThreshold;
  }, [getMovementSinceMouseDown, config.thresholds.dragThreshold]);

  
  const handleMouseUp = useCallback((
    e: React.MouseEvent,
    onBackgroundClick?: () => void,
    onNodeClick?: (target: Element) => void
  ) => {
    if (!mouseDownPosRef.current) return;

    const target = e.target as Element;
    const isNode = checkIsNodeElement(target);
    const isClick = isClickMovement(e);

    
    mouseDownPosRef.current = null;

    if (isClick) {
      if (isNode && onNodeClick) {
        onNodeClick(target);
      } else if (!isNode && onBackgroundClick) {
        onBackgroundClick();
      }
    }
  }, [checkIsNodeElement, isClickMovement]);

  
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    onContextMenu?: (target: Element, position: { x: number; y: number }) => void
  ) => {
    if (config.preventDefaults) {
      e.preventDefault();
    }

    if (onContextMenu) {
      const { clientX, clientY } = getClientCoordinates(e);
      onContextMenu(e.target as Element, { x: clientX, y: clientY });
    }
  }, [config.preventDefaults]);

  
  const preventDefaultIfNeeded = useCallback((e: Event) => {
    if (config.preventDefaults) {
      e.preventDefault();
    }
  }, [config.preventDefaults]);

  
  const clearMouseDownState = useCallback(() => {
    mouseDownPosRef.current = null;
  }, []);

  return {
    
    handleMouseDown,
    handleMouseUp,
    handleContextMenu,

    
    checkIsNodeElement,
    getMovementSinceMouseDown,
    isClickMovement,
    isDragMovement,
    preventDefaultIfNeeded,
    clearMouseDownState,

    
    hasMouseDownPosition: () => mouseDownPosRef.current !== null
  };
};