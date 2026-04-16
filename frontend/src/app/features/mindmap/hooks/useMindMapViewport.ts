import { findNodeInRoots, calculateNodeSize, getCanvasScale, resolveNodeTextWrapConfig } from '@mindmap/utils';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '../store';
import type { MindMapNode } from '@shared/types';
import { useStableCallback } from '@shared/hooks';
import { useEffect, useRef } from 'react';
import { mindMapEvents } from '@core/streams';
import {
  LAYOUT_AUTO_PAN_SUPPRESSION_MS,
  type EnsureSelectedNodeVisibleOptions,
  type EnsureSelectedNodeVisibleResult
} from './viewportAutoPanTiming';

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

type ScreenBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const calculateVisibilityPanDelta = (
  rect: ScreenBounds,
  visibleBounds: ScreenBounds,
  targetBounds: ScreenBounds,
  options?: Pick<EnsureSelectedNodeVisibleOptions, 'preventDownwardPan'>
): { x: number; y: number } => {
  let deltaX = 0;
  let deltaY = 0;

  if (rect.left < visibleBounds.left) {
    deltaX = targetBounds.left - rect.left;
  } else if (rect.right > visibleBounds.right) {
    deltaX = targetBounds.right - rect.right;
  }

  if (rect.top < visibleBounds.top) {
    deltaY = targetBounds.top - rect.top;
  } else if (rect.bottom > visibleBounds.bottom) {
    deltaY = targetBounds.bottom - rect.bottom;
  }

  if (options?.preventDownwardPan && deltaY > 0) {
    deltaY = 0;
  }

  return { x: deltaX, y: deltaY };
};

const getVisibleNodeElement = (nodeGroup: Element): Element => (
  nodeGroup.querySelector('rect[role="button"]') ?? nodeGroup
);



export function useMindMapViewport({
  data,
  uiStore,
  settings: _settings,
  setPan,
}: ViewportOperationsParams) {

  
  // Suppress auto-pan immediately after layout application to avoid unexpected jumps
  const suppressAutoPanUntilRef = useRef<number>(0);
  useEffect(() => {
    const unsubscribe = mindMapEvents.subscribe((event) => {
      if (event.type === 'layout.applied') {
        suppressAutoPanUntilRef.current = performance.now() + LAYOUT_AUTO_PAN_SUPPRESSION_MS;
      }
    });
    return () => unsubscribe();
  }, []);

  const ensureSelectedNodeVisible = useStableCallback((options?: EnsureSelectedNodeVisibleOptions): EnsureSelectedNodeVisibleResult => {
    // Skip adjustments during suppression window unless forced (keyboard nav)
    if (!options?.force && performance.now() < suppressAutoPanUntilRef.current) return 'suppressed';
    try {
      const st = useMindMapStore.getState();
      const selId: string | null = st.selectedNodeId || null;
      const mapData = st.data || null;
      if (!selId || !mapData) return;
      const roots = mapData.rootNodes || [];
      const targetNode = findNodeInRoots(roots, selId);
      if (!targetNode) return;

      // Base container rect and inner SVG border/padding
      const containerEl = document.querySelector('.mindmap-canvas-container');
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
        const vimBar = document.querySelector('.vim-status-bar');
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

      // Match the renderer's effective scale.
      const currentZoom = getCanvasScale(st.ui?.zoom || 1);
      const currentPan = st.ui?.pan || { x: 0, y: 0 };

      // Prefer DOM-based measurement to avoid math drift (especially on Y)
      const nodeEl = (document.querySelector(
        '.mindmap-canvas-container svg g[data-node-id="' + selId + '"]'
      ));

      // Enforce full visibility with sufficient margins for node borders, shadows, and visual elements
      // Horizontal slack: enough to accommodate selection borders and any visual effects
      const slackX = Math.max(40, Math.round(mapAreaRect.width * 0.04));
      // Vertical slack: account for node shadows and selection indicators
      const slackY = 16;
      // Nudge a bit more upward so text never peeks under the status bar
      const bottomSafeGap = Math.max(20, Math.round(statusBarHeight * 0.5));
      const leftBound = mapAreaRect.left + slackX;
      const rightBound = mapAreaRect.left + mapAreaRect.width - slackX;
      const topBound = mapAreaRect.top + slackY;
      const bottomBound = mapAreaRect.top + mapAreaRect.height - bottomSafeGap;
      const visibleBounds: ScreenBounds = {
        left: mapAreaRect.left,
        right: mapAreaRect.left + mapAreaRect.width,
        top: mapAreaRect.top,
        bottom: mapAreaRect.top + mapAreaRect.height
      };
      const targetBounds: ScreenBounds = {
        left: leftBound,
        right: rightBound,
        top: topBound,
        bottom: bottomBound
      };

      if (nodeEl) {
        const nodeRect = getVisibleNodeElement(nodeEl).getBoundingClientRect();
        const { x: deltaX, y: deltaY } = calculateVisibilityPanDelta(
          nodeRect,
          visibleBounds,
          targetBounds,
          options
        );

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
        // Keep node size in SVG coordinates (don't apply zoom yet)
        const baseHalfW = (nodeSize?.width ?? 80) / 2;
        const baseHalfH = (nodeSize?.height ?? 24) / 2;

        // Add safety margin to account for borders, shadows, and visual effects
        // that aren't included in calculateNodeSize
        const VISUAL_MARGIN = 12; // px margin for border, shadow, selection indicators
        const halfW = baseHalfW + VISUAL_MARGIN / 2;
        const halfH = baseHalfH + VISUAL_MARGIN / 2;

        // Transform: screen = containerOffset + (nodeSvg + pan) * zoom
        // node.x/y are already center coordinates in this codebase.
        const nodeCenterX = targetNode.x;
        const nodeCenterY = targetNode.y;

        // Node center in screen coordinates
        const screenCenterX = containerLeft + (nodeCenterX + currentPan.x) * currentZoom;
        const screenCenterY = containerTop + (nodeCenterY + currentPan.y) * currentZoom;

        // Node bounds in screen coordinates
        const screenHalfW = halfW * currentZoom;
        const screenHalfH = halfH * currentZoom;
        const screenLeft = screenCenterX - screenHalfW;
        const screenRight = screenCenterX + screenHalfW;
        const screenTop = screenCenterY - screenHalfH;
        const screenBottom = screenCenterY + screenHalfH;
        const baseScreenHalfW = baseHalfW * currentZoom;
        const baseScreenHalfH = baseHalfH * currentZoom;
        const visibleRect = {
          left: screenCenterX - baseScreenHalfW,
          right: screenCenterX + baseScreenHalfW,
          top: screenCenterY - baseScreenHalfH,
          bottom: screenCenterY + baseScreenHalfH
        };
        const targetRect = {
          left: screenLeft,
          right: screenRight,
          top: screenTop,
          bottom: screenBottom
        };
        const { x: deltaX, y: deltaY } = calculateVisibilityPanDelta(
          visibleRect,
          visibleBounds,
          targetBounds,
          options
        );

        if (deltaX !== 0 || deltaY !== 0) {
          const adjustedDeltaX = deltaX === 0
            ? 0
            : calculateVisibilityPanDelta(targetRect, visibleBounds, targetBounds).x;
          const adjustedDeltaY = deltaY === 0
            ? 0
            : calculateVisibilityPanDelta(targetRect, visibleBounds, targetBounds, options).y;

          const setPanLocal = (st.setPan || setPan);
          setPanLocal({
            x: currentPan.x + (adjustedDeltaX / currentZoom),
            y: currentPan.y + (adjustedDeltaY / currentZoom)
          });
        }
      }
    } catch {}
  });



  const centerNodeInView = useStableCallback((
    nodeId: string,
    _animate = false,
    mode: 'center' | 'left' | 'top-left' = 'center'
  ) => {
    if (!data) return;

    const isLeftMode = mode === 'left';
    const isTopLeftMode = mode === 'top-left';

    const rootNodes = data.rootNodes || [];
    const targetNode = rootNodes.length > 0 && rootNodes[0].id === nodeId
      ? rootNodes[0]
      : findNodeInRoots(rootNodes, nodeId);

    if (!targetNode) {
      return;
    }

    // Resolve SVG rect and account for borders (like ensureSelectedNodeVisible)
    const containerEl = document.querySelector('.mindmap-canvas-container');
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

    // Desired screen-space target points and effective scale
    // Match the renderer's effective scale.
    const scale = getCanvasScale(uiStore.zoom);
    const centerScreenX = containerLeft + containerWidth / 2;
    const centerScreenY = containerTop + containerHeight / 2;
    const leftMargin = 150; // zt margin
    const topLeftMargins = { left: 12, top: 8 }; // tree-initial anchor margins
    const leftScreenX = containerLeft + leftMargin;

    // Helper to compute pan from a desired screen target and node svg coords
    // CanvasRenderer applies transforms as scale then translate:
    // <g transform={`scale(scale) translate(pan.x, pan.y)`}>
    // So: screen = containerLeft/Top + (node + pan) * scale
    const computePan = (nodeSvgX: number, nodeSvgY: number, targetScreenX: number, targetScreenY: number) => {
      const panX = (targetScreenX - containerLeft) / scale - nodeSvgX;
      const panY = (targetScreenY - containerTop) / scale - nodeSvgY;
      return { x: panX, y: panY };
    };

    const nodeCenterX = targetNode.x || 0;
    const nodeCenterY = targetNode.y || 0;

    if (isLeftMode) {
      // zt: left + vertical center for all layouts
      // Position node center at left margin + vertical center
      const targetX = leftScreenX;
      const targetY = centerScreenY;
      setPan(computePan(nodeCenterX, nodeCenterY, targetX, targetY));
      return;
    }

    if (isTopLeftMode) {
      const st = useMindMapStore.getState();
      const fontSize = st.settings?.fontSize ?? 14;
      const wrapConfig = resolveNodeTextWrapConfig(st.settings, fontSize);
      const isEditing = st.editingNodeId === targetNode.id;
      const nodeSize = calculateNodeSize(targetNode, undefined, isEditing, fontSize, wrapConfig);
      const halfW = ((nodeSize?.width ?? 80) / 2);
      const halfH = ((nodeSize?.height ?? 24) / 2);

      // Align node's top-left to small margins
      // targetX/Y should point to where we want the node center to be
      const targetX = containerLeft + topLeftMargins.left + halfW * scale;
      const targetY = containerTop + topLeftMargins.top + halfH * scale;
      setPan(computePan(nodeCenterX, nodeCenterY, targetX, targetY));
      return;
    }

    // Full center (zz): prefer visual bounds center from DOM so decorative
    // elements (toggle button, selection outline, rich content) are centered too.
    const nodeEl = containerEl?.querySelector(
      `svg g[data-node-id="${nodeId}"]`
    ) as SVGGElement | null;

    if (nodeEl) {
      // Apply small iterative corrections so a single zz converges to visual center
      // even when transform math and visual bounds don't perfectly match.
      const applyVisualCenterCorrection = (remaining: number) => {
        const currentNodeEl = containerEl?.querySelector(
          `svg g[data-node-id="${nodeId}"]`
        ) as SVGGElement | null;
        if (!currentNodeEl) return;

        const nodeRect = currentNodeEl.getBoundingClientRect();
        const visualCenterX = nodeRect.left + nodeRect.width / 2;
        const visualCenterY = nodeRect.top + nodeRect.height / 2;
        const deltaX = centerScreenX - visualCenterX;
        const deltaY = centerScreenY - visualCenterY;

        if (Math.abs(deltaX) <= 0.5 && Math.abs(deltaY) <= 0.5) return;

        // Use latest pan from store to avoid stale closure updates.
        const st = useMindMapStore.getState();
        const currentPan = st.ui?.pan ?? { x: 0, y: 0 };
        st.setPan({
          x: currentPan.x + (deltaX / scale),
          y: currentPan.y + (deltaY / scale)
        });

        if (remaining > 0) {
          requestAnimationFrame(() => applyVisualCenterCorrection(remaining - 1));
        }
      };

      // 1回のzzで視覚中心に到達させるため、複数フレームで収束させる。
      // (連打不要)
      applyVisualCenterCorrection(8);
      return;
    }

    // Fallback: center by logical node center if DOM measurement is unavailable.
    setPan(computePan(nodeCenterX, nodeCenterY, centerScreenX, centerScreenY));
  });

  return {
    ensureSelectedNodeVisible,
    centerNodeInView,
  };
}
