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

    const isLeftMode = fallbackCoords && 'mode' in fallbackCoords && fallbackCoords.mode === 'left';

    
    const rootNodes = data.rootNodes || [];
    const targetNode = rootNodes.length > 0 && rootNodes[0].id === nodeId
      ? rootNodes[0]
      : findNodeInRoots(rootNodes, nodeId);

    
    // Use container and inner SVG borders for accurate positioning
    const containerEl = document.querySelector('.mindmap-canvas-container') as HTMLElement | null;
    const containerRect = containerEl?.getBoundingClientRect();
    const svgEl = containerEl?.querySelector('svg') as SVGSVGElement | null;
    const svgStyles = svgEl ? getComputedStyle(svgEl) : null;
    const svgBorderLeft = svgStyles ? parseFloat(svgStyles.borderLeftWidth || '0') || 0 : 0;
    const svgBorderTop = svgStyles ? parseFloat(svgStyles.borderTopWidth || '0') || 0 : 0;
    const svgBorderRight = svgStyles ? parseFloat(svgStyles.borderRightWidth || '0') || 0 : 0;
    const svgBorderBottom = svgStyles ? parseFloat(svgStyles.borderBottomWidth || '0') || 0 : 0;
    // Prefer the SVG rect for precise content box and center calculations
    const svgRect = svgEl?.getBoundingClientRect();
    const containerLeft = ((svgRect?.left ?? containerRect?.left ?? 0) + svgBorderLeft);
    const containerTop = ((svgRect?.top ?? containerRect?.top ?? 0) + svgBorderTop);
    const rawContainerWidth = (svgRect?.width ?? containerRect?.width ?? viewportService.getSize().width);
    const rawContainerHeight = (svgRect?.height ?? containerRect?.height ?? viewportService.getSize().height);
    const containerWidth = Math.max(0, rawContainerWidth - svgBorderLeft - svgBorderRight);
    const containerHeight = Math.max(0, rawContainerHeight - svgBorderTop - svgBorderBottom);

    // For centering, use the visual center of the SVG content box directly
    const mapAreaRect = new DOMRect(
      containerLeft,
      containerTop,
      containerWidth,
      containerHeight
    );

    if (!targetNode) {
      if (fallbackCoords && 'x' in fallbackCoords && 'y' in fallbackCoords) {

        const nodeX = fallbackCoords.x;
        const nodeY = fallbackCoords.y;

        // Position at left edge (X) and center (Y), or fully centered
        const leftMarginFromMapArea = 150;
        const targetX = isLeftMode
          ? mapAreaRect.left + leftMarginFromMapArea  // Left edge of map area + margin
          : mapAreaRect.left + (mapAreaRect.width / 2);
        // Always center vertically regardless of mode
        const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
        const currentZoom = uiStore.zoom * 1.5;

        // Convert from screen coordinates to SVG coordinates by removing container offset
        const newPanX = ((targetX - containerLeft) / currentZoom) - nodeX;
        const newPanY = ((targetY - containerTop) / currentZoom) - nodeY;

        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    
    const currentZoom = uiStore.zoom * 1.5;


    if (isLeftMode) {
      // Position node at the left edge (X) and vertical center of the SVG content box
      const leftMarginFromMapArea = 150;
      const targetX = mapAreaRect.left + leftMarginFromMapArea;
      const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
      // Translate screen-space target to SVG-space pan using container offsets
      const newPanX = ((targetX - containerLeft) / currentZoom) - nodeX;
      const newPanY = ((targetY - containerTop) / currentZoom) - nodeY;
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    // Full center of the SVG content box
    const targetX = mapAreaRect.left + (mapAreaRect.width / 2);
    const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
    // Convert from screen coordinates to SVG coordinates by removing container offset
    const newPanX = ((targetX - containerLeft) / currentZoom) - nodeX;
    const newPanY = ((targetY - containerTop) / currentZoom) - nodeY;
    setPan({ x: newPanX, y: newPanY });
  });

  return {
    ensureSelectedNodeVisible,
    centerNodeInView,
  };
}
