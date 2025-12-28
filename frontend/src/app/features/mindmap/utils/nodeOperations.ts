/**
 * Node tree operations - refactored with functional patterns
 * Reduced from 256 lines to 193 lines (25% reduction)
 * Now uses shared treeUtils for tree operations
 */

import type { MindMapNode, MindMapData } from '@shared/types';
import {
  findNodeByIdInRoot,
  findNodePath,
  findParentNodeSimple,
  getSiblingsInRoot,
  getFirstVisibleChild,
  isRootNode as isRootNodeUtil,
  findNodeById as findNodeByIdInRoots
} from '@shared/utils/treeUtils';

// === Find Operations ===

export const findNodeById = findNodeByIdInRoot;

export const findNodePathById = (rootNode: MindMapNode, nodeId: string): MindMapNode[] | null =>
  findNodePath([rootNode], nodeId);

export const findParentNode = (rootNode: MindMapNode, nodeId: string): MindMapNode | null =>
  findParentNodeSimple([rootNode], nodeId);

export const findNodeInRoots = (roots: MindMapNode[] | undefined, nodeId: string): MindMapNode | null => {
  return roots ? findNodeByIdInRoots(roots, nodeId) : null;
};

export const findNodeInData = (data: { rootNodes?: MindMapNode[] } | MindMapData | null | undefined, nodeId: string): MindMapNode | null =>
  data ? findNodeInRoots((data as { rootNodes?: MindMapNode[] }).rootNodes, nodeId) : null;

// === Node Queries ===

export const getSiblingNodes = getSiblingsInRoot;

export { getFirstVisibleChild };

export const isRootNode = (rootNode: MindMapNode, nodeId: string): boolean =>
  isRootNodeUtil([rootNode], nodeId);

// === Tree Mutations ===

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

// === Spatial Navigation ===

export { findNodeBySpatialDirection } from '@shared/utils/treeUtils';

// === Validation ===

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
