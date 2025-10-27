/**
 * Functional utilities for node operations
 * Declarative helpers for mindmap node manipulation
 */

import type { MindMapNode } from '@shared/types';


export const hasChildren = (node: MindMapNode): boolean =>
  !!node.children && node.children.length > 0;

export const isCollapsed = (node: MindMapNode): boolean =>
  !!node.collapsed;

export const isExpanded = (node: MindMapNode): boolean =>
  !node.collapsed;

export const isCheckbox = (node: MindMapNode): boolean =>
  !!node.markdownMeta?.isCheckbox;

export const isChecked = (node: MindMapNode): boolean =>
  !!node.markdownMeta?.isChecked;

export const hasImage = (node: MindMapNode): boolean =>
  // Consider either explicit custom image dimensions or an <img> tag in note as image presence
  !!node.customImageWidth || !!node.customImageHeight || (node.note ? /<img\s/i.test(node.note) : false);



export const expand = setCollapsed(false);
export const collapse = setCollapsed(true);



/**
 * Map over all nodes in tree (depth-first)
 */
export const mapTree = (fn: (node: MindMapNode) => MindMapNode) =>
  (node: MindMapNode): MindMapNode => {
    const transformed = fn(node);
    if (!transformed.children) return transformed;

    return {
      ...transformed,
      children: transformed.children.map(mapTree(fn))
    };
  };

/**
 * Filter nodes in tree
 */
export const filterTree = (predicate: (node: MindMapNode) => boolean) =>
  (node: MindMapNode): MindMapNode | null => {
    if (!predicate(node)) return null;

    if (!node.children) return node;

    const filteredChildren = node.children
      .map(filterTree(predicate))
      .filter((n): n is MindMapNode => n !== null);

    return {
      ...node,
      children: filteredChildren
    };
  };

/**
 * Find node by predicate
 */
export const findNode = (predicate: (node: MindMapNode) => boolean) =>
  (root: MindMapNode): MindMapNode | null => {
    if (predicate(root)) return root;

    if (!root.children) return null;

    for (const child of root.children) {
      const found = findNode(predicate)(child);
      if (found) return found;
    }

    return null;
  };

/**
 * Find node by ID
 */
export const flatten = (root: MindMapNode): MindMapNode[] => {
  const nodes: MindMapNode[] = [root];

  const traverse = (node: MindMapNode) => {
    if (node.children) {
      node.children.forEach(child => {
        nodes.push(child);
        traverse(child);
      });
    }
  };

  traverse(root);
  return nodes;
};

/**
 * Get visible nodes (respecting collapsed state)
 */
export const getSiblings = (root: MindMapNode, targetId: string): MindMapNode[] => {
  const parent = getParent(root, targetId);
  return parent?.children ?? [];
};

/**
 * Get sibling index
 */
export const updateNode = (id: string, updater: (node: MindMapNode) => MindMapNode) =>
  mapTree(node => node.id === id ? updater(node) : node);

/**
 * Remove node by ID
 */
export const appendChild = (parentId: string, child: MindMapNode) =>
  insertChild(parentId, child);

/**
 * Prepend child
 */


export const countNodes = (root: MindMapNode): number =>
  1 + (root.children?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);









export const cloneNode = (node: MindMapNode): MindMapNode => ({
  ...node,
  children: node.children?.map(cloneNode)
});
