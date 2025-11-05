import { findNodeInRoots, calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '../store';
import type { MindMapNode } from '@shared/types';
import { useStableCallback } from '@shared/hooks';
import { useEffect, useRef } from 'react';
import { mindMapEvents } from '@core/streams';

export interface ViewportOperationsParams {
  data: { rootNodes: MindMapNode[] } | null;
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
    layoutType?: 'mindmap' | 'tree';
  };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}

 


export function useMindMapViewport({
  data,
  uiStore,
  settings: _settings,
  setPan,
}: ViewportOperationsParams) {

  
  // Suppress auto-pan immediately after layout application to avoid unexpected jumps
  const suppressAutoPanUntilRef = useRef<number>(0);
  // Suppress auto-pan right after selection changes (e.g., insert selects new node)
  const suppressAfterSelectionUntilRef = useRef<number>(0);
  const lastSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type === 'layout.applied') {
        // Suppress for a short window; debounced layouts will extend suppression
        suppressAutoPanUntilRef.current = performance.now() + 800; // ms
      }
    });
    return () => unsubscribe();
  }, []);

  const ensureSelectedNodeVisible = useStableCallback((options?: { force?: boolean }) => {
    // Skip adjustments during suppression window unless forced (keyboard nav)
    if (!options?.force && performance.now() < suppressAutoPanUntilRef.current) return;
    try {
      const st = useMindMapStore.getState();
      const selId: string | null = st.selectedNodeId || null;
      // If selection just changed, suppress briefly to avoid jumpiness (e.g., after insert)
      if (!options?.force && selId !== lastSelectedIdRef.current) {
        lastSelectedIdRef.current = selId;
        suppressAfterSelectionUntilRef.current = performance.now() + 600; // ms
        return;
      }
      if (!options?.force && performance.now() < suppressAfterSelectionUntilRef.current) {
        return;
      }
      const mapData = st.data || null;
      if (!selId || !mapData) return;
      const roots = mapData.rootNodes || [];
      const targetNode = findNodeInRoots(roots, selId);
      if (!targetNode) return;

      // Base container rect and inner SVG border/padding
      const containerEl = document.querySelector('.mindmap-canvas-container') as HTMLElement | null;
      const containerRect = containerEl?.getBoundingClientRect();
      const svgEl = containerEl?.querySelector('svg') as SVGSVGElement | null;
      const svgStyles = svgEl ? getComputedStyle(svgEl) : null;
      const svgBorderLeft = svgStyles ? parseFloat(svgStyles.borderLeftWidth || '0') || 0 : 0;
      const svgBorderTop = svgStyles ? parseFloat(svgStyles.borderTopWidth || '0') || 0 : 0;
      const svgBorderRight = svgStyles ? parseFloat(svgStyles.borderRightWidth || '0') || 0 : 0;
      const svgBorderBottom = svgStyles ? parseFloat(svgStyles.borderBottomWidth || '0') || 0 : 0;
      // Compute the actual SVG content box (inside borders)
      const svgRect = svgEl?.getBoundingClientRect();
      const containerLeft = ((svgRect?.left ?? containerRect?.left ?? 0) + svgBorderLeft);
      const containerTop = ((svgRect?.top ?? containerRect?.top ?? 0) + svgBorderTop);
      const rawContainerWidth = (svgRect?.width ?? containerRect?.width ?? viewportService.getSize().width);
      const rawContainerHeight = (svgRect?.height ?? containerRect?.height ?? viewportService.getSize().height);
      const containerWidth = Math.max(0, rawContainerWidth - svgBorderLeft - svgBorderRight);
      const containerHeight = Math.max(0, rawContainerHeight - svgBorderTop - svgBorderBottom);
      const containerBottom = containerTop + containerHeight;

      // The canvas container's rect already accounts for sidebars and activity bar
      // because they are outside the container's flow. Do not subtract them again.
      const leftOverlay = 0;
      const rightOverlay = 0;
      // Measure Vim status bar height dynamically (fallback 24)
      let statusBarHeight = 24;
      try {
        const vimBar = document.querySelector('.vim-status-bar') as HTMLElement | null;
        const vimH = vimBar ? Math.round(vimBar.getBoundingClientRect().height) : 0;
        if (vimH > 0) statusBarHeight = vimH;
      } catch {}
      // NOTE: The node note panel is part of normal layout flow (a flex sibling),
      // so containerRect already excludes its height. Do NOT subtract it again here.
      const viewportH = viewportService.getSize().height;
      // Visible bottom is limited by fixed overlays (Vim bar) if they overlap the SVG area
      const overlayTopY = viewportH - statusBarHeight;
      const visibleBottom = Math.min(containerBottom, overlayTopY);
      const mapAreaRect = new DOMRect(
        containerLeft + leftOverlay,
        containerTop,
        Math.max(0, containerWidth - leftOverlay - rightOverlay),
        Math.max(0, visibleBottom - containerTop)
      );

      // Match the renderer's effective scale (zoom * 1.5)
      const currentZoom = (st.ui?.zoom || 1) * 1.5;
      const currentPan = st.ui?.pan || { x: 0, y: 0 };

      // Prefer DOM-based measurement to avoid math drift (especially on Y)
      const nodeEl = (document.querySelector(
        '.mindmap-canvas-container svg g[data-node-id="' + selId + '"]'
      ) as SVGGElement | null);

      // Enforce full visibility: no slack vertically; minimal slack horizontally to reduce jitter
      const slackX = Math.max(20, Math.round(mapAreaRect.width * 0.03));
      const slackY = 0;
      // Nudge a bit more upward so text never peeks under the status bar
      const bottomSafeGap = Math.max(12, Math.round(statusBarHeight * 0.35));
      const leftBound = mapAreaRect.left + slackX;
      const rightBound = mapAreaRect.left + mapAreaRect.width - slackX;
      const topBound = mapAreaRect.top + slackY;
      const bottomBound = mapAreaRect.top + mapAreaRect.height - bottomSafeGap;

      if (nodeEl) {
        const nodeRect = nodeEl.getBoundingClientRect();
        let deltaX = 0;
        let deltaY = 0;
        if (nodeRect.left < leftBound) deltaX = leftBound - nodeRect.left;
        if (nodeRect.right > rightBound) deltaX = rightBound - nodeRect.right;
        if (nodeRect.top < topBound) deltaY = topBound - nodeRect.top;
        if (nodeRect.bottom > bottomBound) deltaY = bottomBound - nodeRect.bottom;

        if (deltaX !== 0 || deltaY !== 0) {
          const setPanLocal = (st.setPan || setPan);
          setPanLocal({
            x: currentPan.x + (deltaX / currentZoom),
            y: currentPan.y + (deltaY / currentZoom)
          });
        }
      } else {
        // Fallback to geometry-based approach
        const fontSize = st.settings?.fontSize ?? 14;
        const wrapConfig = resolveNodeTextWrapConfig(st.settings, fontSize);
        const isEditing = st.editingNodeId === selId;
        const nodeSize = calculateNodeSize(targetNode, undefined, isEditing, fontSize, wrapConfig);
        const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
        const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

        const screenX = containerLeft + currentZoom * (targetNode.x + currentPan.x);
        const screenY = containerTop + currentZoom * (targetNode.y + currentPan.y);

        const isOutsideLeft = (screenX - halfW) < leftBound;
        const isOutsideRight = (screenX + halfW) > rightBound;
        const isOutsideTop = (screenY - halfH) < topBound;
        const isOutsideBottom = (screenY + halfH) > bottomBound;

        if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
          let newPanX = currentPan.x;
          let newPanY = currentPan.y;

          if (isOutsideLeft) {
            const target = leftBound + halfW;
            newPanX = ((target - containerLeft) / currentZoom) - targetNode.x;
          } else if (isOutsideRight) {
            const target = rightBound - halfW;
            newPanX = ((target - containerLeft) / currentZoom) - targetNode.x;
          }

          if (isOutsideTop) {
            const target = topBound + halfH;
            newPanY = ((target - containerTop) / currentZoom) - targetNode.y;
          } else if (isOutsideBottom) {
            const target = bottomBound - halfH;
            newPanY = ((target - containerTop) / currentZoom) - targetNode.y;
          }

          const setPanLocal = (st.setPan || setPan);
          setPanLocal({ x: newPanX, y: newPanY });
        }
      }
    } catch {}
  });

  

  const centerNodeInView = useStableCallback((nodeId: string, _animate = false, fallbackCoords?: { x: number; y: number } | { mode: string }) => {
    if (!data) return;

    const isLeftMode = !!(fallbackCoords && 'mode' in fallbackCoords && fallbackCoords.mode === 'left');
    const isTopLeftMode = !!(fallbackCoords && 'mode' in fallbackCoords && fallbackCoords.mode === 'top-left');

    const rootNodes = data.rootNodes || [];
    const targetNode = rootNodes.length > 0 && rootNodes[0].id === nodeId
      ? rootNodes[0]
      : findNodeInRoots(rootNodes, nodeId);

    // Resolve SVG rect; use it consistently for coordinate transforms
    const containerEl = document.querySelector('.mindmap-canvas-container') as HTMLElement | null;
    const svgEl = containerEl?.querySelector('svg') as SVGSVGElement | null;
    const svgRect = svgEl?.getBoundingClientRect();
    const fallbackRect = new DOMRect(0, 0, viewportService.getSize().width, viewportService.getSize().height);
    const rect = svgRect ?? fallbackRect;

    // Desired screen-space target points and effective scale
    // Match the renderer's effective scale (zoom * 1.5)
    const scale = uiStore.zoom * 1.5;
    const centerScreenX = rect.left + rect.width / 2;
    const centerScreenY = rect.top + rect.height / 2;
    const leftMargin = 150; // zt margin
    const topLeftMargins = { left: 12, top: 8 }; // tree-initial anchor margins
    const leftScreenX = rect.left + leftMargin;

    // Helper to compute pan from a desired screen target and node svg coords
    // CanvasRenderer applies transforms as translate then scale:
    // <g transform={`translate(pan.x, pan.y) scale(scale)`}>
    // So: screen = rect.left/top + (node + pan) * scale
    const computePan = (nodeSvgX: number, nodeSvgY: number, targetScreenX: number, targetScreenY: number) => {
      const panX = (targetScreenX - rect.left) / scale - nodeSvgX;
      const panY = (targetScreenY - rect.top) / scale - nodeSvgY;
      return { x: panX, y: panY };
    };

    if (!targetNode) {
      if (fallbackCoords && 'x' in fallbackCoords && 'y' in fallbackCoords) {
        const nodeX = fallbackCoords.x;
        const nodeY = fallbackCoords.y;
        let targetX = centerScreenX;
        let targetY = centerScreenY;
        if (isLeftMode) {
          targetX = leftScreenX;
          targetY = centerScreenY;
        } else if (isTopLeftMode) {
          targetX = rect.left + topLeftMargins.left; // will be corrected by computePan
          targetY = rect.top + topLeftMargins.top;
        }
        setPan(computePan(nodeX, nodeY, targetX, targetY));
      }
      return;
    }

    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    if (isLeftMode) {
      // zt: left + vertical center for all layouts
      setPan(computePan(nodeX, nodeY, leftScreenX, centerScreenY));
      return;
    }

    if (isTopLeftMode) {
      // Align node's top-left to small margins
      const st = useMindMapStore.getState();
      const fontSize = st.settings?.fontSize ?? 14;
      const wrapConfig = resolveNodeTextWrapConfig(st.settings, fontSize);
      const isEditing = st.editingNodeId === targetNode.id;
      const nodeSize = calculateNodeSize(targetNode, undefined, isEditing, fontSize, wrapConfig);
      const halfW = ((nodeSize?.width ?? 80) / 2);
      const halfH = ((nodeSize?.height ?? 24) / 2);

      const targetX = rect.left + topLeftMargins.left + halfW * scale;
      const targetY = rect.top + topLeftMargins.top + halfH * scale;
      setPan(computePan(nodeX, nodeY, targetX, targetY));
      return;
    }

    // Full center
    setPan(computePan(nodeX, nodeY, centerScreenX, centerScreenY));
  });

  return {
    ensureSelectedNodeVisible,
    centerNodeInView,
  };
}
