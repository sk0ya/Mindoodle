import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore, type MindMapStore } from '@mindmap/store';

export class InsertModeStrategy implements EventStrategy {
  handle(event: CanvasEvent): void {
    if (event.type === 'bgclick') {

      try {
        const store = useMindMapStore.getState();
        store.setShowContextMenu?.(false);
      } catch (err) {
        console.warn('bgclick handler failed', err);
      }
      return;
    }

    if (event.type === 'contextmenu') {
      try {
        const store: MindMapStore = useMindMapStore.getState();
        store.setShowContextMenu(false);
      } catch (e) {
        console.warn('contextmenu handler failed', e);
      }
    }

    if (event.type === 'nodeClick' && event.targetNodeId) {
      try {
        const store = useMindMapStore.getState();
        store.selectNode?.(event.targetNodeId);
      } catch (err) {
        console.warn('nodeClick selection failed', err);
      }
      // 以降の処理は無いので明示的な return は不要
    }
  }
}
