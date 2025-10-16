import { findNodeInRoots, calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';
import { viewportService } from '@/app/core/services';
import { useMindMapStore } from '../store';
import type { MindMapNode } from '@shared/types';
import { useStableCallback } from '@shared/hooks';

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

 


export function useMindMapViewport({
  data,
  activeView,
  uiStore,
  settings: _settings,
  setPan,
}: ViewportOperationsParams) {

  
  const ensureSelectedNodeVisible = useStableCallback(() => {
    try {
      const st = useMindMapStore.getState();
      const selId: string | null = st.selectedNodeId || null;
      const mapData = st.data || null;
      if (!selId || !mapData) return;
      const roots = mapData.rootNodes || [];
      const targetNode = findNodeInRoots(roots, selId);
      if (!targetNode) return;

      
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

        
        
        if (currentActiveView && !currentSidebarCollapsed && offsetX === 0) {
          
          const ACTIVITY_BAR_WIDTH = 48;
          const sidebarPanel = document.querySelector('.mindmap-sidebar');
          let sidebarWidth = 0;
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              sidebarWidth = sidebarRect.width;
            } catch {}
          } else {
            sidebarWidth = 280; 
          }
          const totalLeftOffset = ACTIVITY_BAR_WIDTH + sidebarWidth;
          offsetX = totalLeftOffset;
        }
      } else {
        
        const ACTIVITY_BAR_WIDTH = 48;
        const SIDEBAR_WIDTH = 280; 
        let leftPanelWidth = ACTIVITY_BAR_WIDTH;

        if (currentActiveView && !currentSidebarCollapsed) {
          
          const sidebarPanel = document.querySelector('.mindmap-sidebar');
          if (sidebarPanel) {
            try {
              const sidebarRect = sidebarPanel.getBoundingClientRect();
              leftPanelWidth += sidebarRect.width;
            } catch {}
          } else {
            
            leftPanelWidth += SIDEBAR_WIDTH;
          }
        }

        effectiveWidth -= leftPanelWidth;
        offsetX = leftPanelWidth;

        
        const markdownPanel = document.querySelector('.markdown-panel');
        if (markdownPanel) {
          try {
            const pr = markdownPanel.getBoundingClientRect();
            effectiveWidth -= pr.width;
          } catch {}
        } else if (currentUI.showNotesPanel && currentUI.markdownPanelWidth) {
          
          const w = Math.max(0, currentUI.markdownPanelWidth);
          effectiveWidth -= w;
        }
      }

      
      
      try {
        const notePanel = document.querySelector('.selected-node-note-panel');
        const noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
        effectiveHeight -= noteH;
      } catch {}
      
      effectiveHeight -= 24;

      const currentZoom = (st.ui?.zoom || 1) * 1.5;
      const currentPan = st.ui?.pan || { x: 0, y: 0 };


      const fontSize = st.settings?.fontSize ?? 14;
      const wrapConfig = resolveNodeTextWrapConfig(st.settings, fontSize);
      const nodeSize = calculateNodeSize(targetNode, undefined, false, fontSize, wrapConfig);
      const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
      const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

      
      const screenX = currentZoom * (targetNode.x + currentPan.x) - offsetX;
      const screenY = currentZoom * (targetNode.y + currentPan.y) - offsetY;

      const margin = 0;
      const topMargin = 0; 
      const bottomExtra = (function() {
        
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
          
          newPanX = ((leftBound + offsetX + halfW) / currentZoom) - targetNode.x;
        } else if (isOutsideRight) {
          
          newPanX = ((rightBound + offsetX - halfW) / currentZoom) - targetNode.x;
        }

        if (isOutsideTop) {
          
          newPanY = ((topBound + offsetY + halfH) / currentZoom) - targetNode.y;
        } else if (isOutsideBottom) {
          
          newPanY = ((bottomBound + offsetY - halfH) / currentZoom) - targetNode.y;
        }

        const setPanLocal = (st.setPan || setPan);
        setPanLocal({ x: newPanX, y: newPanY });
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

    
    const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();

    
    const ACTIVITY_BAR_WIDTH = 48;
    const SIDEBAR_WIDTH = 280;
    const leftPanelWidth = ACTIVITY_BAR_WIDTH + (activeView && !uiStore.sidebarCollapsed ? SIDEBAR_WIDTH : 0);

    
    const rightPanelWidth = uiStore.showNotesPanel ? (uiStore.markdownPanelWidth || 0) : 0;

    
    const VIM_HEIGHT = 24;
    const defaultNoteHeight = viewportService.getDefaultNoteHeight();
    let noteHeight = 0;
    if (uiStore.showNodeNotePanel) {
      const h = uiStore.nodeNotePanelHeight || 0;
      noteHeight = h > 0 ? h : defaultNoteHeight;
    }

    
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

        const nodeX = fallbackCoords.x;
        const nodeY = fallbackCoords.y;

        // Position at left edge (X) and center (Y), or fully centered
        const leftMarginFromMapArea = 150;
        const targetX = isLeftMode
          ? mapAreaRect.left + leftMarginFromMapArea  // Left edge of map area + margin
          : mapAreaRect.left + (mapAreaRect.width / 2);
        const targetY = isLeftMode
          ? mapAreaRect.top + (mapAreaRect.height / 2)   // Vertical center
          : mapAreaRect.top + (mapAreaRect.height / 2);
        const currentZoom = uiStore.zoom * 1.5;

        const newPanX = targetX / currentZoom - nodeX;
        const newPanY = targetY / currentZoom - nodeY;

        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    
    const currentZoom = uiStore.zoom * 1.5;


    if (isLeftMode) {
      // Position node at the left edge (X) and center (Y), accounting for sidebar
      const leftMarginFromMapArea = 150;  // Margin within the map area
      // mapAreaRect.left already accounts for sidebars, so add margin from there
      const targetX = mapAreaRect.left + leftMarginFromMapArea;
      const targetY = mapAreaRect.top + (mapAreaRect.height / 2);  // Vertical center
      const newPanX = targetX / currentZoom - nodeX;
      const newPanY = targetY / currentZoom - nodeY;
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    
    const targetX = mapAreaRect.left + (mapAreaRect.width / 2);
    const targetY = mapAreaRect.top + (mapAreaRect.height / 2);
    const newPanX = targetX / currentZoom - nodeX;
    const newPanY = targetY / currentZoom - nodeY;
    setPan({ x: newPanX, y: newPanY });
  });

  return {
    ensureSelectedNodeVisible,
    centerNodeInView,
  };
}
