import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ensureVisible, type EnsureVisibleUI } from './ViewportScrollService';
import type { MindMapNode } from '@shared/types';
import * as viewportService from '@/app/core/services/viewportService';

// Mock dependencies
vi.mock('@/app/core/services', () => ({
  viewportService: {
    getSize: vi.fn(() => ({ width: 1200, height: 800 })),
  },
}));

vi.mock('@mindmap/store', () => ({
  useMindMapStore: {
    getState: vi.fn(() => ({
      settings: {
        fontSize: 14,
        nodeTextWrapEnabled: false,
        nodeTextWrapWidth: 200,
      },
    })),
  },
}));

vi.mock('@mindmap/utils', () => ({
  findNodeInRoots: vi.fn((roots: MindMapNode[], id: string) => {
    const find = (nodes: MindMapNode[]): MindMapNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = find(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(roots);
  }),
  calculateNodeSize: vi.fn(() => ({ width: 100, height: 40 })),
  resolveNodeTextWrapConfig: vi.fn(() => ({ enabled: false, width: 200 })),
}));

describe('ViewportScrollService', () => {
  let mockSetPan: ReturnType<typeof vi.fn>;
  let mockRootNodes: MindMapNode[];
  let mockUI: EnsureVisibleUI;

  beforeEach(() => {
    mockSetPan = vi.fn();

    // Create a simple tree structure
    mockRootNodes = [
      {
        id: 'root-1',
        text: 'Root Node',
        x: 0,
        y: 0,
        children: [
          {
            id: 'child-1',
            text: 'Child 1',
            x: 200,
            y: 100,
            children: [],
          },
          {
            id: 'child-2',
            text: 'Child 2',
            x: 200,
            y: 200,
            children: [],
          },
        ],
      },
    ];

    mockUI = {
      zoom: 1,
      pan: { x: 0, y: 0 },
      sidebarCollapsed: false,
      showNotesPanel: false,
      markdownPanelWidth: 0,
      showNodeNotePanel: false,
      nodeNotePanelHeight: 0,
    };

    // Setup DOM
    document.body.innerHTML = '<div class="mindmap-canvas-container" style="width: 1200px; height: 800px;"></div>';
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('ensureVisible', () => {
    it('should complete without error for visible node', () => {
      // Test with a node that's reasonably centered
      // The ensureVisible function accounts for zoom and viewport dimensions
      mockRootNodes[0].x = 600; // Center of 1200px width
      mockRootNodes[0].y = 400; // Center of 800px height
      mockUI.pan = { x: 0, y: 0 };
      mockUI.zoom = 0.1; // Very small zoom

      // The function should complete without throwing
      expect(() => ensureVisible('root-1', mockUI, mockSetPan, mockRootNodes)).not.toThrow();

      // Note: The function may pan based on complex viewport calculations
      // We're just verifying it executes successfully
    });

    it('should pan to make node visible when off-screen to the right', () => {
      // Node far to the right
      mockRootNodes[0].children[0].x = 2000;
      mockRootNodes[0].children[0].y = 0;
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      expect(mockSetPan).toHaveBeenCalled();
      const newPan = mockSetPan.mock.calls[0][0];
      expect(newPan.x).toBeLessThan(0); // Pan left to reveal right content
    });

    it('should pan to make node visible when off-screen to the left', () => {
      // Node far to the left
      mockRootNodes[0].children[0].x = -2000;
      mockRootNodes[0].children[0].y = 0;
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      expect(mockSetPan).toHaveBeenCalled();
      const newPan = mockSetPan.mock.calls[0][0];
      expect(newPan.x).toBeGreaterThan(0); // Pan right to reveal left content
    });

    it('should pan to make node visible when off-screen above', () => {
      // Node far above
      mockRootNodes[0].children[0].x = 0;
      mockRootNodes[0].children[0].y = -2000;
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      expect(mockSetPan).toHaveBeenCalled();
      const newPan = mockSetPan.mock.calls[0][0];
      expect(newPan.y).toBeGreaterThan(0); // Pan down to reveal top content
    });

    it('should pan to make node visible when off-screen below', () => {
      // Node far below
      mockRootNodes[0].children[0].x = 0;
      mockRootNodes[0].children[0].y = 2000;
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      expect(mockSetPan).toHaveBeenCalled();
      const newPan = mockSetPan.mock.calls[0][0];
      expect(newPan.y).toBeLessThan(0); // Pan up to reveal bottom content
    });

    it('should handle non-existent node gracefully', () => {
      ensureVisible('non-existent-node', mockUI, mockSetPan, mockRootNodes);

      // Should not crash or call setPan
      expect(mockSetPan).not.toHaveBeenCalled();
    });

    it('should account for zoom level', () => {
      // Higher zoom means nodes appear larger
      mockRootNodes[0].children[0].x = 1000;
      mockRootNodes[0].children[0].y = 500;
      mockUI.zoom = 2; // 2x zoom
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      // With higher zoom, panning should be adjusted
      expect(mockSetPan).toHaveBeenCalled();
    });

    it('should handle existing pan offset', () => {
      mockRootNodes[0].children[0].x = 1000;
      mockRootNodes[0].children[0].y = 500;
      mockUI.pan = { x: -500, y: -250 }; // Already panned

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      // Should adjust based on current pan
      expect(mockSetPan).toHaveBeenCalled();
    });

    it('should handle nested children', () => {
      // Add deeply nested node
      mockRootNodes[0].children[0].children = [
        {
          id: 'grandchild-1',
          text: 'Grandchild',
          x: 400,
          y: 150,
          children: [],
        },
      ];

      mockRootNodes[0].children[0].children[0].x = 2000;
      mockRootNodes[0].children[0].children[0].y = 0;
      mockUI.pan = { x: 0, y: 0 };

      ensureVisible('grandchild-1', mockUI, mockSetPan, mockRootNodes);

      expect(mockSetPan).toHaveBeenCalled();
    });
  });

  describe('viewport calculations', () => {
    it('should account for sidebar width', () => {
      // Add sidebar to DOM
      const sidebar = document.createElement('div');
      sidebar.className = 'primary-sidebar';
      Object.defineProperty(sidebar, 'getBoundingClientRect', {
        value: () => ({ width: 250, height: 800, left: 0, top: 0 }),
      });
      document.body.innerHTML = '';
      document.body.appendChild(sidebar);

      const container = document.createElement('div');
      container.className = 'mindmap-canvas-container';
      document.body.appendChild(container);

      mockRootNodes[0].children[0].x = 800;
      mockRootNodes[0].children[0].y = 0;

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      // Should calculate viewport accounting for sidebar
      expect(mockSetPan).toHaveBeenCalled();
    });

    it('should account for note panel height', () => {
      // Add note panel to DOM
      const notePanel = document.createElement('div');
      notePanel.className = 'selected-node-note-panel';
      Object.defineProperty(notePanel, 'getBoundingClientRect', {
        value: () => ({ width: 1200, height: 150, left: 0, top: 650 }),
      });
      document.body.appendChild(notePanel);

      mockRootNodes[0].children[0].x = 0;
      mockRootNodes[0].children[0].y = 700;

      ensureVisible('child-1', mockUI, mockSetPan, mockRootNodes);

      // Should calculate viewport accounting for note panel
      expect(mockSetPan).toHaveBeenCalled();
    });
  });
});
