import type { MindMapNode } from '@shared/types';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '@mindmap/store';
import { findNodeInRoots } from '@mindmap/utils';
import { calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';

export interface EnsureVisibleUI {
  zoom: number;
  pan: { x: number; y: number };
  sidebarCollapsed?: boolean;
  showNotesPanel?: boolean;
  markdownPanelWidth?: number;
  showNodeNotePanel?: boolean;
  nodeNotePanelHeight?: number;
}

export function ensureVisible(nodeId: string, ui: EnsureVisibleUI, setPan: (pan: { x: number; y: number }) => void, roots?: MindMapNode[]): void {
  const rootNodes = roots ?? (useMindMapStore as any).getState?.().data?.rootNodes ?? [];
  const node = findNodeInRoots(rootNodes, nodeId);
  if (!node) return;

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
    const notePanel = document.querySelector('.selected-node-note-panel') as HTMLElement | null;
    noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
    effectiveHeight -= noteH;
  } catch {}
  effectiveHeight -= 24;
  const bottomExtra = noteH === 0 ? 6 : 0;
  effectiveHeight -= bottomExtra;

  const currentZoom = (ui.zoom ?? 1) * 1.5;
  const currentPan = ui.pan ?? { x: 0, y: 0 };

  const storeState = (useMindMapStore as any).getState?.();
  const fontSize = storeState?.settings?.fontSize ?? 14;
  const wrapConfig = resolveNodeTextWrapConfig(storeState?.settings, fontSize);
  const nodeSize = calculateNodeSize(node as any, undefined as any, false, fontSize, wrapConfig);
  const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
  const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

  const screenX = currentZoom * (node.x + currentPan.x) - offsetX;
  const screenY = currentZoom * (node.y + currentPan.y) - offsetY;

  const leftBound = 0;
  const rightBound = effectiveWidth;
  const topBound = 0;
  const bottomBound = effectiveHeight;

  const isOutsideLeft = (screenX - halfW) < leftBound;
  const isOutsideRight = (screenX + halfW) > rightBound;
  const isOutsideTop = (screenY - halfH) < topBound;
  const isOutsideBottom = (screenY + halfH) > bottomBound;

  if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
    let newPanX = currentPan.x;
    let newPanY = currentPan.y;

    if (isOutsideLeft) {
      newPanX = ((leftBound + offsetX + halfW) / currentZoom) - node.x;
    } else if (isOutsideRight) {
      newPanX = ((rightBound + offsetX - halfW) / currentZoom) - node.x;
    }

    if (isOutsideTop) {
      newPanY = ((topBound + offsetY + halfH) / currentZoom) - node.y;
    } else if (isOutsideBottom) {
      newPanY = ((bottomBound + offsetY - halfH) / currentZoom) - node.y;
    }

    setPan({ x: newPanX, y: newPanY });
  }
}

