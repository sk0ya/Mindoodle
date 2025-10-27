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

type LinkTreeOperation = (...args: any[]) => MindMapNode;
type NormalizedOperation = (...args: any[]) => MindMapNode;

const executeLinkOperation = (
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore,
  nodeId: string,
  treeOperation: LinkTreeOperation,
  normalizedOperation: NormalizedOperation | null,
  operationName: string,
  ...args: unknown[]
) => {
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
      executeLinkOperation(
        set,
        get,
        nodeId,
        addLinkToNodeInTree,
        addLinkNormalized,
        'Link added to node',
        linkData
      ),

    /**
     * Update an existing link on a node
     */
    updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) =>
      executeLinkOperation(
        set,
        get,
        nodeId,
        updateLinkInNodeTree,
        updateLinkNormalized,
        'Link updated',
        linkId,
        updates
      ),

    /**
     * Delete a link from a node
     */
    deleteNodeLink: (nodeId: string, linkId: string) =>
      executeLinkOperation(
        set,
        get,
        nodeId,
        removeLinkFromNodeTree,
        deleteLinkNormalized,
        'Link deleted from node',
        linkId
      )
  };
}
