import type { NodeLink } from '@shared/types';
import { logger } from '@shared/utils';
import {
  addLinkToNodeInTree,
  updateLinkInNodeTree,
  removeLinkFromNodeTree,
} from '../../../utils';
import type { MindMapStore } from '../types';

/**
 * Link operations for managing node hyperlinks
 * Updates both tree structure and normalized data
 */
export function createLinkOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Add a new link to a node
     */
    addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => {
      set((state) => {
        if (!state.data) return;

        try {
          // Update tree structure with new link - only use rootNodes
          const rootNodes = state.data.rootNodes || [];

          let updatedRootNodes = rootNodes;
          for (let i = 0; i < rootNodes.length; i++) {
            const updatedRootNode = addLinkToNodeInTree(rootNodes[i], nodeId, linkData);
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
          if (state.normalizedData) {
            const node = state.normalizedData.nodes[nodeId];
            if (node) {
              const updatedNode = addLinkToNodeInTree(node, nodeId, linkData);
              state.normalizedData.nodes[nodeId] = updatedNode;
            }
          }

          logger.debug('Link added to node:', nodeId, linkData);
        } catch (error) {
          logger.error('addNodeLink error:', error);
        }
      });
      // Commit to tree + history via event bus
      get().syncToMindMapData();
    },

    /**
     * Update an existing link on a node
     */
    updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => {
      set((state) => {
        if (!state.data) return;

        try {
          // Update tree structure - only use rootNodes
          const rootNodes = state.data.rootNodes || [];

          let updatedRootNodes = rootNodes;
          for (let i = 0; i < rootNodes.length; i++) {
            const updatedRootNode = updateLinkInNodeTree(rootNodes[i], nodeId, linkId, updates);
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
          if (state.normalizedData) {
            const node = state.normalizedData.nodes[nodeId];
            if (node && node.links) {
              const updatedLinks = node.links.map((link: NodeLink) =>
                link.id === linkId ? { ...link, ...updates, updatedAt: new Date().toISOString() } : link
              );
              state.normalizedData.nodes[nodeId] = { ...node, links: updatedLinks };
            }
          }

          logger.debug('Link updated:', nodeId, linkId, updates);
        } catch (error) {
          logger.error('updateNodeLink error:', error);
        }
      });
      // Commit to tree + history via event bus
      get().syncToMindMapData();
    },

    /**
     * Delete a link from a node
     */
    deleteNodeLink: (nodeId: string, linkId: string) => {
      set((state) => {
        if (!state.data) return;

        try {
          // Update tree structure - only use rootNodes
          const rootNodes = state.data.rootNodes || [];

          let updatedRootNodes = rootNodes;
          for (let i = 0; i < rootNodes.length; i++) {
            const updatedRootNode = removeLinkFromNodeTree(rootNodes[i], nodeId, linkId);
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
          if (state.normalizedData) {
            const node = state.normalizedData.nodes[nodeId];
            if (node && node.links) {
              const filteredLinks = node.links.filter((link: NodeLink) => link.id !== linkId);
              state.normalizedData.nodes[nodeId] = { ...node, links: filteredLinks };
            }
          }

          logger.debug('Link deleted from node:', nodeId, linkId);
        } catch (error) {
          logger.error('deleteNodeLink error:', error);
        }
      });
      // Commit to tree + history via event bus
      get().syncToMindMapData();
    },
  };
}
