import { useEffect, useRef } from 'react';
import { mindMapEvents } from '@core/streams';
import { logger } from '@shared/utils';
import type { MindMapData } from '@shared/types';

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

  // Keep refs up to date without retriggering the effect
  useEffect(() => { setZoomRef.current = setZoom; }, [setZoom]);
  useEffect(() => { centerNodeInViewRef.current = centerNodeInView; }, [centerNodeInView]);

  useEffect(() => {
    const currentKey = data?.mapIdentifier ? `${data.mapIdentifier.workspaceId}::${data.mapIdentifier.mapId}` : null;
    if (!currentKey || !data?.rootNodes || data.rootNodes.length === 0) return;

    // Only run when the map identity actually changes
    if (lastMapKeyRef.current === currentKey) return;
    lastMapKeyRef.current = currentKey;
    centeredAfterOpenRef.current = false;

    logger.debug('📍 Map changed, resetting zoom');
    setZoomRef.current(1.0);

    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type !== 'layout.applied') return;
      if (centeredAfterOpenRef.current) return;
      if (selectedNodeId) return; // avoid jump when user already selected

      const roots = data.rootNodes || [];
      if (roots.length === 0) return;

      logger.debug('📍 First layout after open; centering root node (left)');
      centeredAfterOpenRef.current = true;
      window.setTimeout(() => {
        centerNodeInViewRef.current(roots[0].id, false, { mode: 'left' });
      }, 10);
      unsubscribe();
    });

    const timer = window.setTimeout(() => {
      if (centeredAfterOpenRef.current) return;
      if (selectedNodeId) return;
      const roots = data.rootNodes || [];
      if (roots.length > 0) {
        logger.debug('📍 No layout event; centering root node (left) once');
        centeredAfterOpenRef.current = true;
        centerNodeInViewRef.current(roots[0].id, false, { mode: 'left' });
        unsubscribe();
      }
    }, 100);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [data?.mapIdentifier?.mapId, data?.mapIdentifier?.workspaceId, selectedNodeId, data?.rootNodes]);
}
