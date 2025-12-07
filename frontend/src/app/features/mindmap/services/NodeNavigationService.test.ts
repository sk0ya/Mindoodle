import { describe, it, expect } from 'vitest';
import { getNextNodeId, findParent } from './NodeNavigationService';
import { createTestNode as createNode } from '../test-helpers/testNodeFactory';

describe('NodeNavigationService', () => {
  describe('getNextNodeId', () => {
    describe('left navigation (parent)', () => {
      it('should navigate to parent node', () => {
        const child = createNode({ id: 'child-1' });
        const parent = createNode({
          id: 'parent-1',
          children: [child],
        });

        const result = getNextNodeId('left', 'child-1', [parent]);
        expect(result).toBe('parent-1');
      });

      it('should return null if already at root', () => {
        const root = createNode({ id: 'root-1' });
        const result = getNextNodeId('left', 'root-1', [root]);
        expect(result).toBeNull();
      });

      it('should navigate to grandparent from grandchild', () => {
        const grandchild = createNode({ id: 'grandchild-1' });
        const child = createNode({
          id: 'child-1',
          children: [grandchild],
        });
        const root = createNode({
          id: 'root-1',
          children: [child],
        });

        const result = getNextNodeId('left', 'grandchild-1', [root]);
        expect(result).toBe('child-1');
      });
    });

    describe('right navigation (first child)', () => {
      it('should navigate to first visible child', () => {
        const child1 = createNode({ id: 'child-1', y: -50 });
        const child2 = createNode({ id: 'child-2', y: 50 });
        const parent = createNode({
          id: 'parent-1',
          y: 0,
          children: [child1, child2],
        });

        const result = getNextNodeId('right', 'parent-1', [parent]);
        expect(result).toBe('child-1'); // Closest to parent's y position
      });

      it('should select closest child when multiple children exist', () => {
        const child1 = createNode({ id: 'child-1', y: -100 });
        const child2 = createNode({ id: 'child-2', y: 10 });
        const child3 = createNode({ id: 'child-3', y: 50 });
        const parent = createNode({
          id: 'parent-1',
          y: 0,
          children: [child1, child2, child3],
        });

        const result = getNextNodeId('right', 'parent-1', [parent]);
        expect(result).toBe('child-2'); // Closest to y: 0
      });

      it('should return null if node has no children', () => {
        const parent = createNode({ id: 'parent-1', children: [] });
        const result = getNextNodeId('right', 'parent-1', [parent]);
        expect(result).toBeNull();
      });

      it('should return null if node is collapsed', () => {
        const child = createNode({ id: 'child-1' });
        const parent = createNode({
          id: 'parent-1',
          collapsed: true,
          children: [child],
        });

        const result = getNextNodeId('right', 'parent-1', [parent]);
        expect(result).toBeNull();
      });
    });

    describe('up navigation (previous sibling)', () => {
      it('should navigate to previous sibling', () => {
        const child1 = createNode({ id: 'child-1' });
        const child2 = createNode({ id: 'child-2' });
        const child3 = createNode({ id: 'child-3' });
        const parent = createNode({
          id: 'parent-1',
          children: [child1, child2, child3],
        });

        const result = getNextNodeId('up', 'child-2', [parent]);
        expect(result).toBe('child-1');
      });

      it('should return null if already at first sibling', () => {
        const child1 = createNode({ id: 'child-1' });
        const child2 = createNode({ id: 'child-2' });
        const parent = createNode({
          id: 'parent-1',
          children: [child1, child2],
        });

        const result = getNextNodeId('up', 'child-1', [parent]);
        expect(result).toBeNull();
      });

      it('should navigate to previous root when at first child', () => {
        const root1 = createNode({ id: 'root-1' });
        const child = createNode({ id: 'child-1' });
        const root2 = createNode({
          id: 'root-2',
          children: [child],
        });

        const result = getNextNodeId('up', 'child-1', [root1, root2]);
        expect(result).toBe('root-1'); // Falls back to previous root when no sibling
      });

      it('should navigate between roots', () => {
        const root1 = createNode({ id: 'root-1' });
        const root2 = createNode({ id: 'root-2' });

        const result = getNextNodeId('up', 'root-2', [root1, root2]);
        expect(result).toBe('root-1');
      });
    });

    describe('down navigation (next sibling)', () => {
      it('should navigate to next sibling', () => {
        const child1 = createNode({ id: 'child-1' });
        const child2 = createNode({ id: 'child-2' });
        const child3 = createNode({ id: 'child-3' });
        const parent = createNode({
          id: 'parent-1',
          children: [child1, child2, child3],
        });

        const result = getNextNodeId('down', 'child-2', [parent]);
        expect(result).toBe('child-3');
      });

      it('should return null if already at last sibling', () => {
        const child1 = createNode({ id: 'child-1' });
        const child2 = createNode({ id: 'child-2' });
        const parent = createNode({
          id: 'parent-1',
          children: [child1, child2],
        });

        const result = getNextNodeId('down', 'child-2', [parent]);
        expect(result).toBeNull();
      });

      it('should navigate to next root when at last child', () => {
        const child = createNode({ id: 'child-1' });
        const root1 = createNode({
          id: 'root-1',
          children: [child],
        });
        const root2 = createNode({ id: 'root-2' });

        const result = getNextNodeId('down', 'child-1', [root1, root2]);
        expect(result).toBe('root-2'); // Falls back to next root when no sibling
      });

      it('should navigate between roots', () => {
        const root1 = createNode({ id: 'root-1' });
        const root2 = createNode({ id: 'root-2' });

        const result = getNextNodeId('down', 'root-1', [root1, root2]);
        expect(result).toBe('root-2');
      });
    });

    describe('edge cases', () => {
      it('should handle empty roots array', () => {
        const result = getNextNodeId('up', 'node-1', []);
        expect(result).toBeNull();
      });

      it('should handle node not found', () => {
        const root = createNode({ id: 'root-1' });
        const result = getNextNodeId('down', 'non-existent', [root]);
        expect(result).toBeNull();
      });

      it('should handle single node tree', () => {
        const root = createNode({ id: 'root-1' });

        expect(getNextNodeId('up', 'root-1', [root])).toBeNull();
        expect(getNextNodeId('down', 'root-1', [root])).toBeNull();
        expect(getNextNodeId('left', 'root-1', [root])).toBeNull();
        expect(getNextNodeId('right', 'root-1', [root])).toBeNull();
      });
    });
  });

  describe('findParent', () => {
    it('should find direct parent', () => {
      const child = createNode({ id: 'child-1' });
      const parent = createNode({
        id: 'parent-1',
        children: [child],
      });

      const result = findParent([parent], 'child-1');
      expect(result).toBe(parent);
    });

    it('should find parent in deeply nested structure', () => {
      const grandchild = createNode({ id: 'grandchild-1' });
      const child = createNode({
        id: 'child-1',
        children: [grandchild],
      });
      const root = createNode({
        id: 'root-1',
        children: [child],
      });

      const result = findParent([root], 'grandchild-1');
      expect(result).toBe(child);
    });

    it('should return null for root node', () => {
      const root = createNode({ id: 'root-1' });
      const result = findParent([root], 'root-1');
      expect(result).toBeNull();
    });

    it('should search across multiple roots', () => {
      const child = createNode({ id: 'child-1' });
      const root1 = createNode({ id: 'root-1' });
      const root2 = createNode({
        id: 'root-2',
        children: [child],
      });

      const result = findParent([root1, root2], 'child-1');
      expect(result).toBe(root2);
    });

    it('should return null if node not found', () => {
      const root = createNode({ id: 'root-1' });
      const result = findParent([root], 'non-existent');
      expect(result).toBeNull();
    });
  });
});
