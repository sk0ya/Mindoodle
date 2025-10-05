import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class InsertModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    if (event.type === 'bgclick') {
      // In insert mode, do not change selection; just ensure menus are closed
      try {
        const store = useMindMapStore.getState() as any;
        store.setShowContextMenu?.(false);
      } catch { /* ignore */ }
      return;
    }
    // In insert mode, suppress context menu
    if (event.type === 'contextmenu') {
      try {
        const store = useMindMapStore.getState();
        (store as any).closePanel?.('contextMenu');
        store.setShowContextMenu(false);
      } catch { /* ignore */ }
    }

    if (event.type === 'nodeClick' && event.targetNodeId) {
      try {
        const store = useMindMapStore.getState() as any;
        store.selectNode?.(event.targetNodeId);
      } catch { /* ignore */ }
      return;
    }
  }
}
