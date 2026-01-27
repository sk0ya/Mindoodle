
import { cloneDeep } from '@shared/utils';
import { COORDINATES, LAYOUT } from '../../../shared/constants/index';
import { calculateNodeSize, getDynamicNodeSpacing, calculateChildNodeX, getNodeTopY, getNodeBottomY, resolveNodeTextWrapConfig, type NodeTextWrapConfig } from './nodeUtils';
import type { MindMapNode } from '../../../shared/types';


interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
  globalFontSize?: number;
  wrapConfig?: NodeTextWrapConfig;
  
  sidebarCollapsed?: boolean;
  activeView?: string | null;
}


const calculateDynamicCenterX = (
  sidebarCollapsed?: boolean,
  activeView?: string | null
): number => {
  
  const leftPanelWidth = activeView && !sidebarCollapsed ? LAYOUT.SIDEBAR_WIDTH : 0;
  const margin = 12; 
  return leftPanelWidth > 0 ? leftPanelWidth + margin : COORDINATES.DEFAULT_CENTER_X;
};

const getChildNodeXFromParentEdge = (
  parentNode: MindMapNode,
  childNode: MindMapNode,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): number => {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize, wrapConfig);
  const childNodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize, wrapConfig);

  
  const edgeToEdgeDistance = getDynamicNodeSpacing(parentNodeSize, childNodeSize, false);
  return calculateChildNodeX(parentNode, childNodeSize, edgeToEdgeDistance, globalFontSize, wrapConfig);
};




export const simpleHierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const uiAwareCenterX = calculateDynamicCenterX(options.sidebarCollapsed, options.activeView);

  const {
    centerX = uiAwareCenterX,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN,
    globalFontSize,
    wrapConfig: providedWrapConfig
  } = options;

  const effectiveFontSize = globalFontSize ?? 14;
  const wrapConfig = providedWrapConfig ?? resolveNodeTextWrapConfig(undefined, effectiveFontSize);

  const newRootNode = cloneDeep(rootNode);

  newRootNode.x = centerX;
  newRootNode.y = centerY;

  // Memoization caches for performance
  const heightCache = new Map<string, number>();
  const countCache = new Map<string, number>();


  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    // Check cache first
    const cached = heightCache.get(node.id);
    if (cached !== undefined) return cached;

    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);


    if (node.collapsed || !node.children || node.children.length === 0) {
      const result = nodeSize.height;
      heightCache.set(node.id, result);
      return result;
    }


    const childrenTotalHeight = node.children.reduce((sum, child, index) => {
      const childHeight = calculateSubtreeActualHeight(child);


      let spacing = 0;
      if (index > 0) {

        spacing = Math.max(nodeSpacing, 2);
      }

      return sum + childHeight + spacing;
    }, 0);


    const result = Math.max(nodeSize.height, childrenTotalHeight);
    heightCache.set(node.id, result);
    return result;
  };


  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    // Check cache first
    const cached = countCache.get(node.id);
    if (cached !== undefined) return cached;

    if (node.collapsed || !node.children || node.children.length === 0) {
      countCache.set(node.id, 1);
      return 1;
    }
    const result = node.children.reduce((sum, child) => sum + calculateSubtreeNodeCount(child), 0);
    countCache.set(node.id, result);
    return result;
  };

  // Shared helper: calculate bounds of subtree (min/max Y)
  const calculateNodeBounds = (node: MindMapNode, bounds: { minY: number; maxY: number }): void => {
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
    const nodeTop = getNodeTopY(node, nodeSize.height);
    const nodeBottom = getNodeBottomY(node, nodeSize.height);

    bounds.minY = Math.min(bounds.minY, nodeTop);
    bounds.maxY = Math.max(bounds.maxY, nodeBottom);

    if (node.children && !node.collapsed) {
      node.children.forEach(child => calculateNodeBounds(child, bounds));
    }
  };


  // Helper to position children of a node and adjust parent Y to center
  const positionChildrenAndCenterParent = (
    parentNode: MindMapNode,
    depth: number,
    parentYOffset: number
  ): void => {
    if (!parentNode.children || parentNode.children.length === 0 || parentNode.collapsed) {
      return;
    }

    const childrenWithHeights = parentNode.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));

    const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
      const spacing = index > 0 ? Math.max(nodeSpacing, 2) : 0;
      return sum + child.actualHeight + spacing;
    }, 0);

    let currentOffset = -totalActualHeight / 2;

    childrenWithHeights.forEach((childInfo, index) => {
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
      positionNode(childInfo.node, parentNode, depth + 1, parentYOffset + childCenterOffset);

      currentOffset += childInfo.actualHeight;
      if (index < childrenWithHeights.length - 1) {
        currentOffset += Math.max(nodeSpacing, 2);
      }
    });

    // Adjust parent Y to center of children bounds
    const bounds = { minY: Infinity, maxY: -Infinity };
    parentNode.children.forEach(child => calculateNodeBounds(child, bounds));
    const childrenCenterY = (bounds.minY + bounds.maxY) / 2;
    parentNode.y = childrenCenterY;
  };

  const positionNode = (node: MindMapNode, parent: MindMapNode | null, depth: number, yOffset: number): void => {
    if (depth === 0) return;

    if (parent) {
      node.x = getChildNodeXFromParentEdge(parent, node, globalFontSize, wrapConfig);
    } else {
      node.x = centerX + (depth * levelSpacing);
    }
    node.y = centerY + yOffset;

    if (node.collapsed) {
      return;
    }

    positionChildrenAndCenterParent(node, depth, yOffset);
  };

  // Position root node's children using the same logic
  positionChildrenAndCenterParent(newRootNode, 0, 0);

  return newRootNode;
};

/**
 * Tree layout - root at top-left, expanding right and down
 */
export const treeLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  // Note: centerX and centerY from options are ignored in tree layout mode
  const {
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN,
    globalFontSize,
    wrapConfig: providedWrapConfig
  } = options;

  const effectiveFontSize = globalFontSize ?? 14;
  const wrapConfig = providedWrapConfig ?? resolveNodeTextWrapConfig(undefined, effectiveFontSize);

  const newRootNode = cloneDeep(rootNode);

  // Calculate the total height of a subtree
  const calculateSubtreeHeight = (node: MindMapNode): number => {
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
    // Respect the configured nodeSpacing directly (with a tiny floor for safety)
    const spacing = Math.max(nodeSpacing, 1);

    if (node.collapsed || !node.children || node.children.length === 0) {
      return nodeSize.height;
    }

    // Sum up all children's subtree heights plus spacing
    const childrenHeight = node.children.reduce((total, child, index) => {
      const childHeight = calculateSubtreeHeight(child);
      const childSpacing = index > 0 ? spacing : 0;
      return total + childHeight + childSpacing;
    }, 0);

    // Return the maximum of node height and children height
    return Math.max(nodeSize.height, childrenHeight);
  };

  // Positioning based on TOP Y baseline for consistent stacking.
  // Convert top-based coordinates to center-based before assigning to node.y.
  const positionNodeTop = (node: MindMapNode, x: number, topY: number): number => {
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
    const spacing = Math.max(nodeSpacing, 1);

    // Set node center Y from topY for rendering (renderer uses centers)
    node.x = x;
    node.y = topY + nodeSize.height / 2;

    // If leaf/collapsed: return next top pointer after this node
    if (node.collapsed || !node.children || node.children.length === 0) {
      return topY + nodeSize.height + spacing;
    }

    // Stack children from the same top as parent (first child's subtree top == parent's top)
    let nextChildTop = topY;
    for (const child of node.children) {
      const childSubtreeHeight = calculateSubtreeHeight(child);
      const childX = getChildNodeXFromParentEdge(node, child, globalFontSize, wrapConfig);
      // Place child by its subtree top; it will compute its own center internally
      positionNodeTop(child, childX, nextChildTop);
      nextChildTop += childSubtreeHeight + spacing;
    }

    // Return the next available top position after finishing this subtree
    return nextChildTop;
  };

  // Anchor root to top-left with a margin that clears the top-left button; ignore sidebar state
  // Note: centerX and centerY parameters are ignored in this layout mode
  const rootX = 180; // 180px left margin as requested
  const rootTop = COORDINATES.CANVAS_PADDING;
  positionNodeTop(newRootNode, rootX, rootTop);

  return newRootNode;
};
