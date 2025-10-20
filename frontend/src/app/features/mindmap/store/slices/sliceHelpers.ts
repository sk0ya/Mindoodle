/**
 * Common helpers for Zustand store slices
 */

import type { MindMapNode } from '@shared/types';
import { produce, Draft } from 'immer';

/**
 * Find node in tree by ID
 */
export function findNodeById(
  roots: MindMapNode[],
  nodeId: string
): MindMapNode | null {
  for (const root of roots) {
    if (root.id === nodeId) return root;

    const found = findNodeInChildren(root.children, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Find node in children recursively
 */
function findNodeInChildren(
  children: MindMapNode[],
  nodeId: string
): MindMapNode | null {
  for (const child of children) {
    if (child.id === nodeId) return child;

    const found = findNodeInChildren(child.children, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Find parent node of a target node
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
 * Update node in tree immutably
 */
export function updateNodeInTree(
  roots: MindMapNode[],
  nodeId: string,
  updates: Partial<MindMapNode>
): MindMapNode[] {
  return produce(roots, (draft: Draft<MindMapNode>[]) => {
    const node = findNodeById(draft as MindMapNode[], nodeId);
    if (node) {
      Object.assign(node, updates);
    }
  });
}

/**
 * Delete node from tree
 */
export function deleteNodeFromTree(
  roots: MindMapNode[],
  nodeId: string
): MindMapNode[] {
  return produce(roots, (draft: Draft<MindMapNode>[]) => {
    // Check if it's a root node
    const rootIndex = draft.findIndex(node => node.id === nodeId);
    if (rootIndex !== -1) {
      draft.splice(rootIndex, 1);
      return;
    }

    // Find and delete from children
    deleteNodeFromChildren(draft as MindMapNode[], nodeId);
  });
}

function deleteNodeFromChildren(roots: MindMapNode[], nodeId: string): boolean {
  for (const root of roots) {
    const index = root.children.findIndex(child => child.id === nodeId);
    if (index !== -1) {
      root.children.splice(index, 1);
      return true;
    }

    if (deleteNodeFromChildren(root.children, nodeId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all nodes in tree (flattened)
 */
export function getAllNodes(roots: MindMapNode[]): MindMapNode[] {
  const result: MindMapNode[] = [];

  function traverse(nodes: MindMapNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(roots);
  return result;
}

/**
 * Get node depth in tree
 */
export function getNodeDepth(roots: MindMapNode[], nodeId: string): number {
  function getDepthInNodes(nodes: MindMapNode[], currentDepth: number): number {
    for (const node of nodes) {
      if (node.id === nodeId) return currentDepth;

      const childDepth = getDepthInNodes(node.children, currentDepth + 1);
      if (childDepth !== -1) return childDepth;
    }
    return -1;
  }

  return getDepthInNodes(roots, 0);
}

/**
 * Check if node is ancestor of another node
 */
export function isAncestor(
  roots: MindMapNode[],
  ancestorId: string,
  descendantId: string
): boolean {
  const ancestor = findNodeById(roots, ancestorId);
  if (!ancestor) return false;

  return findNodeById([ancestor], descendantId) !== null;
}

/**
 * Get siblings of a node
 */
export function getSiblings(
  roots: MindMapNode[],
  nodeId: string
): { siblings: MindMapNode[]; index: number } | null {
  const parentInfo = findParentNode(roots, nodeId);
  if (parentInfo) {
    return {
      siblings: parentInfo.parent.children,
      index: parentInfo.index
    };
  }

  // Check if it's a root node
  const index = roots.findIndex(node => node.id === nodeId);
  if (index !== -1) {
    return { siblings: roots, index };
  }

  return null;
}

/**
 * Move node to new parent
 */
export function moveNodeToParent(
  roots: MindMapNode[],
  nodeId: string,
  newParentId: string,
  index?: number
): MindMapNode[] {
  return produce(roots, (draft: Draft<MindMapNode>[]) => {
    const draftRoots = draft as MindMapNode[];

    // Find and remove node from current location
    const node = findNodeById(draftRoots, nodeId);
    if (!node) return;

    const clonedNode = { ...node };
    const deleted = deleteNodeFromTree(draftRoots, nodeId);

    // Find new parent and add node
    const newParent = findNodeById(deleted as MindMapNode[], newParentId);
    if (newParent) {
      if (index !== undefined && index >= 0 && index <= newParent.children.length) {
        newParent.children.splice(index, 0, clonedNode);
      } else {
        newParent.children.push(clonedNode);
      }
    }
  });
}

/**
 * Clone node tree (deep copy)
 */
export function cloneNodeTree(node: MindMapNode): MindMapNode {
  return {
    ...node,
    children: node.children.map(child => cloneNodeTree(child))
  };
}
