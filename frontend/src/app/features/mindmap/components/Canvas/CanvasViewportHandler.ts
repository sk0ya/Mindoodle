import { useRef, useCallback, useEffect } from 'react';
import { getCanvasTransform, isNodeElement, screenDeltaToCanvasPanDelta } from '@mindmap/utils';
// no logging for viewport interactions to avoid console noise

interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

interface CanvasViewportHandlerProps {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  svgRef: React.RefObject<SVGSVGElement>;
  canvasGroupRef: React.RefObject<SVGGElement>;
  isDragging?: boolean;
}

export const useCanvasViewportHandler = ({
  zoom,
  pan,
  setZoom,
  setPan,
  svgRef,
  canvasGroupRef,
  isDragging = false
}: CanvasViewportHandlerProps) => {
  const isPanningRef = useRef(false);
  const isPanReadyRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const previewPanRef = useRef(pan);
  const panFrameRef = useRef<number | null>(null);

  const setCanvasCursor = useCallback((cursor: 'grab' | 'grabbing') => {
    if (svgRef.current) {
      svgRef.current.style.cursor = cursor;
    }
  }, [svgRef]);

  // Keep transient pan movement out of React's render loop. The SVG group is
  // updated directly while dragging, and the final value is committed on end.
  const applyPanPreview = useCallback((nextPan: { x: number; y: number }) => {
    const group = canvasGroupRef.current;
    if (group) {
      group.setAttribute('transform', getCanvasTransform(zoom, nextPan));
    }
  }, [canvasGroupRef, zoom]);

  const schedulePanPreview = useCallback(() => {
    if (panFrameRef.current !== null) return;

    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null;
      applyPanPreview(previewPanRef.current);
    });
  }, [applyPanPreview]);

  const commitPanPreview = useCallback(() => {
    if (!isPanningRef.current) return;

    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
    applyPanPreview(previewPanRef.current);
    setPan(previewPanRef.current);
  }, [applyPanPreview, setPan]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    // Do not let a wheel update overwrite a pan that is still only in the DOM.
    commitPanPreview();

    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  }, [commitPanPreview, zoom, setZoom, svgRef]);

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
      previewPanRef.current = pan;
      e.preventDefault();
    } else {
      // click on node: do not start panning
    }
  }, [isDragging, pan]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) return;

    commitPanPreview();
    isPanningRef.current = false;
    isPanReadyRef.current = false;
    setCanvasCursor('grab');
  }, [commitPanPreview, isDragging, setCanvasCursor]);

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

      // Don't skip small movements - let them accumulate
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      if (!isPanningRef.current) {
        isPanningRef.current = true;
      }
      setCanvasCursor('grabbing');

      const nextPan = {
        x: previewPanRef.current.x + screenDeltaToCanvasPanDelta(deltaX, zoom),
        y: previewPanRef.current.y + screenDeltaToCanvasPanDelta(deltaY, zoom)
      };

      previewPanRef.current = nextPan;
      schedulePanPreview();

      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [handleMouseUp, isDragging, schedulePanPreview, setCanvasCursor, zoom]);

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

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current);
      }
    };
  }, []);

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
