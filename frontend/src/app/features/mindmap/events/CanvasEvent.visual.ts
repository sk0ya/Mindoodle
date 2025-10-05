import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class VisualModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    // Visual mode: treat like normal for bgclick/contextmenu for now
    if (event.type === 'bgclick') {
      try {
        const store = useMindMapStore.getState() as any;
        store.closeAttachmentAndLinkLists?.();
        store.selectNode?.(null);
        store.setShowContextMenu?.(false);
      } catch { /* ignore */ }
      return;
    }
    if (event.type === 'contextmenu') {
      try {
        const store = useMindMapStore.getState();
        store.setContextMenuPosition({ x: event.x, y: event.y });
        (store as any).openPanel?.('contextMenu');
      } catch { /* ignore */ }
    }

    if (event.type === 'nodeContextMenu' && event.targetNodeId) {
      try {
        const store = useMindMapStore.getState() as any;
        store.selectNode?.(event.targetNodeId);
        store.setContextMenuPosition?.({ x: event.x, y: event.y });
        store.openPanel?.('contextMenu');
      } catch { /* ignore */ }
      return;
    }

    if (event.type === 'nodeClick' && event.targetNodeId) {
      try {
        const store = useMindMapStore.getState() as any;
        store.selectNode?.(event.targetNodeId);
      } catch { /* ignore */ }
      return;
    }

    if (event.type === 'nodeDragEnd' && event.targetNodeId && event.draggedNodeId && event.dropPosition) {
      try {
        const store = useMindMapStore.getState() as any;
        store.moveNodeWithPosition?.(event.draggedNodeId, event.targetNodeId, event.dropPosition);
      } catch { /* ignore */ }
      return;
    }
  }
}
