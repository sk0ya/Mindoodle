
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

/**
 * Tree layout - root at top-left, expanding right and down
 */
export const treeLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const uiAwareCenterX = calculateDynamicCenterX(options.sidebarCollapsed, options.activeView);

  const {
    centerX = uiAwareCenterX,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
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
  void centerY; // satisfy noUnusedParameters
  void centerX; // satisfy noUnusedParameters
  const rootX = 180; // 180px left margin as requested
  const rootTop = COORDINATES.CANVAS_PADDING;
  positionNodeTop(newRootNode, rootX, rootTop);

  return newRootNode;
};
/**
 * Automatically select the appropriate layout based on settings or default to mindmap layout
 * Note: The actual layout selection is handled by dataSlice using layoutType setting.
 * This function is kept for backward compatibility and defaults to mindmap layout.
 */
export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  // Default to mindmap layout - the store uses specific layout functions based on settings
  return simpleHierarchicalLayout(rootNode, options);
};
