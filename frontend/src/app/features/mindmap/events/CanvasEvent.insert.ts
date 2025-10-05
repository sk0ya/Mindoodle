import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class InsertModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    // In insert mode, suppress context menu
    if (event.type === 'contextmenu') {
      try {
        const store = useMindMapStore.getState();
        (store as any).closePanel?.('contextMenu');
        store.setShowContextMenu(false);
      } catch { /* ignore */ }
    }
  }
}
