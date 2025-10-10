import { useCallback } from 'react';
import { findNodeInRoots, calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '../store';
import type { MindMapNode } from '@shared/types';

export interface ViewportOperationsParams {
  data: { rootNodes: MindMapNode[] } | null;
  activeView: string | null;
  uiStore: {
    sidebarCollapsed: boolean;
    showNotesPanel: boolean;
    markdownPanelWidth: number;
    showNodeNotePanel: boolean;
    nodeNotePanelHeight: number;
    zoom: number;
    pan: { x: number; y: number };
  };
  settings: {
    fontSize?: number;
  };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}

 

/**
 * Hook for handling viewport and resize operations
 */
export function useMindMapViewport({
  data,
  activeView,
  uiStore,
  settings: _settings,
  setPan,
}: ViewportOperationsParams) {

  /**
   * Ensure selected node remains visible with minimal pan (no centering)
   */
  const ensureSelectedNodeVisible = useCallback(() => {
    try {
      const st = useMindMapStore.getState() as any;
      const selId: string | null = st.selectedNodeId || null;
      const mapData = st.data || null;
      if (!selId || !mapData) return;
      const roots = mapData.rootNodes || [];
      const targetNode = findNodeInRoots(roots, selId);
      if (!targetNode) return;

      // Get current UI state from store (not from component closure)
      const currentUI = st.ui || {};
      const currentActiveView = currentUI.activeView;
      const currentSidebarCollapsed = currentUI.sidebarCollapsed;

      const mindmapContainer = document.querySelector('.mindmap-canvas-container') ||
                               document.querySelector('.workspace-container') ||
                               document.querySelector('.mindmap-app');

      let { width: effectiveWidth, height: effectiveHeight } = viewportService.getSize();
      let offsetX = 0;
      let offsetY = 0;

      if (mindmapContainer) {
        const rect = mindmapContainer.getBoundingClientRect();
        effectiveWidth = rect.width;
        effectiveHeight = rect.height;
        offsetX = rect.left;
        offsetY = rect.top;

        // Even when using container, we need to check if sidebar should be considered
        // Container might already account for sidebar, but let's verify the offsetX
        if (currentActiveView && !currentSidebarCollapsed && offsetX === 0) {
          // Container doesn't account for sidebar, so we need to adjust
          const ACTIVITY_BAR_WIDTH = 48;
          const sidebarPanel = document.querySelector('.mindmap-sidebar');
          let sidebarWidth = 0;
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              sidebarWidth = sidebarRect.width;
            } catch {}
          } else {
            sidebarWidth = 280; // fallback
          }
          const totalLeftOffset = ACTIVITY_BAR_WIDTH + sidebarWidth;
          offsetX = totalLeftOffset;
        }
      } else {
        // Left sidebar - use same pattern as panels: DOM first, fallback to store/fixed values
        const ACTIVITY_BAR_WIDTH = 48;
        const SIDEBAR_WIDTH = 280; // fallback
        let leftPanelWidth = ACTIVITY_BAR_WIDTH;

        if (currentActiveView && !currentSidebarCollapsed) {
          // Try to get actual sidebar width from DOM first (like panels)
          const sidebarPanel = document.querySelector('.mindmap-sidebar');
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              leftPanelWidth += sidebarRect.width;
            } catch {}
          } else {
            // Fallback to fixed width if DOM not available
            leftPanelWidth += SIDEBAR_WIDTH;
          }
        }

        effectiveWidth -= leftPanelWidth;
        offsetX = leftPanelWidth;

        // Right-side markdown panel (primary right panel in this app)
        const markdownPanel = document.querySelector('.markdown-panel');
        if (markdownPanel) {
          try {
            const pr = markdownPanel.getBoundingClientRect();
            effectiveWidth -= pr.width;
          } catch {}
        } else if (currentUI.showNotesPanel && currentUI.markdownPanelWidth) {
          // Fallback to store width if DOM not yet available
          const w = Math.max(0, currentUI.markdownPanelWidth);
          effectiveWidth -= w;
        }
      }

      // Bottom overlays (apply regardless of container measurement):
      // selected-node-note-panel is fixed overlay and not part of container height
      try {
        const notePanel = document.querySelector('.selected-node-note-panel');
        const noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
        effectiveHeight -= noteH;
      } catch {}
      // Vim status bar height
      effectiveHeight -= 24;

      const currentZoom = (st.ui?.zoom || 1) * 1.5; // Match CanvasRenderer transform
      const currentPan = st.ui?.pan || { x: 0, y: 0 };

      // Compute node size to align edges to bounds
      const fontSize = (st.settings?.fontSize ?? 14) as number;
      const wrapConfig = resolveNodeTextWrapConfig(st.settings, fontSize);
      const nodeSize = calculateNodeSize(targetNode as any, undefined as any, false, fontSize, wrapConfig);
      const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
      const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

      // Node center in screen coords relative to effective viewport origin
      const screenX = currentZoom * (targetNode.x + currentPan.x) - offsetX;
      const screenY = currentZoom * (targetNode.y + currentPan.y) - offsetY;

      const margin = 0;
      const topMargin = 0; // symmetric top/bottom
      const bottomExtra = (function() {
        // If no note panel height (not visible), keep 6px breathing room above Vim bar
        try {
          const notePanel = document.querySelector('.selected-node-note-panel');
          const noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
          return noteH === 0 ? 6 : 0;
        } catch { return 0; }
      })();
      const leftBound = margin;
      const rightBound = effectiveWidth - margin;
      const topBound = topMargin;
      const bottomBound = effectiveHeight - topMargin - bottomExtra;

      const isOutsideLeft = (screenX - halfW) < leftBound;
      const isOutsideRight = (screenX + halfW) > rightBound;
      const isOutsideTop = (screenY - halfH) < topBound;
      const isOutsideBottom = (screenY + halfH) > bottomBound;

      if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
        let newPanX = currentPan.x;
        let newPanY = currentPan.y;

        if (isOutsideLeft) {
          // Align node's left edge to leftBound
          newPanX = ((leftBound + offsetX + halfW) / currentZoom) - targetNode.x;
        } else if (isOutsideRight) {
          // Align node's right edge to rightBound
          newPanX = ((rightBound + offsetX - halfW) / currentZoom) - targetNode.x;
        }

        if (isOutsideTop) {
          // Align node's top edge to topBound
          newPanY = ((topBound + offsetY + halfH) / currentZoom) - targetNode.y;
        } else if (isOutsideBottom) {
          // Align node's bottom edge to bottomBound
          newPanY = ((bottomBound + offsetY - halfH) / currentZoom) - targetNode.y;
        }

        const setPanLocal = (st.setPan || setPan);
        setPanLocal({ x: newPanX, y: newPanY });
      }
    } catch {}
  }, [activeView, uiStore.sidebarCollapsed, uiStore.showNotesPanel, uiStore.markdownPanelWidth, setPan]);

  /**
   * Center node in view with optional positioning modes
   */
   
  const centerNodeInView = useCallback((nodeId: string, _animate = false, fallbackCoords?: { x: number; y: number } | { mode: string }) => {
    if (!data) return;

    // Check if special positioning mode is requested
    const isLeftMode = fallbackCoords && 'mode' in fallbackCoords && (fallbackCoords as any).mode === 'left';

    // Find root node or search in tree
    const rootNodes = data.rootNodes || [];
    const targetNode = rootNodes.length > 0 && rootNodes[0].id === nodeId
      ? rootNodes[0]
      : findNodeInRoots(rootNodes, nodeId);

    // Calculate viewport dimensions
    const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();

    // Left panel width calculation
    const ACTIVITY_BAR_WIDTH = 48;
    const SIDEBAR_WIDTH = 280;
    const leftPanelWidth = ACTIVITY_BAR_WIDTH + (activeView && !uiStore.sidebarCollapsed ? SIDEBAR_WIDTH : 0);

    // Right panel width from UI state
    const rightPanelWidth = uiStore.showNotesPanel ? (uiStore.markdownPanelWidth || 0) : 0;

    // Calculate available map area
    const VIM_HEIGHT = 24;
    const defaultNoteHeight = viewportService.getDefaultNoteHeight();
    let noteHeight = uiStore.showNodeNotePanel
      ? (uiStore.nodeNotePanelHeight && uiStore.nodeNotePanelHeight > 0 ? uiStore.nodeNotePanelHeight : defaultNoteHeight)
      : 0;

    // Read DOM for actual height
    let domNoteHeight = 0;
    try {
      const el = document.querySelector('.selected-node-note-panel');
      domNoteHeight = el ? Math.round(el.getBoundingClientRect().height) : 0;
    } catch {}
    if (domNoteHeight > 0 && domNoteHeight !== noteHeight) {
      noteHeight = domNoteHeight;
    }
    const bottomOverlay = Math.max(noteHeight, VIM_HEIGHT);

    const mapAreaRect = new DOMRect(
      leftPanelWidth,
      0,
      Math.max(0, viewportWidth - leftPanelWidth - rightPanelWidth),
      Math.max(0, viewportHeight - bottomOverlay)
    );

    if (!targetNode) {
      if (fallbackCoords && 'x' in fallbackCoords && 'y' in fallbackCoords) {
        // Use fallback coordinates for centering
        const nodeX = fallbackCoords.x;
        const nodeY = fallbackCoords.y;

        const positionRatio = isLeftMode ? 0.1 : 0.5; // Left 10% or center 50%
        const targetX = mapAreaRect.left + (mapAreaRect.width * positionRatio);
        const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
        const currentZoom = uiStore.zoom * 1.5;

        const newPanX = targetX / currentZoom - nodeX;
        const newPanY = targetY / currentZoom - nodeY;

        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // Node coordinates
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    // Current zoom (SVG uses 1.5x scaling)
    const currentZoom = uiStore.zoom * 1.5;

    // Left mode: position node at 10% from left
    if (isLeftMode) {
      const targetX = mapAreaRect.left + (mapAreaRect.width * 0.1);
      const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
      const newPanX = targetX / currentZoom - nodeX;
      const newPanY = targetY / currentZoom - nodeY;
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    // Center mode or default: center the node
    const targetX = mapAreaRect.left + (mapAreaRect.width / 2);
    const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
    const newPanX = targetX / currentZoom - nodeX;
    const newPanY = targetY / currentZoom - nodeY;
    setPan({ x: newPanX, y: newPanY });
  }, [data, activeView, uiStore, setPan]);

  return {
    ensureSelectedNodeVisible,
    centerNodeInView,
  };
}
