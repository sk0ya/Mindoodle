/**
 * Tree and hierarchical data manipulation utilities
 * Generic helpers for tree structures and nested data
 */

export interface TreeNode<T = unknown> {
  id: string;
  children?: TreeNode<T>[];
  [key: string]: unknown;
}

// === Common Helpers ===

const getChildren = <T extends TreeNode>(node: T, key: keyof T = 'children' as keyof T): T[] | undefined =>
  node[key] as unknown as T[] | undefined;

const transformNode = <T extends TreeNode, R extends TreeNode>(
  node: T,
  fn: (node: T, children: R[]) => R,
  childrenKey: keyof T,
  processChildren: (children: T[]) => R[]
): R => {
  const children = getChildren(node, childrenKey);
  const transformedChildren = children?.length ? processChildren(children) : undefined;
  return fn(node, transformedChildren || []);
};

// === Tree Traversal ===

export function* walkTree<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): Generator<T> {
  for (const node of nodes) {
    yield node;
    const children = getChildren(node, childrenKey);
    if (children?.length) yield* walkTree(children, childrenKey);
  }
}

export function* walkTreeBreadthFirst<T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): Generator<T> {
  const queue = [...nodes];
  while (queue.length > 0) {
    const node = queue.shift()!;
    yield node;
    const children = getChildren(node, childrenKey);
    if (children?.length) queue.push(...children);
  }
}

export const findInTree = <T extends TreeNode>(
  nodes: T[],
  predicate: (node: T) => boolean,
  childrenKey: keyof T = 'children' as keyof T
): T | null => {
  for (const node of walkTree(nodes, childrenKey)) {
    if (predicate(node)) return node;
  }
  return null;
};

export const findById = <T extends TreeNode>(
  nodes: T[],
  id: string,
  childrenKey: keyof T = 'children' as keyof T
): T | null => findInTree(nodes, node => node.id === id, childrenKey);

export const findParent = <T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): T | null => {
  for (const node of nodes) {
    const children = getChildren(node, childrenKey);
    if (children?.some(child => child.id === targetId)) return node;
    if (children?.length) {
      const parent = findParent(children, targetId, childrenKey);
      if (parent) return parent;
    }
  }
  return null;
};

export const getAncestors = <T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): T[] => {
  const ancestors: T[] = [];
  let currentId = targetId;
  while (true) {
    const parent = findParent(nodes, currentId, childrenKey);
    if (!parent) break;
    ancestors.unshift(parent);
    currentId = parent.id;
  }
  return ancestors;
};

export const getDescendants = <T extends TreeNode>(
  node: T,
  childrenKey: keyof T = 'children' as keyof T
): T[] => {
  const children = getChildren(node, childrenKey);
  return children?.length ? Array.from(walkTree(children, childrenKey)) : [];
};

export const mapTree = <T extends TreeNode, R extends TreeNode>(
  nodes: T[],
  fn: (node: T) => R,
  childrenKey: keyof T = 'children' as keyof T
): R[] =>
  nodes.map(node =>
    transformNode(
      node,
      (n, transformedChildren) => ({
        ...fn(n),
        ...(transformedChildren.length ? { [childrenKey]: transformedChildren } : {})
      }) as R,
      childrenKey,
      children => mapTree(children, fn, childrenKey)
    )
  );

export const filterTree = <T extends TreeNode>(
  nodes: T[],
  predicate: (node: T) => boolean,
  childrenKey: keyof T = 'children' as keyof T
): T[] =>
  nodes.filter(predicate).map(node =>
    transformNode(
      node,
      (n, transformedChildren) => ({
        ...n,
        ...(transformedChildren.length ? { [childrenKey]: transformedChildren } : {})
      }) as T,
      childrenKey,
      children => filterTree(children, predicate, childrenKey)
    )
  );

export const reduceTree = <T extends TreeNode, R>(
  nodes: T[],
  fn: (acc: R, node: T) => R,
  initial: R,
  childrenKey: keyof T = 'children' as keyof T
): R => Array.from(walkTree(nodes, childrenKey)).reduce(fn, initial);

export const flattenTree = <T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): T[] => Array.from(walkTree(nodes, childrenKey));

export const getTreeDepth = <T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): number =>
  !nodes.length
    ? 0
    : Math.max(...nodes.map(node => {
        const children = getChildren(node, childrenKey);
        return 1 + (children?.length ? getTreeDepth(children, childrenKey) : 0);
      }));

export const countNodes = <T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): number => flattenTree(nodes, childrenKey).length;

export const getSiblings = <T extends TreeNode>(
  nodes: T[],
  targetId: string,
  childrenKey: keyof T = 'children' as keyof T
): { siblings: T[]; index: number } | null => {
  const parent = findParent(nodes, targetId, childrenKey);
  const siblings = parent ? (getChildren(parent, childrenKey) || []) : nodes;
  const index = siblings.findIndex(node => node.id === targetId);
  return index >= 0 ? { siblings, index } : null;
};

export const sortTree = <T extends TreeNode>(
  nodes: T[],
  compareFn: (a: T, b: T) => number,
  childrenKey: keyof T = 'children' as keyof T
): T[] =>
  [...nodes].sort(compareFn).map(node =>
    transformNode(
      node,
      (n, transformedChildren) => ({
        ...n,
        ...(transformedChildren.length ? { [childrenKey]: transformedChildren } : {})
      }) as T,
      childrenKey,
      children => sortTree(children, compareFn, childrenKey)
    )
  );

// === Tree Building ===

export const buildTree = <T extends { id: string; parentId?: string | null }>(
  items: T[],
  rootParentId: string | null = null
): Array<T & { children?: T[] }> => {
  const itemMap = new Map<string, T & { children: T[] }>(items.map(item => [item.id, { ...(item as T), children: [] }]));
  const roots: Array<T & { children?: T[] }> = [];

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
};

export const treeToFlat = <T extends TreeNode>(
  nodes: T[],
  parentId: string | null = null,
  childrenKey: keyof T = 'children' as keyof T
): Array<T & { parentId: string | null }> =>
  nodes.flatMap(node => {
    const children = (node as any)[childrenKey] as T[] | undefined;
    const rest = { ...(node as any) } as T;
    delete (rest as any)[childrenKey as any];
    return [
      { ...(rest as any), parentId } as T & { parentId: string | null },
      ...(children?.length ? treeToFlat(children, node.id, childrenKey) : [])
    ];
  });
