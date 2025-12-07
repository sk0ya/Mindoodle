import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '@core/data/normalizedStore';

/**
 * Test helper utilities for MindMap tests
 * Centralizes common test data creation patterns
 */

/**
 * Creates a test MindMapNode with sensible defaults
 * @param overrides - Partial node properties to override defaults
 * @returns Complete MindMapNode for testing
 */
export function createTestNode(overrides: Partial<MindMapNode> = {}): MindMapNode {
  const baseNode: Partial<MindMapNode> = {
    id: 'test-node-1',
    text: 'Test Node',
    x: 0,
    y: 0,
    collapsed: false,
    children: [],
  };
  return { ...baseNode, ...overrides } as MindMapNode;
}

/**
 * Creates a hierarchical tree of test nodes
 * @param depth - Maximum depth of the tree
 * @param childrenPerNode - Number of children per node
 * @returns Root node with nested children
 */
export function createTestTree(depth: number = 2, childrenPerNode: number = 2): MindMapNode {
  const createChildren = (level: number, parentId: string): MindMapNode[] => {
    if (level >= depth) return [];

    return Array.from({ length: childrenPerNode }, (_, i) => {
      const id = `${parentId}-child-${i}`;
      return createTestNode({
        id,
        text: `Node ${id}`,
        children: createChildren(level + 1, id),
      });
    });
  };

  return createTestNode({
    id: 'root',
    text: 'Root Node',
    children: createChildren(0, 'root'),
  });
}

/**
 * Creates test normalized data structure
 * @param nodes - Array of nodes to normalize
 * @returns NormalizedData structure
 */
export function createTestNormalizedData(nodes: MindMapNode[]): NormalizedData {
  const nodesMap: Record<string, MindMapNode> = {};
  const parentMap: Record<string, string> = {};
  const childrenMap: Record<string, string[]> = {};
  const rootNodeIds: string[] = [];

  const processNode = (node: MindMapNode, parentId?: string) => {
    nodesMap[node.id] = node;

    if (parentId) {
      parentMap[node.id] = parentId;
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(node.id);
    } else {
      rootNodeIds.push(node.id);
    }

    if (node.children) {
      node.children.forEach(child => processNode(child, node.id));
    }
  };

  nodes.forEach(node => processNode(node));

  return {
    nodes: nodesMap,
    parentMap,
    childrenMap,
    rootNodeIds,
  };
}

/**
 * Creates a test node with specific size properties
 * @param width - Node width
 * @param height - Node height
 * @param imageHeight - Optional image height
 * @returns Object with size properties
 */
export function createTestNodeSize(
  width: number = 100,
  height: number = 40,
  imageHeight: number = 0
) {
  return { width, height, imageHeight };
}
