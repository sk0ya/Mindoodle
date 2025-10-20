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
}

export function useMindMapViewportEffects({
  selectedNodeId,
  data,
  uiStore,
  ensureSelectedNodeVisible,
  centerNodeInView,
  setZoom,
}: UseMindMapViewportEffectsProps) {

  /**
   * Ensure selected node visibility on UI changes
   */
  useEffect(() => {
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
    selectedNodeId,
    uiStore.showNodeNotePanel,
    uiStore.showNotesPanel,
    uiStore.nodeNotePanelHeight,
    ensureSelectedNodeVisible
  ]);

  /**
   * Center root node only once after map changes (avoid fighting user pan)
   */
  const centeredAfterOpenRef = useRef(false);
  useEffect(() => {
    if (!data?.rootNodes || data.rootNodes.length === 0) return;

    // Reset flag for the new map
    centeredAfterOpenRef.current = false;

    logger.debug('📍 Map changed, resetting zoom');
    setZoom(1.0);

    // Listen for first layout completion only
    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type !== 'layout.applied') return;
      if (centeredAfterOpenRef.current) return;
      // If user already has a selection, don't recenter to avoid jump
      if (selectedNodeId) return;

      const roots = data.rootNodes || [];
      if (roots.length === 0) return;

      logger.debug('📍 First layout after open; centering root node (left)');
      centeredAfterOpenRef.current = true;
      // Small delay to ensure DOM is updated
      window.setTimeout(() => {
        centerNodeInView(roots[0].id, false, { mode: 'left' });
      }, 10);
      // Stop listening after the first center
      unsubscribe();
    });

    // Fallback: if no layout event, center once after a short delay
    const timer = window.setTimeout(() => {
      if (centeredAfterOpenRef.current) return;
      if (selectedNodeId) return;
      const roots = data.rootNodes || [];
      if (roots.length > 0) {
        logger.debug('📍 No layout event; centering root node (left) once');
        centeredAfterOpenRef.current = true;
        centerNodeInView(roots[0].id, false, { mode: 'left' });
        unsubscribe();
      }
    }, 100);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [data?.rootNodes, selectedNodeId, setZoom, centerNodeInView]);
}
