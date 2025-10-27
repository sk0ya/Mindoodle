import type { NodeLink, MindMapNode, MindMapData } from '@shared/types';
import { generateId as generateLinkId } from '@shared/utils';
import { findNodeInRoots } from './nodeOperations';

export const addLinkToNode = (
  node: MindMapNode,
  linkData: Partial<NodeLink>
): MindMapNode => {
  const newLink: NodeLink = {
    id: linkData.id || generateLinkId(),
    targetMapId: linkData.targetMapId,
    targetNodeId: linkData.targetNodeId,
    targetAnchor: linkData.targetAnchor
  };

  return {
    ...node,
    links: [...(node.links || []), newLink]
  };
};

export const updateLinkInNode = (
  node: MindMapNode,
  linkId: string,
  updates: Partial<NodeLink>
): MindMapNode => {
  if (!node.links) return node;

  return {
    ...node,
    links: node.links.map(link =>
      link.id === linkId
        ? {
            ...link,
            ...updates
          }
        : link
    )
  };
};

export const removeLinkFromNode = (
  node: MindMapNode,
  linkId: string
): MindMapNode => {
  if (!node.links) return node;

  return {
    ...node,
    links: node.links.filter(link => link.id !== linkId)
  };
};

export const addLinkToNodeInTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkData: Partial<NodeLink>
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return addLinkToNode(rootNode, linkData);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      addLinkToNodeInTree(child, nodeId, linkData)
    )
  };
};

export const updateLinkInNodeTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkId: string,
  updates: Partial<NodeLink>
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return updateLinkInNode(rootNode, linkId, updates);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      updateLinkInNodeTree(child, nodeId, linkId, updates)
    )
  };
};

export const removeLinkFromNodeTree = (
  rootNode: MindMapNode,
  nodeId: string,
  linkId: string
): MindMapNode => {
  if (rootNode.id === nodeId) {
    return removeLinkFromNode(rootNode, linkId);
  }

  return {
    ...rootNode,
    children: rootNode.children.map(child =>
      removeLinkFromNodeTree(child, nodeId, linkId)
    )
  };
};
