/**
 * Base event handler providing common event handling functionality
 * Abstract base for canvas and node event handlers
 */

import { useCallback, useRef } from 'react';
import { isNodeElement, getClientCoordinates, calculateDistance } from '../utils/canvasCoordinateUtils';

export interface BaseEventState {
  isActive: boolean;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
}

export interface EventThresholds {
  clickThreshold: number;  // Maximum movement to be considered a click
  dragThreshold: number;   // Minimum movement to start drag
}

export interface BaseEventConfig {
  thresholds: EventThresholds;
  preventDefaults: boolean;
}

/**
 * Custom hook for base event handling functionality
 */
export const useBaseEventHandler = (
  _svgRef: React.RefObject<SVGSVGElement>,
  config: BaseEventConfig = {
    thresholds: { clickThreshold: 5, dragThreshold: 5 },
    preventDefaults: true
  }
) => {
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Check if the target element is a node element
   */
  const checkIsNodeElement = useCallback((target: Element): boolean => {
    return isNodeElement(target);
  }, []);

  /**
   * Handle mouse down with position tracking
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = getClientCoordinates(e);
    mouseDownPosRef.current = { x: clientX, y: clientY };

    if (config.preventDefaults) {
      e.preventDefault();
    }
  }, [config.preventDefaults]);

  /**
   * Calculate movement since mouse down
   */
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

  /**
   * Check if movement qualifies as a click (within threshold)
   */
  const isClickMovement = useCallback((e: React.MouseEvent | MouseEvent): boolean => {
    const movement = getMovementSinceMouseDown(e);
    return movement <= config.thresholds.clickThreshold;
  }, [getMovementSinceMouseDown, config.thresholds.clickThreshold]);

  /**
   * Check if movement qualifies as a drag (exceeds threshold)
   */
  const isDragMovement = useCallback((e: React.MouseEvent | MouseEvent): boolean => {
    const movement = getMovementSinceMouseDown(e);
    return movement > config.thresholds.dragThreshold;
  }, [getMovementSinceMouseDown, config.thresholds.dragThreshold]);

  /**
   * Handle mouse up with click/drag detection
   */
  const handleMouseUp = useCallback((
    e: React.MouseEvent,
    onBackgroundClick?: () => void,
    onNodeClick?: (target: Element) => void
  ) => {
    if (!mouseDownPosRef.current) return;

    const target = e.target as Element;
    const isNode = checkIsNodeElement(target);
    const isClick = isClickMovement(e);

    // Clear mouse down position
    mouseDownPosRef.current = null;

    if (isClick) {
      if (isNode && onNodeClick) {
        onNodeClick(target);
      } else if (!isNode && onBackgroundClick) {
        onBackgroundClick();
      }
    }
  }, [checkIsNodeElement, isClickMovement]);

  /**
   * Handle context menu (right click)
   */
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

  /**
   * Prevent default behavior if configured
   */
  const preventDefaultIfNeeded = useCallback((e: Event) => {
    if (config.preventDefaults) {
      e.preventDefault();
    }
  }, [config.preventDefaults]);

  /**
   * Clear mouse down state (useful for external reset)
   */
  const clearMouseDownState = useCallback(() => {
    mouseDownPosRef.current = null;
  }, []);

  return {
    // Event handlers
    handleMouseDown,
    handleMouseUp,
    handleContextMenu,

    // Utility functions
    checkIsNodeElement,
    getMovementSinceMouseDown,
    isClickMovement,
    isDragMovement,
    preventDefaultIfNeeded,
    clearMouseDownState,

    // State getters
    hasMouseDownPosition: () => mouseDownPosRef.current !== null
  };
};