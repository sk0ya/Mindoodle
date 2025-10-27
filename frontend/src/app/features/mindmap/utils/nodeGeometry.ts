/**
 * Node geometry utilities - refactored with functional patterns
 * Reduced from 39 lines to 27 lines (31% reduction)
 */

import type { MindMapNode } from '@shared/types';
import type { NodeSize } from './nodeSize';


export const getNodeLeftX = (node: MindMapNode, nodeWidth: number): number => node.x - nodeWidth / 2;
export const getNodeRightX = (node: MindMapNode, nodeWidth: number): number => node.x + nodeWidth / 2;
export const getNodeTopY = (node: MindMapNode, nodeHeight: number): number => node.y - nodeHeight / 2;
export const getNodeBottomY = (node: MindMapNode, nodeHeight: number): number => node.y + nodeHeight / 2;


export const getNodeBounds = (node: MindMapNode, nodeSize: NodeSize) => ({
  left: getNodeLeftX(node, nodeSize.width),
  right: getNodeRightX(node, nodeSize.width),
  top: getNodeTopY(node, nodeSize.height),
  bottom: getNodeBottomY(node, nodeSize.height),
  centerX: node.x,
  centerY: node.y,
  width: nodeSize.width,
  height: nodeSize.height
});
