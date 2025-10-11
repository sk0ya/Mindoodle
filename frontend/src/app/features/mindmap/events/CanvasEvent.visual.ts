import type { EventStrategy, CanvasEvent } from './EventStrategy';
import { useMindMapStore } from '@mindmap/store';

export class VisualModeStrategy implements EventStrategy {
  private handleBgClick(): void {
    try {
      const store = useMindMapStore.getState() as unknown as {
        closeAttachmentAndLinkLists?: () => void;
        selectNode?: (id: string | null) => void;
        setShowContextMenu?: (show: boolean) => void;
      };
      store.closeAttachmentAndLinkLists?.();
      store.selectNode?.(null);
      store.setShowContextMenu?.(false);
    } catch (e) { console.warn('CanvasEvent.visual: bgclick handler error', e); }
  }

  private handleContextMenu(x: number, y: number): void {
    try {
      const store = useMindMapStore.getState() as unknown as {
        setContextMenuPosition: (pos: { x: number; y: number }) => void;
        openPanel?: (panel: string) => void;
      };
      store.setContextMenuPosition({ x, y });
      store.openPanel?.('contextMenu');
    } catch (e) { console.warn('CanvasEvent.visual: contextmenu handler error', e); }
  }

  private handleNodeContextMenu(nodeId: string, x: number, y: number): void {
    try {
      const store = useMindMapStore.getState() as unknown as {
        selectNode?: (id: string) => void;
        setContextMenuPosition?: (pos: { x: number; y: number }) => void;
        openPanel?: (panel: string) => void;
      };
      store.selectNode?.(nodeId);
      store.setContextMenuPosition?.({ x, y });
      store.openPanel?.('contextMenu');
    } catch (e) { console.warn('CanvasEvent.visual: nodeContextMenu handler error', e); }
  }

  private handleNodeClick(nodeId: string): void {
    try {
      const store = useMindMapStore.getState() as unknown as {
        selectNode?: (id: string) => void;
      };
      store.selectNode?.(nodeId);
    } catch (e) { console.warn('CanvasEvent.visual: nodeClick handler error', e); }
  }

  private handleNodeDragEnd(draggedNodeId: string, targetNodeId: string, dropPosition: string): void {
    try {
      const store = useMindMapStore.getState() as unknown as {
        moveNodeWithPosition?: (draggedId: string, targetId: string, position: string) => void;
      };
      store.moveNodeWithPosition?.(draggedNodeId, targetNodeId, dropPosition);
    } catch (e) { console.warn('CanvasEvent.visual: nodeDragEnd handler error', e); }
  }

  handle(event: CanvasEvent): void {
    if (event.type === 'bgclick') {
      this.handleBgClick();
      return;
    }
    if (event.type === 'contextmenu') {
      this.handleContextMenu(event.x, event.y);
      return;
    }
    if (event.type === 'nodeContextMenu' && event.targetNodeId) {
      this.handleNodeContextMenu(event.targetNodeId, event.x, event.y);
      return;
    }
    if (event.type === 'nodeClick' && event.targetNodeId) {
      this.handleNodeClick(event.targetNodeId);
      return;
    }
    if (event.type === 'nodeDragEnd' && event.targetNodeId && event.draggedNodeId && event.dropPosition) {
      this.handleNodeDragEnd(event.draggedNodeId, event.targetNodeId, event.dropPosition);
    }
  }
}
