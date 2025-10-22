
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

// Performance optimization: memoization caches
interface LayoutCache {
  nodeSize: Map<string, { width: number; height: number; imageHeight: number }>;
  subtreeHeight: Map<string, number>;
  nodeBounds: Map<string, { minY: number; maxY: number }>;
  nodeCount: Map<string, number>;
}

const createLayoutCache = (): LayoutCache => ({
  nodeSize: new Map(),
  subtreeHeight: new Map(),
  nodeBounds: new Map(),
  nodeCount: new Map()
});


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
  wrapConfig?: NodeTextWrapConfig,
  cache?: LayoutCache
): number => {
  const getCachedNodeSize = (node: MindMapNode): { width: number; height: number; imageHeight: number } => {
    if (!cache) {
      return calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
    }
    const cacheKey = `${node.id}_${node.text}_${globalFontSize || 14}`;
    let size = cache.nodeSize.get(cacheKey);
    if (!size) {
      size = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
      cache.nodeSize.set(cacheKey, size);
    }
    return size;
  };

  const parentNodeSize = getCachedNodeSize(parentNode);
  const childNodeSize = getCachedNodeSize(childNode);

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

  // Performance: create layout cache for this layout pass
  const cache = createLayoutCache();

  const newRootNode = cloneDeep(rootNode);

  newRootNode.x = centerX;
  newRootNode.y = centerY;

  // Memoized node size calculation
  const getCachedNodeSize = (node: MindMapNode): { width: number; height: number; imageHeight: number } => {
    const cacheKey = `${node.id}_${node.text}_${effectiveFontSize}`;
    let size = cache.nodeSize.get(cacheKey);
    if (!size) {
      size = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
      cache.nodeSize.set(cacheKey, size);
    }
    return size;
  };

  // Memoized subtree height calculation
  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    const cacheKey = `${node.id}_${node.collapsed || false}_${node.children?.length || 0}`;
    const cached = cache.subtreeHeight.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const nodeSize = getCachedNodeSize(node);

    if (node.collapsed || !node.children || node.children.length === 0) {
      cache.subtreeHeight.set(cacheKey, nodeSize.height);
      return nodeSize.height;
    }

    let childrenTotalHeight = 0;
    for (let i = 0; i < node.children.length; i++) {
      const childHeight = calculateSubtreeActualHeight(node.children[i]);
      childrenTotalHeight += childHeight;

      if (i > 0) {
        childrenTotalHeight += Math.max(nodeSpacing, 2);
      }
    }

    const result = Math.max(nodeSize.height, childrenTotalHeight);
    cache.subtreeHeight.set(cacheKey, result);
    return result;
  };

  // Memoized node count calculation
  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    const cacheKey = `${node.id}_${node.collapsed || false}`;
    const cached = cache.nodeCount.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    if (node.collapsed || !node.children || node.children.length === 0) {
      cache.nodeCount.set(cacheKey, 1);
      return 1;
    }

    let count = 0;
    for (const child of node.children) {
      count += calculateSubtreeNodeCount(child);
    }

    cache.nodeCount.set(cacheKey, count);
    return count;
  };

  // Memoized bounds calculation to avoid redundant traversals
  const calculateNodeBounds = (node: MindMapNode): { minY: number; maxY: number } => {
    const cacheKey = `${node.id}_${node.y}_${node.collapsed || false}`;
    const cached = cache.nodeBounds.get(cacheKey);
    if (cached) {
      return cached;
    }

    const nodeSize = getCachedNodeSize(node);
    const nodeTop = getNodeTopY(node, nodeSize.height);
    const nodeBottom = getNodeBottomY(node, nodeSize.height);

    let minY = nodeTop;
    let maxY = nodeBottom;

    if (node.children && !node.collapsed) {
      for (const child of node.children) {
        const childBounds = calculateNodeBounds(child);
        minY = Math.min(minY, childBounds.minY);
        maxY = Math.max(maxY, childBounds.maxY);
      }
    }

    const result = { minY, maxY };
    cache.nodeBounds.set(cacheKey, result);
    return result;
  };

  const positionNode = (node: MindMapNode, parent: MindMapNode | null, depth: number, yOffset: number): void => {
    if (depth === 0) return;

    if (parent) {
      node.x = getChildNodeXFromParentEdge(parent, node, globalFontSize, wrapConfig, cache);
    } else {
      node.x = centerX + (depth * levelSpacing);
    }
    node.y = centerY + yOffset;

    if (node.collapsed || !node.children || node.children.length === 0) {
      return;
    }

    // Pre-calculate all child heights (already memoized)
    const childrenWithHeights = node.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));

    // Calculate total height with spacing
    let totalActualHeight = 0;
    for (let i = 0; i < childrenWithHeights.length; i++) {
      totalActualHeight += childrenWithHeights[i].actualHeight;
      if (i > 0) {
        totalActualHeight += Math.max(nodeSpacing, 2);
      }
    }

    // Position children
    let currentOffset = -totalActualHeight / 2;

    for (let i = 0; i < childrenWithHeights.length; i++) {
      const childInfo = childrenWithHeights[i];
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;

      positionNode(childInfo.node, node, depth + 1, yOffset + childCenterOffset);

      currentOffset += childInfo.actualHeight;
      if (i < childrenWithHeights.length - 1) {
        currentOffset += Math.max(nodeSpacing, 2);
      }
    }

    // Adjust parent Y to center on children (using cached bounds)
    if (childrenWithHeights.length > 0) {
      let minY = Infinity;
      let maxY = -Infinity;

      for (const child of node.children) {
        const bounds = calculateNodeBounds(child);
        minY = Math.min(minY, bounds.minY);
        maxY = Math.max(maxY, bounds.maxY);
      }

      node.y = (minY + maxY) / 2;
    }
  };

  if (!newRootNode.collapsed && newRootNode.children && newRootNode.children.length > 0) {
    // Pre-calculate all child heights (memoized)
    const childrenWithHeights = newRootNode.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));

    // Calculate total height with spacing
    let totalActualHeight = 0;
    for (let i = 0; i < childrenWithHeights.length; i++) {
      totalActualHeight += childrenWithHeights[i].actualHeight;
      if (i > 0) {
        totalActualHeight += Math.max(nodeSpacing, 2);
      }
    }

    // Position children
    let currentOffset = -totalActualHeight / 2;

    for (let i = 0; i < childrenWithHeights.length; i++) {
      const childInfo = childrenWithHeights[i];
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;

      positionNode(childInfo.node, newRootNode, 1, childCenterOffset);

      currentOffset += childInfo.actualHeight;
      if (i < childrenWithHeights.length - 1) {
        currentOffset += Math.max(nodeSpacing, 2);
      }
    }

    // Adjust root Y to center on children (using cached bounds)
    if (childrenWithHeights.length > 0) {
      let minY = Infinity;
      let maxY = -Infinity;

      for (const child of newRootNode.children) {
        const bounds = calculateNodeBounds(child);
        minY = Math.min(minY, bounds.minY);
        maxY = Math.max(maxY, bounds.maxY);
      }

      newRootNode.y = (minY + maxY) / 2;
    }
  }

  return newRootNode;
};

export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return simpleHierarchicalLayout(rootNode, options);
};
