import type { MindMapNode } from '@shared/types';
import { calculateNodeSize, type NodeSize } from './nodeSize';
import { getNodeRightX, getNodeLeftX } from './nodeGeometry';
import type { NodeTextWrapConfig } from './nodeMeasurement';

// Toggle Button Positioning

export function getToggleButtonPosition(
  node: MindMapNode,
  rootNode: MindMapNode,
  nodeSize?: NodeSize,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
) {
  const isRootNodeItself = node.id === rootNode.id;
  const isOnRight = isRootNodeItself ? true : node.x > rootNode.x;

  const actualNodeSize = nodeSize || calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);

  const fontSize = globalFontSize || 14;
  const base = Math.max(fontSize * 1.5, 20);

  const note = node.note || '';
  const hasMermaid = /```mermaid[\s\S]*?```/i.test(note);
  const isTable = node.kind === 'table';
  const isVisualHeavy = hasMermaid || isTable;

  let baseMargin = base;
  let widthAdjustment = 0;

  if (!isVisualHeavy) {
    if (actualNodeSize.imageHeight > 100) {
      baseMargin += Math.min((actualNodeSize.imageHeight - 100) * 0.08, 24);
    }

    const baseWidth = fontSize * 4;
    widthAdjustment = Math.max(0, (actualNodeSize.width - baseWidth) * 0.04);
    widthAdjustment = Math.min(widthAdjustment, 20);
  } else {
    baseMargin += 8;
  }

  const totalMargin = Math.min(Math.max(baseMargin + widthAdjustment, 12), 35);

  const nodeRightEdge = getNodeRightX(node, actualNodeSize.width);
  const nodeLeftEdge = getNodeLeftX(node, actualNodeSize.width);

  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;

  return { x: toggleX, y: toggleY };
}

// Node Spacing Calculation

export function getDynamicNodeSpacing(
  parentNodeSize: NodeSize,
  childNodeSize: NodeSize,
  _isRootChild: boolean = false
): number {
  const toggleButtonWidth = 20;
  const minToggleToChildSpacing = 15;

  const baseSpacing = 30;

  const parentWidthFactor = Math.min(parentNodeSize.width / 100, 1) * 5;
  const childWidthFactor = Math.min(childNodeSize.width / 100, 1) * 5;

  const calculatedSpacing = baseSpacing + parentWidthFactor + childWidthFactor;
  const minRequiredSpacing = toggleButtonWidth + minToggleToChildSpacing;

  return Math.round(Math.max(calculatedSpacing, minRequiredSpacing));
}

// Child Node Position Calculation

export function calculateChildNodeX(
  parentNode: MindMapNode,
  childNodeSize: NodeSize,
  edgeToEdgeDistance: number,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): number {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize, wrapConfig);
  const parentRightEdge = getNodeRightX(parentNode, parentNodeSize.width);

  const basicChildLeftEdge = parentRightEdge + edgeToEdgeDistance;

  const togglePosition = getToggleButtonPosition(parentNode, parentNode, parentNodeSize, globalFontSize, wrapConfig);
  const toggleButtonWidth = 20;
  const minToggleToChildSpacing = 15;
  const requiredChildLeftEdge = togglePosition.x + toggleButtonWidth / 2 + minToggleToChildSpacing;

  const finalChildLeftEdge = Math.max(basicChildLeftEdge, requiredChildLeftEdge);
  const childCenterX = finalChildLeftEdge + childNodeSize.width / 2;

  return childCenterX;
}
