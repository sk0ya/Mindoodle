import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { getStoreState } from '@mindmap/hooks/useStoreSelectors';
import type { MindMapStore } from '@mindmap/store';
import * as panelManager from '@mindmap/state/panelManager';

export class NormalModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    if (event.type === 'bgclick') {
      try {
        const store = getStoreState();
        store.selectNode?.(null);
        store.setShowContextMenu?.(false);
      } catch (e) { console.warn('CanvasEvent.normal: bgclick handler error', e); }
      return;
    }
    if (event.type === 'contextmenu') {
      try {
        const store: MindMapStore = getStoreState();
        const ui = store.ui;
        const canOpen = panelManager.canOpen(ui.openPanels, 'contextMenu', { exclusiveWith: ['linkList'] });
        if (!canOpen) return;
        store.setContextMenuPosition({ x: event.x, y: event.y });
        store.openPanel?.('contextMenu');
      } catch (e) { console.warn('CanvasEvent.normal: contextmenu handler error', e); }
    }

    if (event.type === 'nodeContextMenu' && event.targetNodeId) {
      try {
        const store = getStoreState();
        const ui = store.ui;
        const canOpen = panelManager.canOpen(ui.openPanels, 'contextMenu', { exclusiveWith: ['linkList'] });
        if (!canOpen) return;
        store.selectNode?.(event.targetNodeId);
        store.setContextMenuPosition?.({ x: event.x, y: event.y });
        store.openPanel?.('contextMenu');
      } catch (e) { console.warn('CanvasEvent.normal: nodeContextMenu handler error', e); }
      return;
    }

    if (event.type === 'nodeClick' && event.targetNodeId) {
      try {
        const store = getStoreState();
        store.selectNode?.(event.targetNodeId);
      } catch (e) { console.warn('CanvasEvent.normal: nodeClick handler error', e); }
      return;
    }

    if (event.type === 'nodeDoubleClick' && event.targetNodeId) {
      try {
        const st = getStoreState();
        const node = st.normalizedData?.nodes?.[event.targetNodeId] || null;
        if (node && (node.kind ?? 'text') !== 'table') {
          st.startEditing?.(event.targetNodeId);
        }
      } catch (e) { console.warn('CanvasEvent.normal: nodeDoubleClick handler error', e); }
      return;
    }

    if (event.type === 'nodeDragEnd' && event.targetNodeId && event.draggedNodeId && event.dropPosition) {
      try {
        const store = getStoreState();
        store.moveNodeWithPosition?.(event.draggedNodeId, event.targetNodeId, event.dropPosition);
      } catch (e) { console.warn('CanvasEvent.normal: nodeDragEnd handler error', e); }
    }
  }
}
