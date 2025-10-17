import { describe, it, expect } from 'vitest';
import {
  selectNodeIdByMarkdownLine,
  findParentNode,
  getSiblingNodes,
  flattenVisibleNodes,
} from './mindMapSelectors';
import type { MindMapNode } from '@shared/types';

describe('mindMapSelectors', () => {
  // Test data factory
  function createNode(overrides: Partial<MindMapNode>): MindMapNode {
    return {
      id: 'node-1',
      text: 'Test Node',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      level: 1,
      collapsed: false,
      children: [],
      ...overrides,
    } as MindMapNode;
  }

  describe('selectNodeIdByMarkdownLine', () => {
    it('should find node by markdown line number', () => {
      const nodes = [
        createNode({
          id: 'node-1',
          markdownMeta: { lineNumber: 1, type: 'heading' },
        }),
        createNode({
          id: 'node-2',
          markdownMeta: { lineNumber: 5, type: 'heading' },
        }),
      ];

      const result = selectNodeIdByMarkdownLine(nodes, 5);
      expect(result).toBe('node-2');
    });

    it('should find node in nested children', () => {
      const child = createNode({
        id: 'child-1',
        markdownMeta: { lineNumber: 10, type: 'heading' },
      });

      const parent = createNode({
        id: 'parent-1',
        markdownMeta: { lineNumber: 5, type: 'heading' },
        children: [child],
      });

      const result = selectNodeIdByMarkdownLine([parent], 10);
      expect(result).toBe('child-1');
    });

    it('should return null if no node found', () => {
      const nodes = [
        createNode({
          id: 'node-1',
          markdownMeta: { lineNumber: 1, type: 'heading' },
        }),
      ];

      const result = selectNodeIdByMarkdownLine(nodes, 999);
      expect(result).toBeNull();
    });

    it('should handle empty array', () => {
      const result = selectNodeIdByMarkdownLine([], 1);
      expect(result).toBeNull();
    });
  });

  describe('findParentNode', () => {
    it('should find parent of child node', () => {
      const child = createNode({ id: 'child-1' });
      const parent = createNode({
        id: 'parent-1',
        children: [child],
      });

      const result = findParentNode([parent], 'child-1');
      expect(result).toBe(parent);
    });

    it('should find parent in deeply nested structure', () => {
      const grandchild = createNode({ id: 'grandchild-1' });
      const child = createNode({
        id: 'child-1',
        children: [grandchild],
      });
      const parent = createNode({
        id: 'parent-1',
        children: [child],
      });

      const result = findParentNode([parent], 'grandchild-1');
      expect(result).toBe(child);
    });

    it('should return null for root nodes', () => {
      const root = createNode({ id: 'root-1' });
      const result = findParentNode([root], 'root-1');
      expect(result).toBeNull();
    });

    it('should return null if node not found', () => {
      const root = createNode({ id: 'root-1' });
      const result = findParentNode([root], 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getSiblingNodes', () => {
    it('should return siblings and current index', () => {
      const child1 = createNode({ id: 'child-1' });
      const child2 = createNode({ id: 'child-2' });
      const child3 = createNode({ id: 'child-3' });

      const parent = createNode({
        id: 'parent-1',
        children: [child1, child2, child3],
      });

      const result = getSiblingNodes(parent, 'child-2');

      expect(result.siblings).toHaveLength(3);
      expect(result.currentIndex).toBe(1);
      expect(result.siblings[1]).toBe(child2);
    });

    it('should return root as single sibling if target is root', () => {
      const root = createNode({ id: 'root-1' });
      const result = getSiblingNodes(root, 'root-1');

      expect(result.siblings).toHaveLength(1);
      expect(result.siblings[0]).toBe(root);
      expect(result.currentIndex).toBe(0);
    });

    it('should return -1 if node not found', () => {
      const root = createNode({ id: 'root-1' });
      const result = getSiblingNodes(root, 'non-existent');

      expect(result.currentIndex).toBe(-1);
    });
  });

  describe('flattenVisibleNodes', () => {
    it('should flatten all visible nodes', () => {
      const grandchild = createNode({ id: 'grandchild-1' });
      const child1 = createNode({
        id: 'child-1',
        children: [grandchild],
      });
      const child2 = createNode({ id: 'child-2' });

      const root = createNode({
        id: 'root-1',
        children: [child1, child2],
      });

      const result = flattenVisibleNodes(root);

      expect(result).toHaveLength(4); // root, child1, grandchild, child2
      expect(result.map(n => n.id)).toEqual([
        'root-1',
        'child-1',
        'grandchild-1',
        'child-2',
      ]);
    });

    it('should exclude children of collapsed nodes', () => {
      const grandchild = createNode({ id: 'grandchild-1' });
      const child1 = createNode({
        id: 'child-1',
        collapsed: true,
        children: [grandchild],
      });
      const child2 = createNode({ id: 'child-2' });

      const root = createNode({
        id: 'root-1',
        children: [child1, child2],
      });

      const result = flattenVisibleNodes(root);

      expect(result).toHaveLength(3); // root, child1, child2 (grandchild hidden)
      expect(result.map(n => n.id)).toEqual(['root-1', 'child-1', 'child-2']);
    });

    it('should handle single node without children', () => {
      const root = createNode({ id: 'root-1' });
      const result = flattenVisibleNodes(root);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(root);
    });
  });
});
