import { useRef, useCallback, useEffect } from 'react';
import { isNodeElement } from '@mindmap/utils';
// no logging for viewport interactions to avoid console noise

interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

interface CanvasViewportHandlerProps {
  zoom: number;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  svgRef: React.RefObject<SVGSVGElement>;
  isDragging?: boolean;
}

export const useCanvasViewportHandler = ({
  zoom,
  setZoom,
  setPan,
  svgRef,
  isDragging = false
}: CanvasViewportHandlerProps) => {
  const isPanningRef = useRef(false);
  const isPanReadyRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const rafIdRef = useRef<number | null>(null);
  const accumDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  }, [zoom, setZoom, svgRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left-click initiates panning, and not while dragging nodes
    if (e.button !== 0 || isDragging) {
      isPanReadyRef.current = false;
      return;
    }

    const target = e.target as Element;
    const isNode = isNodeElement(target);

    if (!isNode) {
      isPanReadyRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    } else {
      // click on node: do not start panning
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) {
      isPanningRef.current = false;
      isPanReadyRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        accumDeltaRef.current = { dx: 0, dy: 0 };
      }
    }
  }, [isDragging]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // If no mouse button is pressed (e.g., released outside window), cancel panning
    if (e.buttons === 0) {
      // Reuse mouse up cleanup to reset state
      handleMouseUp();
      return;
    }

    if (isPanReadyRef.current && !isDragging) {
      const deltaX = e.clientX - lastPanPointRef.current.x;
      const deltaY = e.clientY - lastPanPointRef.current.y;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      if (!isPanningRef.current) {
        isPanningRef.current = true;
      }

      accumDeltaRef.current.dx += deltaX / (zoom * 1.5);
      accumDeltaRef.current.dy += deltaY / (zoom * 1.5);

      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(() => {
          const { dx, dy } = accumDeltaRef.current;
          accumDeltaRef.current = { dx: 0, dy: 0 };
          rafIdRef.current = null;
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        });
      }

      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragging, zoom, setPan, handleMouseUp]);

  useEffect(() => {
    const onDocMouseMove = handleMouseMove;
    const onDocMouseUp = () => { handleMouseUp(); };
    const onDocPointerUp = () => { handleMouseUp(); };
    const onDocPointerCancel = () => { handleMouseUp(); };
    const onDocMouseLeave = () => { handleMouseUp(); };
    const onWinBlur = () => { handleMouseUp(); };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        handleMouseUp();
      }
    };

    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    // Pointer events for broader coverage
    document.addEventListener('pointerup', onDocPointerUp);
    document.addEventListener('pointercancel', onDocPointerCancel);
    // Guard against losing the mouseup when cursor leaves or window blurs
    document.addEventListener('mouseleave', onDocMouseLeave);
    window.addEventListener('blur', onWinBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('mousemove', onDocMouseMove);
      document.removeEventListener('mouseup', onDocMouseUp);
      document.removeEventListener('pointerup', onDocPointerUp);
      document.removeEventListener('pointercancel', onDocPointerCancel);
      document.removeEventListener('mouseleave', onDocMouseLeave);
      window.removeEventListener('blur', onWinBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleMouseMove, handleMouseUp]);

  const getCursor = useCallback(() => {
    if (isPanningRef.current) return 'grabbing';
    if (isDragging) return 'grabbing';
    return 'grab';
  }, [isDragging]);

  const getIsPanning = useCallback(() => {
    return isPanningRef.current;
  }, []);

  return {
    handleWheel,
    handleMouseDown,
    handleMouseUp,
    getCursor,
    getIsPanning
  };
};

export type { ViewportState, CanvasViewportHandlerProps };
