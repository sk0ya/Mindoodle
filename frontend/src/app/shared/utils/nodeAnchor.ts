import type { MindMapNode } from '@shared/types';

const findNodeText = (root: MindMapNode, targetNodeId: string): string | null => {
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (node.id === targetNodeId) return node.text || '';
    if (node.children?.length) queue.push(...node.children);
  }
  return null;
};

const findDuplicateIndex = (root: MindMapNode, targetNodeId: string, targetText: string): number => {
  let count = 0;
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (node.text === targetText) {
      if (node.id === targetNodeId) return count;
      count += 1;
    }
    if (node.children?.length) queue.push(...node.children);
  }
  return count;
};

/**
 * Compute anchor string for a specific node based on duplicate order.
 * First occurrence => "Text", second => "Text-1", third => "Text-2", ...
 *
 * @param root - The root node to search from
 * @param targetNodeId - The ID of the target node
 * @returns The anchor string, or null if not found
 */
export function computeAnchorForNode(root: MindMapNode, targetNodeId: string): string | null {
  if (!root || !targetNodeId) return null;
  const targetText = findNodeText(root, targetNodeId);
  if (targetText === null) return null;
  const index = findDuplicateIndex(root, targetNodeId, targetText);
  return index === 0 ? targetText : `${targetText}-${index}`;
}
