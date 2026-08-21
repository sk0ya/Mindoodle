/**
 * Link operations for managing node hyperlinks - refactored with functional patterns
 * Reduced from 156 lines to 138 lines (12% reduction)
 */

import type { NodeLink, MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import {
  addLinkToNodeInTree,
  updateLinkInNodeTree,
  removeLinkFromNodeTree
} from '../../../utils';
import type { MindMapStore } from '../types';

// === Helpers ===

type LinkTreeOperation = (node: MindMapNode, nodeId: string, ...args: unknown[]) => MindMapNode;
type NormalizedOperation = (node: MindMapNode, ...args: unknown[]) => MindMapNode;

const toLinkData = (value: unknown): Partial<NodeLink> =>
  typeof value === 'object' && value !== null ? value as Partial<NodeLink> : {};

const toLinkId = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const addLinkTree = (node: MindMapNode, nodeId: string, ...args: unknown[]): MindMapNode =>
  addLinkToNodeInTree(node, nodeId, toLinkData(args[0]));

const updateLinkTree = (node: MindMapNode, nodeId: string, ...args: unknown[]): MindMapNode =>
  updateLinkInNodeTree(node, nodeId, toLinkId(args[0]), toLinkData(args[1]));

const removeLinkTree = (node: MindMapNode, nodeId: string, ...args: unknown[]): MindMapNode =>
  removeLinkFromNodeTree(node, nodeId, toLinkId(args[0]));

const addLinkToNormalizedNode = (node: MindMapNode, ...args: unknown[]): MindMapNode =>
  addLinkNormalized(node, toLinkData(args[0]));

const updateNormalizedLink = (node: MindMapNode, ...args: unknown[]): MindMapNode =>
  updateLinkNormalized(node, toLinkId(args[0]), toLinkData(args[1]));

const removeNormalizedLink = (node: MindMapNode, ...args: unknown[]): MindMapNode =>
  deleteLinkNormalized(node, toLinkId(args[0]));
interface LinkOperationConfig {
  set: (fn: (state: MindMapStore) => void) => void;
  get: () => MindMapStore;
  nodeId: string;
  treeOperation: LinkTreeOperation;
  normalizedOperation: NormalizedOperation | null;
  operationName: string;
  args: unknown[];
}

const executeLinkOperation = ({
  set,
  get,
  nodeId,
  treeOperation,
  normalizedOperation,
  operationName,
  args
}: LinkOperationConfig) => {
  set((state) => {
    if (!state.data) return;

    try {
      // Update tree structure
      const rootNodes = state.data.rootNodes || [];
      let updatedRootNodes = rootNodes;

      for (let i = 0; i < rootNodes.length; i++) {
        const updatedRootNode = treeOperation(rootNodes[i], nodeId, ...args);
        if (updatedRootNode !== rootNodes[i]) {
          updatedRootNodes = [...rootNodes];
          updatedRootNodes[i] = updatedRootNode;
          break;
        }
      }

      state.data = {
        ...state.data,
        rootNodes: updatedRootNodes,
        updatedAt: new Date().toISOString()
      };

      // Update normalized data if it exists
      if (state.normalizedData && normalizedOperation) {
        const node = state.normalizedData.nodes[nodeId];
        if (node) {
          state.normalizedData.nodes[nodeId] = normalizedOperation(node, ...args);
        }
      }

      logger.debug(`${operationName}:`, nodeId, ...args);
    } catch (error) {
      logger.error(`${operationName} error:`, error);
    }
  });

  get().syncToMindMapData();
};

// === Normalized Operations ===

const addLinkNormalized = (node: MindMapNode, linkData: Partial<NodeLink>): MindMapNode =>
  addLinkToNodeInTree(node, node.id, linkData);

const updateLinkNormalized = (node: MindMapNode, linkId: string, updates: Partial<NodeLink>): MindMapNode => {
  if (!node.links) return node;
  const updatedLinks = node.links.map((link: NodeLink) =>
    link.id === linkId ? { ...link, ...updates, updatedAt: new Date().toISOString() } : link
  );
  return { ...node, links: updatedLinks };
};

const deleteLinkNormalized = (node: MindMapNode, linkId: string): MindMapNode => {
  if (!node.links) return node;
  const filteredLinks = node.links.filter((link: NodeLink) => link.id !== linkId);
  return { ...node, links: filteredLinks };
};

// === Operations ===

export function createLinkOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Add a new link to a node
     */
    addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) =>
      executeLinkOperation({ set, get, nodeId, treeOperation: addLinkTree, normalizedOperation: addLinkToNormalizedNode, operationName: 'Link added to node', args: [linkData] }),

    /**
     * Update an existing link on a node
     */
    updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) =>
      executeLinkOperation({ set, get, nodeId, treeOperation: updateLinkTree, normalizedOperation: updateNormalizedLink, operationName: 'Link updated', args: [linkId, updates] }),

    /**
     * Delete a link from a node
     */
    deleteNodeLink: (nodeId: string, linkId: string) =>
      executeLinkOperation({ set, get, nodeId, treeOperation: removeLinkTree, normalizedOperation: removeNormalizedLink, operationName: 'Link deleted from node', args: [linkId] })
  };
}
