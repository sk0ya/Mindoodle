
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

  
  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);

    
    if (node.collapsed || !node.children || node.children.length === 0) {
      return nodeSize.height;
    }

    
    const childrenTotalHeight = node.children.reduce((sum, child, index) => {
      const childHeight = calculateSubtreeActualHeight(child);

      
      let spacing = 0;
      if (index > 0) {
        
        spacing = Math.max(nodeSpacing, 2); 
      }

      return sum + childHeight + spacing;
    }, 0);

    
    return Math.max(nodeSize.height, childrenTotalHeight);
  };

  
  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeNodeCount(child), 0);
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

    if (node.children && node.children.length > 0) {
      
      const childrenWithHeights = node.children.map(child => ({
        node: child,
        actualHeight: calculateSubtreeActualHeight(child),
        nodeCount: calculateSubtreeNodeCount(child)
      }));
      
      
      const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
        let spacing = 0;
        if (index > 0) {
          
          spacing = Math.max(nodeSpacing, 2); 
        }
        return sum + child.actualHeight + spacing;
      }, 0);
      
      
      let currentOffset = -totalActualHeight / 2;
      
      childrenWithHeights.forEach((childInfo, index) => {
        
        const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
        
        positionNode(childInfo.node, node, depth + 1, yOffset + childCenterOffset);
        
        
        currentOffset += childInfo.actualHeight;
        if (index < childrenWithHeights.length - 1) {
          
          const spacing = Math.max(nodeSpacing, 2); 
          currentOffset += spacing;
        }
      });

      
      if (childrenWithHeights.length > 0) {
        
        let minY = Infinity;
        let maxY = -Infinity;

        const calculateNodeBounds = (childNode: MindMapNode) => {
        const nodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize, wrapConfig);
          const nodeTop = getNodeTopY(childNode, nodeSize.height);
          const nodeBottom = getNodeBottomY(childNode, nodeSize.height);

          minY = Math.min(minY, nodeTop);
          maxY = Math.max(maxY, nodeBottom);

          
          if (childNode.children && !childNode.collapsed) {
            childNode.children.forEach(grandChild => calculateNodeBounds(grandChild));
          }
        };

        node.children.forEach(child => calculateNodeBounds(child));

        
        const childrenCenterY = (minY + maxY) / 2;
        node.y = childrenCenterY;
      }
    }
  };

  if (!newRootNode.collapsed && newRootNode.children && newRootNode.children.length > 0) {
    
    const childrenWithHeights = newRootNode.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));
    
    
    const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
      let spacing = 0;
      if (index > 0) {
        
        spacing = Math.max(nodeSpacing, 2); 
      }
      return sum + child.actualHeight + spacing;
    }, 0);
    
    
    let currentOffset = -totalActualHeight / 2;
    
    childrenWithHeights.forEach((childInfo, index) => {
      
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
      
      positionNode(childInfo.node, newRootNode, 1, childCenterOffset);
      
      
      currentOffset += childInfo.actualHeight;
      if (index < childrenWithHeights.length - 1) {
        
        const spacing = Math.max(nodeSpacing, 2); 
        currentOffset += spacing;
      }
    });

    
    if (childrenWithHeights.length > 0) {
      
      let minY = Infinity;
      let maxY = -Infinity;

      const calculateNodeBounds = (node: MindMapNode) => {
        const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
        const nodeTop = getNodeTopY(node, nodeSize.height);
        const nodeBottom = getNodeBottomY(node, nodeSize.height);

        minY = Math.min(minY, nodeTop);
        maxY = Math.max(maxY, nodeBottom);

        
        if (node.children && !node.collapsed) {
          node.children.forEach(child => calculateNodeBounds(child));
        }
      };

      newRootNode.children.forEach(child => calculateNodeBounds(child));

      
      const childrenCenterY = (minY + maxY) / 2;
      newRootNode.y = childrenCenterY;
    }

  }

  return newRootNode;
};

export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return simpleHierarchicalLayout(rootNode, options);
};
