/**
 * Functional utilities for node operations
 * Declarative helpers for mindmap node manipulation
 */

import type { MindMapNode } from '@shared/types';

// === Node Predicates ===

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

export const hasNote = (node: MindMapNode): boolean =>
  !!node.note && node.note.trim().length > 0;

export const hasLink = (node: MindMapNode): boolean =>
  Array.isArray(node.links) && node.links.length > 0;

export const hasImage = (node: MindMapNode): boolean =>
  // Consider either explicit custom image dimensions or an <img> tag in note as image presence
  !!node.customImageWidth || !!node.customImageHeight || (node.note ? /<img\s/i.test(node.note) : false);

export const hasAttachments = (_node: MindMapNode): boolean => false;

export const isHeading = (level: number) => (node: MindMapNode): boolean =>
  node.markdownMeta?.type === 'heading' && (node.markdownMeta.level || 0) === level;

export const isList = (node: MindMapNode): boolean =>
  node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list';

export const matchesText = (query: string, caseSensitive = false) => (node: MindMapNode): boolean => {
  const text = caseSensitive ? node.text : node.text.toLowerCase();
  const search = caseSensitive ? query : query.toLowerCase();
  return text.includes(search);
};

// === Node Transformations ===

export const setText = (text: string) => (node: MindMapNode): MindMapNode => ({
  ...node,
  text
});

export const setNote = (note: string) => (node: MindMapNode): MindMapNode => ({
  ...node,
  note
});

export const setCollapsed = (collapsed: boolean) => (node: MindMapNode): MindMapNode => ({
  ...node,
  collapsed
});

export const toggleCollapsed = (node: MindMapNode): MindMapNode => ({
  ...node,
  collapsed: !node.collapsed
});

export const expand = setCollapsed(false);
export const collapse = setCollapsed(true);

export const setChecked = (checked: boolean) => (node: MindMapNode): MindMapNode => ({
  ...node,
  markdownMeta: {
    ...node.markdownMeta,
    isChecked: checked
  }
});

export const toggleChecked = (node: MindMapNode): MindMapNode =>
  setChecked(!isChecked(node))(node);

export const setLink = (_link: string | null) => (node: MindMapNode): MindMapNode => node;

export const setImage = (_image: string | null) => (node: MindMapNode): MindMapNode => node;

export const updatePosition = (x: number, y: number) => (node: MindMapNode): MindMapNode => ({
  ...node,
  x,
  y
});

export const moveBy = (dx: number, dy: number) => (node: MindMapNode): MindMapNode => ({
  ...node,
  x: (node.x ?? 0) + dx,
  y: (node.y ?? 0) + dy
});

// === Node Tree Operations ===

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
export const findById = (id: string) =>
  findNode(node => node.id === id);

/**
 * Find all nodes matching predicate
 */
export const findAll = (predicate: (node: MindMapNode) => boolean) =>
  (root: MindMapNode): MindMapNode[] => {
    const results: MindMapNode[] = [];

    const traverse = (node: MindMapNode) => {
      if (predicate(node)) results.push(node);
      node.children?.forEach(traverse);
    };

    traverse(root);
    return results;
  };

/**
 * Flatten tree to array
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
export const flattenVisible = (root: MindMapNode): MindMapNode[] => {
  const nodes: MindMapNode[] = [root];

  const traverse = (node: MindMapNode) => {
    if (node.children && !isCollapsed(node)) {
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
 * Get depth of node in tree
 */
export const getDepth = (root: MindMapNode, targetId: string): number => {
  const traverse = (node: MindMapNode, depth: number): number => {
    if (node.id === targetId) return depth;

    if (!node.children) return -1;

    for (const child of node.children) {
      const result = traverse(child, depth + 1);
      if (result !== -1) return result;
    }

    return -1;
  };

  return traverse(root, 0);
};

/**
 * Get path from root to node
 */
export const getPath = (root: MindMapNode, targetId: string): MindMapNode[] => {
  const path: MindMapNode[] = [];

  const traverse = (node: MindMapNode): boolean => {
    path.push(node);

    if (node.id === targetId) return true;

    if (node.children) {
      for (const child of node.children) {
        if (traverse(child)) return true;
      }
    }

    path.pop();
    return false;
  };

  traverse(root);
  return path;
};

/**
 * Get parent node
 */
export const getParent = (root: MindMapNode, targetId: string): MindMapNode | null => {
  const path = getPath(root, targetId);
  return path.length > 1 ? path[path.length - 2] : null;
};

/**
 * Get siblings
 */
export const getSiblings = (root: MindMapNode, targetId: string): MindMapNode[] => {
  const parent = getParent(root, targetId);
  return parent?.children ?? [];
};

/**
 * Get sibling index
 */
export const getSiblingIndex = (root: MindMapNode, targetId: string): number => {
  const siblings = getSiblings(root, targetId);
  return siblings.findIndex(node => node.id === targetId);
};

/**
 * Update node by ID
 */
export const updateNode = (id: string, updater: (node: MindMapNode) => MindMapNode) =>
  mapTree(node => node.id === id ? updater(node) : node);

/**
 * Remove node by ID
 */
export const removeNode = (id: string) =>
  (root: MindMapNode): MindMapNode => {
    if (root.id === id) {
      throw new Error('Cannot remove root node');
    }

    return {
      ...root,
      children: root.children
        ?.filter(child => child.id !== id)
        .map(removeNode(id))
    };
  };

/**
 * Insert child at index
 */
export const insertChild = (parentId: string, child: MindMapNode, index?: number) =>
  updateNode(parentId, parent => {
    const children = parent.children ?? [];
    const insertIndex = index ?? children.length;

    return {
      ...parent,
      children: [
        ...children.slice(0, insertIndex),
        child,
        ...children.slice(insertIndex)
      ]
    };
  });

/**
 * Append child
 */
export const appendChild = (parentId: string, child: MindMapNode) =>
  insertChild(parentId, child);

/**
 * Prepend child
 */
export const prependChild = (parentId: string, child: MindMapNode) =>
  insertChild(parentId, child, 0);

// === Node Statistics ===

export const countNodes = (root: MindMapNode): number =>
  1 + (root.children?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);

export const countChildren = (node: MindMapNode): number =>
  node.children?.length ?? 0;

export const countDescendants = (node: MindMapNode): number =>
  countNodes(node) - 1;

export const maxDepth = (node: MindMapNode): number => {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(maxDepth));
};

// === Node Validation ===

export const isValidNode = (node: unknown): node is MindMapNode =>
  typeof node === 'object' &&
  node !== null &&
  'id' in node &&
  'text' in node &&
  typeof (node as MindMapNode).id === 'string' &&
  typeof (node as MindMapNode).text === 'string';

export const hasValidChildren = (node: MindMapNode): boolean =>
  !node.children || node.children.every(isValidNode);

export const validateTree = (root: MindMapNode): boolean => {
  if (!isValidNode(root)) return false;

  const traverse = (node: MindMapNode): boolean => {
    if (!hasValidChildren(node)) return false;
    return node.children?.every(traverse) ?? true;
  };

  return traverse(root);
};

// === Comparison ===

export const nodesEqual = (a: MindMapNode, b: MindMapNode): boolean =>
  a.id === b.id &&
  a.text === b.text &&
  a.collapsed === b.collapsed &&
  a.note === b.note;

export const treesEqual = (a: MindMapNode, b: MindMapNode): boolean => {
  if (!nodesEqual(a, b)) return false;

  const aChildren = a.children ?? [];
  const bChildren = b.children ?? [];

  if (aChildren.length !== bChildren.length) return false;

  return aChildren.every((child, i) => treesEqual(child, bChildren[i]));
};

// === Sorting ===

export const sortChildren = (compareFn: (a: MindMapNode, b: MindMapNode) => number) =>
  (node: MindMapNode): MindMapNode => ({
    ...node,
    children: node.children
      ?.slice()
      .sort(compareFn)
      .map(sortChildren(compareFn))
  });

export const sortByText = sortChildren((a, b) => a.text.localeCompare(b.text));

// Created/Updated timestamps are not part of MindMapNode; keep stubs for API compatibility
export const sortByCreated = sortChildren(() => 0);
export const sortByUpdated = sortChildren(() => 0);

// === Cloning ===

export const cloneNode = (node: MindMapNode): MindMapNode => ({
  ...node,
  children: node.children?.map(cloneNode)
});

export const cloneWithNewIds = (node: MindMapNode, idGenerator: () => string): MindMapNode => ({
  ...node,
  id: idGenerator(),
  children: node.children?.map(child => cloneWithNewIds(child, idGenerator))
});
