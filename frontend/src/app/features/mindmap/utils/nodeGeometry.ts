import type { MindMapNode } from '@shared/types';
import type { NodeSize } from './nodeSize';

// ========================================
// Position Calculation Functions
// ========================================

export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

export function getNodeRightX(node: MindMapNode, nodeWidth: number): number {
  return node.x + nodeWidth / 2;
}

export function getNodeTopY(node: MindMapNode, nodeHeight: number): number {
  return node.y - nodeHeight / 2;
}

export function getNodeBottomY(node: MindMapNode, nodeHeight: number): number {
  return node.y + nodeHeight / 2;
}

// ========================================
// Bounds Calculation
// ========================================

export function getNodeBounds(node: MindMapNode, nodeSize: NodeSize) {
  return {
    left: getNodeLeftX(node, nodeSize.width),
    right: getNodeRightX(node, nodeSize.width),
    top: getNodeTopY(node, nodeSize.height),
    bottom: getNodeBottomY(node, nodeSize.height),
    centerX: node.x,
    centerY: node.y,
    width: nodeSize.width,
    height: nodeSize.height
  };
}
