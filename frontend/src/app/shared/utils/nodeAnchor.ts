import type { MindMapNode } from '@shared/types';

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
  let index = 0;
  let targetText: string | null = null;
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (node.id === targetNodeId) {
      targetText = node.text || '';
      break;
    }
    if (node.children && node.children.length) queue.push(...node.children);
  }
  if (targetText === null) return null;
  // Count occurrences until the target node is reached again in a second pass
  let count = 0;
  const queue2: MindMapNode[] = [root];
  while (queue2.length) {
    const node = queue2.shift();
    if (!node) continue;
    if (node.text === targetText) {
      if (node.id === targetNodeId) { index = count; break; }
      count += 1;
    }
    if (node.children && node.children.length) queue2.push(...node.children);
  }
  return index === 0 ? targetText : `${targetText}-${index}`;
}
