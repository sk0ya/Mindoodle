import type { MindMapNode } from '@shared/types';
import { computeAnchorForNode } from '../../markdown';

export interface NodeOption {
  id: string;
  text: string;
  anchorText: string;
  displayText: string;
  mapId?: string;
}

/**
 * Flatten a node tree into a flat array of node options
 * Reusable across modals that need node selection
 */
export const flattenNodesToOptions = (
  rootNode: MindMapNode,
  mapId?: string
): NodeOption[] => {
  const result: NodeOption[] = [];

  const traverse = (node: MindMapNode) => {
    const anchor = computeAnchorForNode(rootNode, node.id) || node.text || '';
    result.push({
      id: node.id,
      text: node.text,
      anchorText: anchor,
      displayText: anchor,
      mapId,
    });
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(rootNode);
  return result;
};

/**
 * Flatten all root nodes into a single array of node options
 */
export const flattenRootNodesToOptions = (
  rootNodes: MindMapNode[],
  mapId?: string
): NodeOption[] => {
  const nodes: NodeOption[] = [];
  rootNodes.forEach((rootNode) => {
    nodes.push(...flattenNodesToOptions(rootNode, mapId));
  });
  return nodes;
};
