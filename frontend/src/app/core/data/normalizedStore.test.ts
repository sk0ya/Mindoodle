import { describe, it, expect } from 'vitest';
import {
  normalizeTreeData,
  denormalizeTreeData,
  findNormalizedNode,
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  moveNormalizedNode,
  moveNodeWithPositionNormalized,
  addSiblingNormalizedNode,
  addRootSiblingNode,
  changeSiblingOrderNormalized,
} from './normalizedStore';
import type { MindMapNode } from '@shared/types';

describe('normalizedStore', () => {
  function createNode(overrides: Partial<MindMapNode>): MindMapNode {
    return {
      id: 'test-id',
      text: 'Test',
      x: 0,
      y: 0,
      children: [],
      fontSize: 14,
      fontWeight: 'normal',
      lineEnding: '\n',
      ...overrides,
    };
  }

  describe('normalizeTreeData', () => {
    it('should normalize simple tree', () => {
      const tree = [createNode({ id: 'root-1', text: 'Root' })];
      const normalized = normalizeTreeData(tree);

      expect(normalized.rootNodeIds).toEqual(['root-1']);
      expect(normalized.nodes['root-1']).toBeDefined();
      expect(normalized.nodes['root-1'].text).toBe('Root');
      expect(normalized.childrenMap['root']).toEqual(['root-1']);
    });

    it('should normalize tree with children', () => {
      const child = createNode({ id: 'child-1', text: 'Child' });
      const parent = createNode({
        id: 'parent-1',
        text: 'Parent',
        children: [child],
      });

      const normalized = normalizeTreeData([parent]);

      expect(normalized.parentMap['child-1']).toBe('parent-1');
      expect(normalized.childrenMap['parent-1']).toEqual(['child-1']);
    });

    it('should handle multiple root nodes', () => {
      const root1 = createNode({ id: 'root-1' });
      const root2 = createNode({ id: 'root-2' });

      const normalized = normalizeTreeData([root1, root2]);

      expect(normalized.rootNodeIds).toEqual(['root-1', 'root-2']);
      expect(normalized.childrenMap['root']).toEqual(['root-1', 'root-2']);
    });

    it('should handle empty tree', () => {
      const normalized = normalizeTreeData([]);

      expect(normalized.rootNodeIds).toEqual([]);
      expect(normalized.nodes).toEqual({});
    });

    it('should handle undefined input', () => {
      const normalized = normalizeTreeData(undefined);

      expect(normalized.rootNodeIds).toEqual([]);
      expect(normalized.nodes).toEqual({});
    });

    it('should normalize deeply nested tree', () => {
      const grandchild = createNode({ id: 'gc-1' });
      const child = createNode({ id: 'c-1', children: [grandchild] });
      const parent = createNode({ id: 'p-1', children: [child] });

      const normalized = normalizeTreeData([parent]);

      expect(normalized.parentMap['c-1']).toBe('p-1');
      expect(normalized.parentMap['gc-1']).toBe('c-1');
      expect(normalized.childrenMap['c-1']).toEqual(['gc-1']);
    });
  });

  describe('denormalizeTreeData', () => {
    it('should denormalize tree', () => {
      const tree = [
        createNode({
          id: 'parent-1',
          children: [createNode({ id: 'child-1' })],
        }),
      ];

      const normalized = normalizeTreeData(tree);
      const denormalized = denormalizeTreeData(normalized);

      expect(denormalized).toHaveLength(1);
      expect(denormalized[0].id).toBe('parent-1');
      expect(denormalized[0].children).toHaveLength(1);
      expect(denormalized[0].children![0].id).toBe('child-1');
    });

    it('should throw for missing node', () => {
      const normalized = {
        nodes: {},
        rootNodeIds: ['missing-node'],
        parentMap: {},
        childrenMap: {},
      };

      expect(() => denormalizeTreeData(normalized)).toThrow('Node not found');
    });
  });

  describe('findNormalizedNode', () => {
    it('should find existing node', () => {
      const tree = [createNode({ id: 'test-1', text: 'Find Me' })];
      const normalized = normalizeTreeData(tree);

      const found = findNormalizedNode(normalized, 'test-1');
      expect(found).toBeDefined();
      expect(found?.text).toBe('Find Me');
    });

    it('should return null for missing node', () => {
      const normalized = normalizeTreeData([]);
      const found = findNormalizedNode(normalized, 'missing');

      expect(found).toBeNull();
    });
  });

  describe('updateNormalizedNode', () => {
    it('should update node properties', () => {
      const tree = [createNode({ id: 'test-1', text: 'Old' })];
      const normalized = normalizeTreeData(tree);

      const updated = updateNormalizedNode(normalized, 'test-1', {
        text: 'New',
      });

      expect(updated.nodes['test-1'].text).toBe('New');
    });

    it('should throw for missing node', () => {
      const normalized = normalizeTreeData([]);

      expect(() =>
        updateNormalizedNode(normalized, 'missing', { text: 'New' })
      ).toThrow('Node not found');
    });
  });

  describe('deleteNormalizedNode', () => {
    it('should delete child node', () => {
      const child = createNode({ id: 'child-1' });
      const parent = createNode({ id: 'parent-1', children: [child] });
      const normalized = normalizeTreeData([parent]);

      const updated = deleteNormalizedNode(normalized, 'child-1');

      expect(updated.nodes['child-1']).toBeUndefined();
      expect(updated.childrenMap['parent-1']).toEqual([]);
    });

    it('should delete node with descendants', () => {
      const grandchild = createNode({ id: 'gc-1' });
      const child = createNode({ id: 'c-1', children: [grandchild] });
      const parent = createNode({ id: 'p-1', children: [child] });
      const normalized = normalizeTreeData([parent]);

      const updated = deleteNormalizedNode(normalized, 'c-1');

      expect(updated.nodes['c-1']).toBeUndefined();
      expect(updated.nodes['gc-1']).toBeUndefined();
    });

    it('should throw when deleting last root', () => {
      const tree = [createNode({ id: 'root-1' })];
      const normalized = normalizeTreeData(tree);

      expect(() => deleteNormalizedNode(normalized, 'root-1')).toThrow(
        'Cannot delete the last root node'
      );
    });

    it('should delete root when multiple roots exist', () => {
      const root1 = createNode({ id: 'root-1' });
      const root2 = createNode({ id: 'root-2' });
      const normalized = normalizeTreeData([root1, root2]);

      const updated = deleteNormalizedNode(normalized, 'root-1');

      expect(updated.rootNodeIds).toEqual(['root-2']);
      expect(updated.nodes['root-1']).toBeUndefined();
    });
  });

  describe('addNormalizedNode', () => {
    it('should add child node', () => {
      const parent = createNode({ id: 'parent-1' });
      const normalized = normalizeTreeData([parent]);

      const newNode = createNode({ id: 'child-1', text: 'New Child' });
      const updated = addNormalizedNode(normalized, 'parent-1', newNode);

      expect(updated.nodes['child-1']).toBeDefined();
      expect(updated.parentMap['child-1']).toBe('parent-1');
      expect(updated.childrenMap['parent-1']).toContain('child-1');
    });

    it('should throw for duplicate node ID', () => {
      const tree = [createNode({ id: 'existing-1' })];
      const normalized = normalizeTreeData(tree);

      const duplicate = createNode({ id: 'existing-1' });

      expect(() =>
        addNormalizedNode(normalized, 'existing-1', duplicate)
      ).toThrow('Node already exists');
    });

    it('should throw for missing parent', () => {
      const normalized = normalizeTreeData([]);
      const newNode = createNode({ id: 'new-1' });

      expect(() =>
        addNormalizedNode(normalized, 'missing-parent', newNode)
      ).toThrow('Parent node not found');
    });

    it('should not allow adding child to table node', () => {
      const tableNode = createNode({ id: 'table-1' });
      (tableNode as any).kind = 'table';
      const normalized = normalizeTreeData([tableNode]);

      const newNode = createNode({ id: 'child-1' });

      expect(() => addNormalizedNode(normalized, 'table-1', newNode)).toThrow(
        'テーブルノードには子ノードを追加できません'
      );
    });
  });

  describe('moveNormalizedNode', () => {
    it('should move node to new parent', () => {
      const child = createNode({ id: 'child-1' });
      const parent1 = createNode({ id: 'p1', children: [child] });
      const parent2 = createNode({ id: 'p2' });
      const normalized = normalizeTreeData([parent1, parent2]);

      const result = moveNormalizedNode(normalized, 'child-1', 'p2');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parentMap['child-1']).toBe('p2');
        expect(result.data.childrenMap['p1']).not.toContain('child-1');
        expect(result.data.childrenMap['p2']).toContain('child-1');
      }
    });

    it('should prevent moving root node', () => {
      const root = createNode({ id: 'root-1' });
      const normalized = normalizeTreeData([root]);

      const result = moveNormalizedNode(normalized, 'root-1', 'root-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('ルートノード');
      }
    });

    it('should prevent circular reference', () => {
      const child = createNode({ id: 'child-1' });
      const parent = createNode({ id: 'parent-1', children: [child] });
      const normalized = normalizeTreeData([parent]);

      const result = moveNormalizedNode(normalized, 'parent-1', 'child-1');

      expect(result.success).toBe(false);
    });

    it('should not allow moving to table node', () => {
      const child = createNode({ id: 'child-1' });
      const parent = createNode({ id: 'parent-1', children: [child] });
      const tableNode = createNode({ id: 'table-1' });
      (tableNode as any).kind = 'table';
      const normalized = normalizeTreeData([parent, tableNode]);

      const result = moveNormalizedNode(normalized, 'child-1', 'table-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('テーブルノード');
      }
    });
  });

  describe('moveNodeWithPositionNormalized', () => {
    it('should move node before sibling', () => {
      const child1 = createNode({ id: 'c1' });
      const child2 = createNode({ id: 'c2' });
      const parent = createNode({ id: 'p', children: [child1, child2] });
      const normalized = normalizeTreeData([parent]);

      const result = moveNodeWithPositionNormalized(
        normalized,
        'c2',
        'c1',
        'before'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.childrenMap['p']).toEqual(['c2', 'c1']);
      }
    });

    it('should move node after sibling', () => {
      const child1 = createNode({ id: 'c1' });
      const child2 = createNode({ id: 'c2' });
      const parent = createNode({ id: 'p', children: [child1, child2] });
      const normalized = normalizeTreeData([parent]);

      const result = moveNodeWithPositionNormalized(
        normalized,
        'c1',
        'c2',
        'after'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.childrenMap['p']).toEqual(['c2', 'c1']);
      }
    });

    it('should move node as child', () => {
      const child1 = createNode({ id: 'c1' });
      const child2 = createNode({ id: 'c2' });
      const parent = createNode({ id: 'p', children: [child1, child2] });
      const normalized = normalizeTreeData([parent]);

      const result = moveNodeWithPositionNormalized(
        normalized,
        'c2',
        'c1',
        'child'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parentMap['c2']).toBe('c1');
      }
    });
  });

  describe('addSiblingNormalizedNode', () => {
    it('should add sibling after node', () => {
      const child1 = createNode({ id: 'c1' });
      const parent = createNode({ id: 'p', children: [child1] });
      const normalized = normalizeTreeData([parent]);

      const newNode = createNode({ id: 'c2' });
      const updated = addSiblingNormalizedNode(normalized, 'c1', newNode, true);

      expect(updated.childrenMap['p']).toEqual(['c1', 'c2']);
    });

    it('should add sibling before node', () => {
      const child1 = createNode({ id: 'c1' });
      const parent = createNode({ id: 'p', children: [child1] });
      const normalized = normalizeTreeData([parent]);

      const newNode = createNode({ id: 'c2' });
      const updated = addSiblingNormalizedNode(
        normalized,
        'c1',
        newNode,
        false
      );

      expect(updated.childrenMap['p']).toEqual(['c2', 'c1']);
    });
  });

  describe('addRootSiblingNode', () => {
    it('should add root sibling after', () => {
      const root1 = createNode({ id: 'r1' });
      const normalized = normalizeTreeData([root1]);

      const newRoot = createNode({ id: 'r2' });
      const updated = addRootSiblingNode(normalized, 'r1', newRoot, true);

      expect(updated.rootNodeIds).toEqual(['r1', 'r2']);
    });

    it('should add root sibling before', () => {
      const root1 = createNode({ id: 'r1' });
      const normalized = normalizeTreeData([root1]);

      const newRoot = createNode({ id: 'r2' });
      const updated = addRootSiblingNode(normalized, 'r1', newRoot, false);

      expect(updated.rootNodeIds).toEqual(['r2', 'r1']);
    });
  });

  describe('changeSiblingOrderNormalized', () => {
    it('should reorder siblings', () => {
      const child1 = createNode({ id: 'c1' });
      const child2 = createNode({ id: 'c2' });
      const child3 = createNode({ id: 'c3' });
      const parent = createNode({ id: 'p', children: [child1, child2, child3] });
      const normalized = normalizeTreeData([parent]);

      const updated = changeSiblingOrderNormalized(
        normalized,
        'c3',
        'c1',
        true
      );

      expect(updated.childrenMap['p']).toEqual(['c3', 'c1', 'c2']);
    });

    it('should throw when nodes have different parents', () => {
      const child1 = createNode({ id: 'c1' });
      const child2 = createNode({ id: 'c2' });
      const parent1 = createNode({ id: 'p1', children: [child1] });
      const parent2 = createNode({ id: 'p2', children: [child2] });
      const normalized = normalizeTreeData([parent1, parent2]);

      expect(() =>
        changeSiblingOrderNormalized(normalized, 'c1', 'c2', true)
      ).toThrow('same parent');
    });

    it('should return unchanged when dragged and target are same', () => {
      const child1 = createNode({ id: 'c1' });
      const parent = createNode({ id: 'p', children: [child1] });
      const normalized = normalizeTreeData([parent]);

      const updated = changeSiblingOrderNormalized(
        normalized,
        'c1',
        'c1',
        true
      );

      expect(updated).toBe(normalized);
    });
  });
});
