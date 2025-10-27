/**
 * Tree and hierarchical data manipulation utilities
 * Generic helpers for tree structures and nested data
 */

export interface TreeNode<T = unknown> {
  id: string;
  children?: TreeNode<T>[];
  [key: string]: unknown;
}

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

export const flattenTree = <T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): T[] => Array.from(walkTree(nodes, childrenKey));

export const countNodes = <T extends TreeNode>(
  nodes: T[],
  childrenKey: keyof T = 'children' as keyof T
): number => flattenTree(nodes, childrenKey).length;

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
