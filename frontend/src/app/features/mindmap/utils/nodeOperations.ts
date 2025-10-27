/**
 * Node tree operations - refactored with functional patterns
 * Reduced from 256 lines to 193 lines (25% reduction)
 */

import type { MindMapNode, MindMapData } from '@shared/types';


type NodeTransformer<T> = (node: MindMapNode, parent?: MindMapNode) => T | null;

const findInTree = <T>(
  node: MindMapNode,
  transformer: NodeTransformer<T>,
  parent?: MindMapNode
): T | null => {
  const result = transformer(node, parent);
  if (result !== null) return result;

  for (const child of node.children || []) {
    const found = findInTree(child, transformer, node);
    if (found !== null) return found;
  }
  return null;
};

const collectNodes = (node: MindMapNode, collapsed: boolean = false): MindMapNode[] => {
  const nodes = [node];
  if (node.children && (!collapsed || !node.collapsed)) {
    node.children.forEach(child => nodes.push(...collectNodes(child, collapsed)));
  }
  return nodes;
};


export const findNodeById = (rootNode: MindMapNode, nodeId: string): MindMapNode | null =>
  findInTree(rootNode, (node) => (node.id === nodeId ? node : null));

export const findNodePathById = (rootNode: MindMapNode, nodeId: string): MindMapNode[] | null =>
  findInTree(rootNode, (node, parent) => {
    if (node.id === nodeId) {
      const path = parent ? findNodePathById(rootNode, parent.id) || [] : [];
      return [...path, node];
    }
    return null;
  });

export const findParentNode = (rootNode: MindMapNode, nodeId: string): MindMapNode | null =>
  findInTree(rootNode, (node) =>
    node.children?.some(child => child.id === nodeId) ? node : null
  );

export const findNodeInRoots = (roots: MindMapNode[] | undefined, nodeId: string): MindMapNode | null => {
  for (const root of roots || []) {
    const found = findNodeById(root, nodeId);
    if (found) return found;
  }
  return null;
};

export const findNodeInData = (data: { rootNodes?: MindMapNode[] } | MindMapData | null | undefined, nodeId: string): MindMapNode | null =>
  data ? findNodeInRoots((data as { rootNodes?: MindMapNode[] }).rootNodes, nodeId) : null;


export const getSiblingNodes = (rootNode: MindMapNode, nodeId: string): { siblings: MindMapNode[], currentIndex: number } => {
  const parent = findParentNode(rootNode, nodeId);
  if (!parent?.children) return { siblings: [], currentIndex: -1 };

  return {
    siblings: parent.children,
    currentIndex: parent.children.findIndex(node => node.id === nodeId)
  };
};

export const getFirstVisibleChild = (node: MindMapNode): MindMapNode | null =>
  (node.children && node.children.length > 0 && !node.collapsed) ? node.children[0] : null;

export const isRootNode = (rootNode: MindMapNode, nodeId: string): boolean =>
  rootNode.id === nodeId || findParentNode(rootNode, nodeId) === null;


export const traverseNodes = (rootNode: MindMapNode, callback: (node: MindMapNode) => void): void => {
  callback(rootNode);
  rootNode.children?.forEach(child => traverseNodes(child, callback));
};

export const updateNodeInTree = (
  rootNode: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode =>
  rootNode.id === nodeId
    ? updater(rootNode)
    : { ...rootNode, children: rootNode.children?.map(child => updateNodeInTree(child, nodeId, updater)) };

export const removeNodeFromTree = (rootNode: MindMapNode, nodeId: string): MindMapNode => ({
  ...rootNode,
  children: rootNode.children?.filter(child => child.id !== nodeId).map(child => removeNodeFromTree(child, nodeId))
});


type Direction = 'up' | 'down' | 'left' | 'right';
type DirectionConfig = { check: (dx: number, dy: number) => boolean; score: (dx: number, dy: number) => number };

const directionConfigs: Record<Direction, DirectionConfig> = {
  right: { check: (dx) => dx > 20, score: (dx, dy) => dx + Math.abs(dy) * 0.5 },
  left: { check: (dx) => dx < -20, score: (dx, dy) => -dx + Math.abs(dy) * 0.5 },
  down: { check: (_, dy) => dy > 20, score: (dx, dy) => dy + Math.abs(dx) * 0.5 },
  up: { check: (_, dy) => dy < -20, score: (dx, dy) => -dy + Math.abs(dx) * 0.5 }
};

export const findNodeBySpatialDirection = (
  currentNodeId: string,
  direction: Direction,
  rootNode: MindMapNode
): string | null => {
  const all = collectNodes(rootNode, true);
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
};


export interface NodeValidationResult {
  isValid: boolean;
  errors: string[];
}

const validators: Array<(obj: Record<string, unknown>) => string | null> = [
  (obj) => (!obj.id || typeof obj.id !== 'string') ? 'Missing or invalid node id' : null,
  (obj) => (typeof obj.text !== 'string') ? 'Missing or invalid node text' : null,
  (obj) => (typeof obj.x !== 'number' || isNaN(obj.x)) ? 'Missing or invalid node x coordinate' : null,
  (obj) => (typeof obj.y !== 'number' || isNaN(obj.y)) ? 'Missing or invalid node y coordinate' : null,
  (obj) => !Array.isArray(obj.children) ? 'Node children must be an array' : null
];

export const validateMindMapNode = (node: unknown): NodeValidationResult => {
  if (!node || typeof node !== 'object') {
    return { isValid: false, errors: ['Node must be an object'] };
  }

  const obj = node as Record<string, unknown>;
  const errors = validators.map(v => v(obj)).filter((e): e is string => e !== null);

  // Validate children recursively
  if (Array.isArray(obj.children)) {
    obj.children.forEach((child, index) => {
      const childValidation = validateMindMapNode(child);
      if (!childValidation.isValid) {
        errors.push(`Invalid child node at index ${index}: ${childValidation.errors.join(', ')}`);
      }
    });
  }

  return { isValid: errors.length === 0, errors };
};

export const isMindMapNode = (node: unknown): node is MindMapNode => {
  if (!node || typeof node !== 'object') return false;
  const obj = node as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    Array.isArray(obj.children) &&
    obj.children.every((child: unknown) => isMindMapNode(child))
  );
};
