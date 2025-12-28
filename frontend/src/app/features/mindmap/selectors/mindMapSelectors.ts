import type { MindMapNode } from '@shared/types';
import {
  findNodeByMarkdownLine,
  findParentNodeSimple,
  getSiblingsInRoot,
  flattenVisibleNodes as flattenVisible
} from '@shared/utils/treeUtils';

export function selectNodeIdByMarkdownLine(rootNodes: MindMapNode[], line: number): string | null {
  return findNodeByMarkdownLine(rootNodes, line);
}

export function findParentNode(rootNodes: MindMapNode[], targetId: string): MindMapNode | null {
  return findParentNodeSimple(rootNodes, targetId);
}

export function getSiblingNodes(root: MindMapNode, targetId: string): { siblings: MindMapNode[]; currentIndex: number } {
  return getSiblingsInRoot(root, targetId);
}

export function flattenVisibleNodes(root: MindMapNode): MindMapNode[] {
  return flattenVisible(root);
}
