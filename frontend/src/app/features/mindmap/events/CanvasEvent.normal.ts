import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';
import * as panelManager from '@mindmap/state/panelManager';

export class NormalModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
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
        const ui = store.ui as any;
        const canOpen = panelManager.canOpen(ui.openPanels, 'contextMenu', { exclusiveWith: ['linkList'] });
        if (!canOpen) return;
        store.setContextMenuPosition({ x: event.x, y: event.y });
        (store as any).openPanel?.('contextMenu');
      } catch { /* ignore */ }
    }
  }
}
