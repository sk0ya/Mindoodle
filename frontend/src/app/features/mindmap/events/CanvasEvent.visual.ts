import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class VisualModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    // Visual mode: treat like normal for now but keep hook to customize
    if (event.type === 'contextmenu') {
      try {
        const store = useMindMapStore.getState();
        store.setContextMenuPosition({ x: event.x, y: event.y });
        (store as any).openPanel?.('contextMenu');
      } catch { /* ignore */ }
    }
  }
}
