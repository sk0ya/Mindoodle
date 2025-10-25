/**
 * Tree and hierarchical data manipulation utilities
 * Generic helpers for tree structures and nested data
 */

export interface TreeNode<T = unknown> {
  id: string;
  children?: TreeNode<T>[];
  [key: string]: unknown;
}

// === Tree Traversal ===

/**
 * Depth-first search through tree
 */
export function* walkTree<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): Generator<T> {
  for (const node of nodes) {
    yield node;
    const children = node[childrenKey] as unknown as T[] | undefined;
    if (children?.length) {
      yield* walkTree(children, childrenKey);
    }
  }
}

/**
 * Breadth-first search through tree
 */
export function* walkTreeBreadthFirst<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): Generator<T> {
  const queue = [...nodes];
  while (queue.length > 0) {
    const node = queue.shift()!;
    yield node;
    const children = node[childrenKey] as unknown as T[] | undefined;
    if (children?.length) {
      queue.push(...children);
    }
  }
}

/**
 * Find node in tree by predicate
 */
export function findInTree<T extends TreeNode>(
  nodes: T[],
  predicate: (node: T) => boolean,
  childrenKey: keyof T = 'children' as keyof T
): T | null {
  for (const node of walkTree(nodes, childrenKey)) {
    if (predicate(node)) return node;
  }
  return null;
}

/**
 * Find node by ID
 */
export function findById<T extends TreeNode>(
  nodes: T[],
  id: string,
  childrenKey: keyof T = 'children' as keyof T
): T | null {
  return findInTree(nodes, node => node.id === id, childrenKey);
}

/**
 * Find parent of a node
 */
export function findParent<T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): T | null {
  for (const node of nodes) {
    const children = node[childrenKey] as unknown as T[] | undefined;
    if (children?.some(child => child.id === targetId)) {
      return node;
    }
    if (children?.length) {
      const parent = findParent(children, targetId, childrenKey);
      if (parent) return parent;
    }
  }
  return null;
}

/**
 * Get all ancestors of a node
 */
export function getAncestors<T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): T[] {
  const ancestors: T[] = [];
  let currentId = targetId;

  while (true) {
    const parent = findParent(nodes, currentId, childrenKey);
    if (!parent) break;
    ancestors.unshift(parent);
    currentId = parent.id;
  }

  return ancestors;
}

/**
 * Get all descendants of a node
 */
export function getDescendants<T extends TreeNode>(
  node: T,
  childrenKey: keyof T = 'children' as keyof T
): T[] {
  const children = node[childrenKey] as unknown as T[] | undefined;
  if (!children?.length) return [];

  return Array.from(walkTree(children, childrenKey));
}

/**
 * Map tree nodes with transformation function
 */
export function mapTree<T extends TreeNode, R extends TreeNode>(
  nodes: T[],
  fn: (node: T) => R,
  childrenKey: keyof T = 'children' as keyof T
): R[] {
  return nodes.map(node => {
    const transformed = fn(node);
    const children = node[childrenKey] as unknown as T[] | undefined;

    if (children?.length) {
      return {
        ...transformed,
        [childrenKey]: mapTree(children, fn, childrenKey)
      } as R;
    }

    return transformed;
  });
}

/**
 * Filter tree nodes
 */
export function filterTree<T extends TreeNode>(
  nodes: T[],
  predicate: (node: T) => boolean,
  childrenKey: keyof T = 'children' as keyof T
): T[] {
  return nodes
    .filter(predicate)
    .map(node => {
      const children = node[childrenKey] as unknown as T[] | undefined;
      if (!children?.length) return node;

      return {
        ...node,
        [childrenKey]: filterTree(children, predicate, childrenKey)
      } as T;
    });
}

/**
 * Reduce tree to single value
 */
export function reduceTree<T extends TreeNode, R>(
  nodes: T[],
  fn: (acc: R, node: T) => R,
  initial: R,
  childrenKey: keyof T = 'children' as keyof T
): R {
  return Array.from(walkTree(nodes, childrenKey)).reduce(fn, initial);
}

/**
 * Flatten tree to array
 */
export function flattenTree<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): T[] {
  return Array.from(walkTree(nodes, childrenKey));
}

/**
 * Get tree depth
 */
export function getTreeDepth<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): number {
  if (!nodes.length) return 0;

  return Math.max(
    ...nodes.map(node => {
      const children = node[childrenKey] as unknown as T[] | undefined;
      return 1 + (children?.length ? getTreeDepth(children, childrenKey) : 0);
    })
  );
}

/**
 * Count total nodes in tree
 */
export function countNodes<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): number {
  return flattenTree(nodes, childrenKey).length;
}

/**
 * Get siblings of a node
 */
export function getSiblings<T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): { siblings: T[]; index: number } | null {
  const parent = findParent(nodes, targetId, childrenKey);
  const siblings = parent
    ? (parent[childrenKey] as unknown as T[] | undefined) || []
    : nodes;

  const index = siblings.findIndex(node => node.id === targetId);
  return index >= 0 ? { siblings, index } : null;
}

/**
 * Sort tree nodes
 */
export function sortTree<T extends TreeNode>(
  nodes: T[],
  compareFn: (a: T, b: T) => number,
  childrenKey: keyof T = 'children' as keyof T
): T[] {
  return [...nodes]
    .sort(compareFn)
    .map(node => {
      const children = node[childrenKey] as unknown as T[] | undefined;
      if (!children?.length) return node;

      return {
        ...node,
        [childrenKey]: sortTree(children, compareFn, childrenKey)
      } as T;
    });
}

// === Tree Building ===

/**
 * Build tree from flat array with parent references
 */
export function buildTree<T extends { id: string; parentId?: string | null }>(
  items: T[],
  rootParentId: string | null = null
): Array<T & { children?: Array<T & { children?: unknown }> }> {
  const itemMap = new Map(items.map(item => [item.id, { ...item, children: [] }]));

  const roots: Array<T & { children?: Array<T & { children?: unknown }> }> = [];

  for (const item of items) {
    const node = itemMap.get(item.id)!;
    if (item.parentId === rootParentId || !item.parentId) {
      roots.push(node);
    } else {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  }

  return roots;
}

/**
 * Convert tree to flat array with parent references
 */
export function treeToFlat<T extends TreeNode>(
  nodes: T[],
  parentId: string | null = null,
  childrenKey: keyof T = 'children' as keyof T
): Array<T & { parentId: string | null }> {
  const result: Array<T & { parentId: string | null }> = [];

  for (const node of nodes) {
    const { [childrenKey]: children, ...rest } = node;
    result.push({ ...rest, parentId } as T & { parentId: string | null });

    if (children?.length) {
      result.push(
        ...treeToFlat(children as T[], node.id, childrenKey)
      );
    }
  }

  return result;
}
