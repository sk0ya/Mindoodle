import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class InsertModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    if (event.type === 'bgclick') {
      
      try {
        const store = useMindMapStore.getState() as any;
        store.setShowContextMenu?.(false);
      } catch {  }
      return;
    }
    
    if (event.type === 'contextmenu') {
      try {
        const store = useMindMapStore.getState();
        (store as any).closePanel?.('contextMenu');
        store.setShowContextMenu(false);
      } catch {  }
    }

    if (event.type === 'nodeClick' && event.targetNodeId) {
      try {
        const store = useMindMapStore.getState() as any;
        store.selectNode?.(event.targetNodeId);
      } catch {  }
      return;
    }
  }
}
