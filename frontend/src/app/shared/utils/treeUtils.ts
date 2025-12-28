/**
 * MindMap tree utilities - consolidated from multiple implementations
 * Provides type-safe, functional tree operations for MindMapNode structures
 */

import type { MindMapNode } from '@shared/types';

// === Core Find Operations ===

/**
 * Find a node by ID in a tree of nodes
 * Consolidated from sliceHelpers, nodeOperations, and inline implementations
 */
export function findNodeById(roots: MindMapNode[], nodeId: string): MindMapNode | null {
  for (const root of roots) {
    const found = findNodeByIdInRoot(root, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Find a node by ID in a single root node
 * Useful for single-tree operations
 */
export function findNodeByIdInRoot(root: MindMapNode, nodeId: string): MindMapNode | null {
  if (root.id === nodeId) return root;

  for (const child of root.children) {
    const found = findNodeByIdInRoot(child, nodeId);
    if (found) return found;
  }

  return null;
}

/**
 * Find parent node and child index
 * Returns both parent reference and position for efficient operations
 */
export function findParentNode(
  roots: MindMapNode[],
  targetId: string
): { parent: MindMapNode; index: number } | null {
  for (const root of roots) {
    const result = findParentInNode(root, targetId);
    if (result) return result;
  }
  return null;
}

function findParentInNode(
  node: MindMapNode,
  targetId: string
): { parent: MindMapNode; index: number } | null {
  const index = node.children.findIndex(child => child.id === targetId);
  if (index !== -1) {
    return { parent: node, index };
  }

  for (const child of node.children) {
    const result = findParentInNode(child, targetId);
    if (result) return result;
  }

  return null;
}

/**
 * Find parent node without index
 * Simpler alternative when index is not needed
 */
export function findParentNodeSimple(roots: MindMapNode[], targetId: string): MindMapNode | null {
  const result = findParentNode(roots, targetId);
  return result ? result.parent : null;
}

/**
 * Find node path from root to target
 * Returns array of nodes from root to target (inclusive)
 */
export function findNodePath(roots: MindMapNode[], targetId: string): MindMapNode[] | null {
  const path: MindMapNode[] = [];

  function search(nodes: MindMapNode[], currentPath: MindMapNode[]): boolean {
    for (const node of nodes) {
      const newPath = [...currentPath, node];
      if (node.id === targetId) {
        path.push(...newPath);
        return true;
      }
      if (node.children.length > 0 && search(node.children, newPath)) {
        return true;
      }
    }
    return false;
  }

  return search(roots, []) ? path : null;
}

// === Sibling Operations ===

/**
 * Get siblings and current index for a node
 * Handles both root-level and nested nodes
 */
export function getSiblings(
  roots: MindMapNode[],
  nodeId: string
): { siblings: MindMapNode[]; index: number } | null {
  const parentInfo = findParentNode(roots, nodeId);
  if (parentInfo) {
    return { siblings: parentInfo.parent.children, index: parentInfo.index };
  }

  // Check if it's a root node
  const index = roots.findIndex(node => node.id === nodeId);
  return index !== -1 ? { siblings: roots, index } : null;
}

/**
 * Get siblings for a node within a single root
 */
export function getSiblingsInRoot(
  root: MindMapNode,
  targetId: string
): { siblings: MindMapNode[]; currentIndex: number } {
  const parent = findParentNodeSimple([root], targetId);
  const siblings = parent?.children || [root];
  const currentIndex = siblings.findIndex(n => n.id === targetId);
  return { siblings, currentIndex };
}

// === Tree Traversal ===

/**
 * Traverse tree with callback
 * Generic depth-first traversal
 */
export function traverseTree(
  roots: MindMapNode[],
  callback: (node: MindMapNode, parent: MindMapNode | null, depth: number) => void
): void {
  function traverse(nodes: MindMapNode[], parent: MindMapNode | null, depth: number): void {
    for (const node of nodes) {
      callback(node, parent, depth);
      if (node.children.length > 0) {
        traverse(node.children, node, depth + 1);
      }
    }
  }
  traverse(roots, null, 0);
}

/**
 * Flatten tree to array (depth-first)
 * Returns all nodes in traversal order
 */
export function flattenNodes(roots: MindMapNode[]): MindMapNode[] {
  const result: MindMapNode[] = [];

  function flatten(node: MindMapNode): void {
    result.push(node);
    for (const child of node.children) {
      flatten(child);
    }
  }

  for (const root of roots) {
    flatten(root);
  }

  return result;
}

/**
 * Flatten only visible nodes (respects collapsed state)
 * Used for rendering and navigation
 */
export function flattenVisibleNodes(root: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [];
  const stack: MindMapNode[] = [root];

  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    result.push(node);
    if (!node.collapsed && node.children?.length) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  return result;
}

// === Node Queries ===

/**
 * Get node depth in tree (0-indexed from root)
 */
export function getNodeDepth(roots: MindMapNode[], nodeId: string): number {
  let depth = -1;

  traverseTree(roots, (node, _parent, d) => {
    if (node.id === nodeId) {
      depth = d;
    }
  });

  return depth;
}

/**
 * Check if node is an ancestor of another node
 */
export function isAncestor(
  roots: MindMapNode[],
  ancestorId: string,
  descendantId: string
): boolean {
  const ancestor = findNodeById(roots, ancestorId);
  return ancestor ? findNodeByIdInRoot(ancestor, descendantId) !== null : false;
}

/**
 * Check if node is a root node
 */
export function isRootNode(roots: MindMapNode[], nodeId: string): boolean {
  return roots.some(root => root.id === nodeId);
}

/**
 * Get first visible child of a node
 */
export function getFirstVisibleChild(node: MindMapNode): MindMapNode | null {
  return (node.children && node.children.length > 0 && !node.collapsed)
    ? node.children[0]
    : null;
}

/**
 * Find node by markdown line number
 */
export function findNodeByMarkdownLine(
  rootNodes: MindMapNode[],
  line: number
): string | null {
  const stack = [...rootNodes];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.markdownMeta?.lineNumber === line) return n.id;
    if (n.children?.length) stack.push(...n.children);
  }
  return null;
}

// === Spatial Navigation ===

type Direction = 'up' | 'down' | 'left' | 'right';
type DirectionConfig = {
  check: (dx: number, dy: number) => boolean;
  score: (dx: number, dy: number) => number;
};

const directionConfigs: Record<Direction, DirectionConfig> = {
  right: { check: (dx) => dx > 20, score: (dx, dy) => dx + Math.abs(dy) * 0.5 },
  left: { check: (dx) => dx < -20, score: (dx, dy) => -dx + Math.abs(dy) * 0.5 },
  down: { check: (_, dy) => dy > 20, score: (dx, dy) => dy + Math.abs(dx) * 0.5 },
  up: { check: (_, dy) => dy < -20, score: (dx, dy) => -dy + Math.abs(dx) * 0.5 }
};

/**
 * Find node by spatial direction
 * Used for arrow key navigation in canvas
 */
export function findNodeBySpatialDirection(
  currentNodeId: string,
  direction: Direction,
  rootNode: MindMapNode
): string | null {
  const all = flattenVisibleNodes(rootNode);
  const current = all.find((n) => n.id === currentNodeId);
  if (!current) return null;

  const config = directionConfigs[direction];
  let best: MindMapNode | null = null;
  let bestScore = Infinity;

  for (const node of all) {
    if (node.id === currentNodeId) continue;
    const dx = node.x - current.x;
    const dy = node.y - current.y;

    if (config.check(dx, dy)) {
      const score = config.score(dx, dy);
      if (score < bestScore) {
        best = node;
        bestScore = score;
      }
    }
  }

  return best?.id ?? null;
}

// === Utility Functions ===

/**
 * Clone a node tree (deep copy)
 */
export function cloneNodeTree(node: MindMapNode): MindMapNode {
  return {
    ...node,
    children: node.children.map(cloneNodeTree)
  };
}

/**
 * Get all nodes in tree (alias for flattenNodes)
 */
export function getAllNodes(roots: MindMapNode[]): MindMapNode[] {
  return flattenNodes(roots);
}

/**
 * Count total nodes in tree
 */
export function countNodes(roots: MindMapNode[]): number {
  return flattenNodes(roots).length;
}
