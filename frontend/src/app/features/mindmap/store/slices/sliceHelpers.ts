/**
 * Common helpers for Zustand store slices - refactored with functional patterns
 * Reduced from 235 lines to 143 lines (39% reduction)
 */

import type { MindMapNode } from '@shared/types';
import { produce, Draft } from 'immer';


type TreeVisitor<T> = (node: MindMapNode, parent: MindMapNode | null, depth: number) => T | null | undefined;

const traverseTree = <T>(
  nodes: MindMapNode[],
  visitor: TreeVisitor<T>,
  parent: MindMapNode | null = null,
  depth: number = 0
): T | null => {
  for (const node of nodes) {
    const result = visitor(node, parent, depth);
    if (result !== null && result !== undefined) return result;

    const childResult = traverseTree(node.children, visitor, node, depth + 1);
    if (childResult !== null && childResult !== undefined) return childResult;
  }
  return null;
};

const flattenTree = (nodes: MindMapNode[]): MindMapNode[] =>
  nodes.flatMap(node => [node, ...flattenTree(node.children)]);


export function findNodeById(roots: MindMapNode[], nodeId: string): MindMapNode | null {
  return traverseTree(roots, (node) => (node.id === nodeId ? node : null));
}

export function findParentNode(
  roots: MindMapNode[],
  targetId: string
): { parent: MindMapNode; index: number } | null {
  return traverseTree(roots, (node) => {
    const index = node.children.findIndex(child => child.id === targetId);
    return index !== -1 ? { parent: node, index } : null;
  });
}

export function getNodeDepth(roots: MindMapNode[], nodeId: string): number {
  return traverseTree(roots, (node, _, depth) => (node.id === nodeId ? depth : null)) ?? -1;
}

export function isAncestor(
  roots: MindMapNode[],
  ancestorId: string,
  descendantId: string
): boolean {
  const ancestor = findNodeById(roots, ancestorId);
  return ancestor ? findNodeById([ancestor], descendantId) !== null : false;
}

export function getSiblings(
  roots: MindMapNode[],
  nodeId: string
): { siblings: MindMapNode[]; index: number } | null {
  const parentInfo = findParentNode(roots, nodeId);
  if (parentInfo) {
    return { siblings: parentInfo.parent.children, index: parentInfo.index };
  }

  const index = roots.findIndex(node => node.id === nodeId);
  return index !== -1 ? { siblings: roots, index } : null;
}


const withProduce = <T extends unknown[]>(
  operation: (draft: MindMapNode[], ...args: T) => void
) => (roots: MindMapNode[], ...args: T): MindMapNode[] =>
  produce(roots, (draft: Draft<MindMapNode>[]) => operation(draft as MindMapNode[], ...args));

export const updateNodeInTree = withProduce(
  (draft: MindMapNode[], nodeId: string, updates: Partial<MindMapNode>) => {
    const node = findNodeById(draft, nodeId);
    if (node) Object.assign(node, updates);
  }
);

const deleteFromNodes = (nodes: MindMapNode[], nodeId: string): boolean => {
  for (const node of nodes) {
    const index = node.children.findIndex(child => child.id === nodeId);
    if (index !== -1) {
      node.children.splice(index, 1);
      return true;
    }
    if (deleteFromNodes(node.children, nodeId)) return true;
  }
  return false;
};

export const deleteNodeFromTree = withProduce((draft: MindMapNode[], nodeId: string) => {
  const rootIndex = draft.findIndex(node => node.id === nodeId);
  if (rootIndex !== -1) {
    draft.splice(rootIndex, 1);
  } else {
    deleteFromNodes(draft, nodeId);
  }
});

export const moveNodeToParent = withProduce(
  (draft: MindMapNode[], nodeId: string, newParentId: string, index?: number) => {
    const node = findNodeById(draft, nodeId);
    if (!node) return;

    const clonedNode = { ...node };

    // Remove from current location
    const rootIndex = draft.findIndex(n => n.id === nodeId);
    if (rootIndex !== -1) {
      draft.splice(rootIndex, 1);
    } else {
      deleteFromNodes(draft, nodeId);
    }

    // Add to new parent
    const newParent = findNodeById(draft, newParentId);
    if (newParent) {
      if (index !== undefined && index >= 0 && index <= newParent.children.length) {
        newParent.children.splice(index, 0, clonedNode);
      } else {
        newParent.children.push(clonedNode);
      }
    }
  }
);


export const getAllNodes = (roots: MindMapNode[]): MindMapNode[] => flattenTree(roots);

export const cloneNodeTree = (node: MindMapNode): MindMapNode => ({
  ...node,
  children: node.children.map(cloneNodeTree)
});
