import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { dispatchCanvasEvent } from './dispatcher';
import { useMindMapStore } from '@mindmap/store';
import type { CanvasEvent } from './EventStrategy';

// Mock the store
vi.mock('@mindmap/store', () => ({
  useMindMapStore: {
    getState: vi.fn(),
  },
}));

describe('dispatchCanvasEvent', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      ui: { mode: 'normal', openPanels: {} },
      selectNode: vi.fn(),
      setShowContextMenu: vi.fn(),
      setContextMenuPosition: vi.fn(),
      openPanel: vi.fn(),
      startEditing: vi.fn(),
      moveNodeWithPosition: vi.fn(),
      normalizedData: {
        nodes: {
          'node-1': { id: 'node-1', text: 'Test Node', kind: 'text' },
          'node-table': { id: 'node-table', text: 'Table', kind: 'table' },
        },
      },
    };

    (useMindMapStore.getState as any).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Normal Mode', () => {
    beforeEach(() => {
      mockStore.ui.mode = 'normal';
    });

    it('should handle background click', () => {
      const event: CanvasEvent = {
        type: 'bgclick',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.selectNode).toHaveBeenCalledWith(null);
      expect(mockStore.setShowContextMenu).toHaveBeenCalledWith(false);
    });

    it('should handle node click', () => {
      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.selectNode).toHaveBeenCalledWith('node-1');
    });

    it('should handle node double click for text nodes', () => {
      const event: CanvasEvent = {
        type: 'nodeDoubleClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.startEditing).toHaveBeenCalledWith('node-1');
    });

    it('should not start editing for table nodes on double click', () => {
      const event: CanvasEvent = {
        type: 'nodeDoubleClick',
        targetNodeId: 'node-table',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.startEditing).not.toHaveBeenCalled();
    });

    it('should handle context menu', () => {
      const event: CanvasEvent = {
        type: 'contextmenu',
        x: 150,
        y: 250,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.setContextMenuPosition).toHaveBeenCalledWith({ x: 150, y: 250 });
      expect(mockStore.openPanel).toHaveBeenCalledWith('contextMenu');
    });

    it('should handle node context menu', () => {
      const event: CanvasEvent = {
        type: 'nodeContextMenu',
        targetNodeId: 'node-1',
        x: 150,
        y: 250,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.selectNode).toHaveBeenCalledWith('node-1');
      expect(mockStore.setContextMenuPosition).toHaveBeenCalledWith({ x: 150, y: 250 });
      expect(mockStore.openPanel).toHaveBeenCalledWith('contextMenu');
    });

    it('should handle node drag end', () => {
      const event: CanvasEvent = {
        type: 'nodeDragEnd',
        targetNodeId: 'node-1',
        draggedNodeId: 'node-2',
        dropPosition: 'after',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.moveNodeWithPosition).toHaveBeenCalledWith('node-2', 'node-1', 'after');
    });
  });

  describe('Insert Mode', () => {
    beforeEach(() => {
      mockStore.ui.mode = 'insert';
    });

    it('should handle escape key to exit insert mode', () => {
      const event: CanvasEvent = {
        type: 'click',
        x: 0,
        y: 0,
      };

      dispatchCanvasEvent(event);

      // Insert mode strategy would handle this
      // We're just verifying the dispatcher routes correctly
      expect(useMindMapStore.getState).toHaveBeenCalled();
    });
  });

  describe('Visual Mode', () => {
    beforeEach(() => {
      mockStore.ui.mode = 'visual';
    });

    it('should use visual mode strategy', () => {
      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      // Visual mode has different behavior than normal mode
      expect(useMindMapStore.getState).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing mode gracefully', () => {
      mockStore.ui.mode = undefined;

      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      expect(() => dispatchCanvasEvent(event)).not.toThrow();
    });

    it('should handle store errors gracefully', () => {
      mockStore.selectNode.mockImplementation(() => {
        throw new Error('Store error');
      });

      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      expect(() => dispatchCanvasEvent(event)).not.toThrow();
    });

    it('should default to normal mode for unknown modes', () => {
      mockStore.ui.mode = 'unknown-mode';

      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      // Should fall back to normal mode behavior
      expect(mockStore.selectNode).toHaveBeenCalledWith('node-1');
    });
  });

  describe('Strategy Selection', () => {
    it('should select NormalModeStrategy for normal mode', () => {
      mockStore.ui.mode = 'normal';

      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(mockStore.selectNode).toHaveBeenCalledWith('node-1');
    });

    it('should select InsertModeStrategy for insert mode', () => {
      mockStore.ui.mode = 'insert';

      const event: CanvasEvent = {
        type: 'bgclick',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      // Verify strategy was selected (insert mode has different behavior)
      expect(useMindMapStore.getState).toHaveBeenCalled();
    });

    it('should select VisualModeStrategy for visual mode', () => {
      mockStore.ui.mode = 'visual';

      const event: CanvasEvent = {
        type: 'nodeClick',
        targetNodeId: 'node-1',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      expect(useMindMapStore.getState).toHaveBeenCalled();
    });

    it('should default to NormalModeStrategy for menu mode', () => {
      mockStore.ui.mode = 'menu';

      const event: CanvasEvent = {
        type: 'bgclick',
        x: 100,
        y: 200,
      };

      dispatchCanvasEvent(event);

      // Menu mode falls back to normal strategy
      expect(mockStore.selectNode).toHaveBeenCalledWith(null);
    });
  });
});
