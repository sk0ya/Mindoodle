import type { MindMapNode } from '@shared/types';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '@mindmap/store';
import { findNodeInRoots, calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';

export interface EnsureVisibleUI {
  zoom: number;
  pan: { x: number; y: number };
  sidebarCollapsed?: boolean;
  showNotesPanel?: boolean;
  markdownPanelWidth?: number;
  showNodeNotePanel?: boolean;
  nodeNotePanelHeight?: number;
}

interface ViewportDimensions {
  effectiveWidth: number;
  effectiveHeight: number;
  offsetX: number;
  offsetY: number;
}

function calculateViewportDimensions(): ViewportDimensions {
  const mindmapContainer = document.querySelector('.mindmap-canvas-container') ||
                           document.querySelector('.workspace-container') ||
                           document.querySelector('.mindmap-app');

  let { width: effectiveWidth, height: effectiveHeight } = viewportService.getSize();
  let offsetX = 0;
  let offsetY = 0;

  if (mindmapContainer) {
    const rect = (mindmapContainer as HTMLElement).getBoundingClientRect();
    effectiveWidth = rect.width;
    effectiveHeight = rect.height;
    offsetX = rect.left;
    offsetY = rect.top;
  } else {
    const sidebar = document.querySelector('.primary-sidebar');
    if (sidebar) {
      const r = (sidebar as HTMLElement).getBoundingClientRect();
      effectiveWidth -= r.width;
      offsetX = r.width;
    }
    const md = document.querySelector('.markdown-panel');
    if (md) {
      const r = (md as HTMLElement).getBoundingClientRect();
      effectiveWidth -= r.width;
    }
  }

  let noteH = 0;
  try {
    const notePanel = document.querySelector('.selected-node-note-panel');
    noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
    effectiveHeight -= noteH;
  } catch {}
  effectiveHeight -= 24;
  const bottomExtra = noteH === 0 ? 6 : 0;
  effectiveHeight -= bottomExtra;

  return { effectiveWidth, effectiveHeight, offsetX, offsetY };
}

function calculateNewPan(
  node: MindMapNode,
  currentPan: { x: number; y: number },
  currentZoom: number,
  baseHalfW: number,
  baseHalfH: number,
  halfW: number,
  halfH: number,
  viewport: ViewportDimensions
): { x: number; y: number } {
  // Transform: screen = (nodeSvg + pan) * zoom + offset
  // Node center in SVG coordinates (based on actual node position, not adjusted size)
  const nodeCenterX = node.x + baseHalfW;
  const nodeCenterY = node.y + baseHalfH;

  // Node center in screen coordinates (relative to viewport)
  const screenCenterX = (nodeCenterX + currentPan.x) * currentZoom;
  const screenCenterY = (nodeCenterY + currentPan.y) * currentZoom;

  // Node bounds in screen coordinates (apply zoom to half-sizes)
  const screenHalfW = halfW * currentZoom;
  const screenHalfH = halfH * currentZoom;
  const screenLeft = screenCenterX - screenHalfW;
  const screenRight = screenCenterX + screenHalfW;
  const screenTop = screenCenterY - screenHalfH;
  const screenBottom = screenCenterY + screenHalfH;

  // Check if node is outside visible area
  const isOutsideLeft = screenLeft < 0;
  const isOutsideRight = screenRight > viewport.effectiveWidth;
  const isOutsideTop = screenTop < 0;
  const isOutsideBottom = screenBottom > viewport.effectiveHeight;

  if (!isOutsideLeft && !isOutsideRight && !isOutsideTop && !isOutsideBottom) {
    return currentPan;
  }

  // Calculate delta in screen space
  let deltaX = 0;
  let deltaY = 0;

  if (isOutsideLeft) {
    deltaX = 0 - screenLeft;
  } else if (isOutsideRight) {
    deltaX = viewport.effectiveWidth - screenRight;
  }

  if (isOutsideTop) {
    deltaY = 0 - screenTop;
  } else if (isOutsideBottom) {
    deltaY = viewport.effectiveHeight - screenBottom;
  }

  // Convert delta to SVG space and apply to pan
  return {
    x: currentPan.x + (deltaX / currentZoom),
    y: currentPan.y + (deltaY / currentZoom)
  };
}

export function ensureVisible(nodeId: string, ui: EnsureVisibleUI, setPan: (pan: { x: number; y: number }) => void, roots?: MindMapNode[]): void {
  const rootNodes = roots ?? (useMindMapStore as unknown as { getState?: () => { data?: { rootNodes?: MindMapNode[] } } }).getState?.().data?.rootNodes ?? [];
  const node = findNodeInRoots(rootNodes, nodeId);
  if (!node) return;

  const viewport = calculateViewportDimensions();

  const currentZoom = (ui.zoom ?? 1) * 1.5;
  const currentPan = ui.pan ?? { x: 0, y: 0 };

  const storeState = (useMindMapStore as unknown as { getState?: () => { settings?: { fontSize?: number; nodeTextWrapEnabled?: boolean; nodeTextWrapWidth?: number } } }).getState?.();
  const fontSize = storeState?.settings?.fontSize ?? 14;
  const wrapConfig = resolveNodeTextWrapConfig(storeState?.settings as { nodeTextWrapEnabled?: boolean; nodeTextWrapWidth?: number } | undefined, fontSize);
  const nodeSize = calculateNodeSize(node, undefined, false, fontSize, wrapConfig);
  // Keep node size in SVG coordinates (don't apply zoom here)
  const baseHalfW = (nodeSize?.width ?? 80) / 2;
  const baseHalfH = (nodeSize?.height ?? 24) / 2;

  // Add safety margin to account for borders, shadows, and visual effects
  const VISUAL_MARGIN = 12; // px margin for border, shadow, selection indicators
  const halfW = baseHalfW + VISUAL_MARGIN / 2;
  const halfH = baseHalfH + VISUAL_MARGIN / 2;

  const newPan = calculateNewPan(node, currentPan, currentZoom, baseHalfW, baseHalfH, halfW, halfH, viewport);

  if (newPan.x !== currentPan.x || newPan.y !== currentPan.y) {
    setPan(newPan);
  }
}
