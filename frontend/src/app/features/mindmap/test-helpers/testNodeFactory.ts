/**
 * Test helper utilities for creating MindMapNode instances in tests
 * This helper allows flexible node creation with partial properties for testing
 */

import type { MindMapNode } from '@shared/types';

/**
 * Create a test node with default properties that can be overridden
 * Unlike the production createNode, this accepts Partial<MindMapNode> for maximum test flexibility
 */
export function createTestNode(overrides: Partial<MindMapNode>): MindMapNode {
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
