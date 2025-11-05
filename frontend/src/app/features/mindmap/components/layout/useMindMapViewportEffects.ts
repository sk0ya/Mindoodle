import { useEffect, useRef } from 'react';
import { mindMapEvents } from '@core/streams';
import { logger } from '@shared/utils';
import type { MindMapData } from '@shared/types';
import { useMindMapStore } from '../../store';

/**
 * Custom hook for MindMap viewport-related effects
 * Consolidates viewport control logic from MindMapApp component
 */
interface UseMindMapViewportEffectsProps {
  selectedNodeId: string | null;
  data: MindMapData | null;
  uiStore: {
    showNodeNotePanel?: boolean;
    showNotesPanel?: boolean;
    nodeNotePanelHeight?: number;
  };
  ensureSelectedNodeVisible: () => void;
  centerNodeInView: (nodeId: string, animate?: any, options?: { x: number; y: number } | { mode: string }) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  /**
   * When true, automatically ensures the selected node stays visible
   * on certain UI changes (panel resize/toggle). Defaults to false to
   * avoid surprising viewport jumps.
   */
  autoEnsureVisible?: boolean;
}

export function useMindMapViewportEffects({
  selectedNodeId,
  data,
  uiStore,
  ensureSelectedNodeVisible,
  centerNodeInView,
  setZoom,
  setPan,
  autoEnsureVisible = false,
}: UseMindMapViewportEffectsProps) {

  /**
   * Ensure selected node visibility on UI changes
   */
  useEffect(() => {
    if (!autoEnsureVisible) return;
    if (!selectedNodeId) return;

    const raf = () => requestAnimationFrame(() => ensureSelectedNodeVisible());
    const timeoutId = window.setTimeout(raf, 0);

    const resizeHandler = () => { ensureSelectedNodeVisible(); };
    window.addEventListener('node-note-panel-resize', resizeHandler as EventListener);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('node-note-panel-resize', resizeHandler as EventListener);
    };
  }, [
    autoEnsureVisible,
    selectedNodeId,
    uiStore.showNodeNotePanel,
    uiStore.showNotesPanel,
    uiStore.nodeNotePanelHeight,
    ensureSelectedNodeVisible
  ]);

  /**
   * Center root node only once after actual map identity changes (avoid fighting user pan)
   */
  const centeredAfterOpenRef = useRef(false);
  const lastMapKeyRef = useRef<string | null>(null);
  const setZoomRef = useRef(setZoom);
  const centerNodeInViewRef = useRef(centerNodeInView);
  const setPanRef = useRef(setPan);

  // Keep refs up to date without retriggering the effect
  useEffect(() => { setZoomRef.current = setZoom; }, [setZoom]);
  useEffect(() => { centerNodeInViewRef.current = centerNodeInView; }, [centerNodeInView]);
  useEffect(() => { setPanRef.current = setPan; }, [setPan]);

  useEffect(() => {
    const currentKey = data?.mapIdentifier ? `${data.mapIdentifier.workspaceId}::${data.mapIdentifier.mapId}` : null;
    if (!currentKey || !data?.rootNodes || data.rootNodes.length === 0) return;

    // Only run when the map identity actually changes
    if (lastMapKeyRef.current === currentKey) return;
    lastMapKeyRef.current = currentKey;
    centeredAfterOpenRef.current = false;

    logger.debug('📍 Map changed, resetting zoom and pan');
    setZoomRef.current(1.0);
    setPanRef.current({ x: 0, y: 0 });

    // Debounce centering until layout settles; layout.applied may fire multiple times
    let settleTimer: number | null = null;
    const tryCenterAfterSettle = () => {
      if (centeredAfterOpenRef.current) return;
      const isTreeLayout = useMindMapStore.getState().settings?.layoutType === 'tree';
      if (!isTreeLayout) return;
      const roots = data.rootNodes || [];
      if (roots.length === 0) return;
      logger.debug('📍 Layout settled (tree); aligning root to top-left');
      centeredAfterOpenRef.current = true;
      // Use top-left mode so initial anchor is at top-left, not zt
      centerNodeInViewRef.current(roots[0].id, false, { mode: 'top-left' });
      if (unsubscribeRef) unsubscribeRef();
    };

    let unsubscribeRef: (() => void) | null = null;
    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type !== 'layout.applied') return;
      if (centeredAfterOpenRef.current) return;
      if (settleTimer) window.clearTimeout(settleTimer);
      // Wait a short window; if no further layout within this window, center
      settleTimer = window.setTimeout(tryCenterAfterSettle, 150);
    });
    unsubscribeRef = unsubscribe;

    // Absolute fallback in case no events fire at all
    const timer = window.setTimeout(() => {
      if (centeredAfterOpenRef.current) return;
      tryCenterAfterSettle();
    }, 300);

    return () => {
      if (unsubscribeRef) unsubscribeRef();
      if (settleTimer) window.clearTimeout(settleTimer);
      window.clearTimeout(timer);
    };
  }, [data?.mapIdentifier?.mapId, data?.mapIdentifier?.workspaceId, selectedNodeId, data?.rootNodes]);
}
