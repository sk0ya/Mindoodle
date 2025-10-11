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
  halfW: number,
  halfH: number,
  viewport: ViewportDimensions
): { x: number; y: number } {
  const screenX = currentZoom * (node.x + currentPan.x) - viewport.offsetX;
  const screenY = currentZoom * (node.y + currentPan.y) - viewport.offsetY;

  const isOutsideLeft = (screenX - halfW) < 0;
  const isOutsideRight = (screenX + halfW) > viewport.effectiveWidth;
  const isOutsideTop = (screenY - halfH) < 0;
  const isOutsideBottom = (screenY + halfH) > viewport.effectiveHeight;

  if (!isOutsideLeft && !isOutsideRight && !isOutsideTop && !isOutsideBottom) {
    return currentPan;
  }

  let newPanX = currentPan.x;
  let newPanY = currentPan.y;

  if (isOutsideLeft) {
    newPanX = ((viewport.offsetX + halfW) / currentZoom) - node.x;
  } else if (isOutsideRight) {
    newPanX = ((viewport.effectiveWidth + viewport.offsetX - halfW) / currentZoom) - node.x;
  }

  if (isOutsideTop) {
    newPanY = ((viewport.offsetY + halfH) / currentZoom) - node.y;
  } else if (isOutsideBottom) {
    newPanY = ((viewport.effectiveHeight + viewport.offsetY - halfH) / currentZoom) - node.y;
  }

  return { x: newPanX, y: newPanY };
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
  const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
  const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

  const newPan = calculateNewPan(node, currentPan, currentZoom, halfW, halfH, viewport);

  if (newPan.x !== currentPan.x || newPan.y !== currentPan.y) {
    setPan(newPan);
  }
}
