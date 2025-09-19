import type { StateCreator } from 'zustand';
import type { MindMapData, MindMapNode } from '@shared/types';
import { logger } from '../../../shared/utils/logger';
import { normalizeTreeData, denormalizeTreeData } from '../../data';
import { autoSelectLayout, calculateNodeSize } from '../../../shared';
import type { MindMapStore, DataState } from './types';

export interface DataSlice extends DataState {
  setData: (data: MindMapData) => void;
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
}

export const createDataSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  DataSlice
> = (set, get) => ({
  // Initial state
  data: null,
  normalizedData: null,
  selectedNodeId: null,
  editingNodeId: null,
  editText: '',
  editingMode: null,

  // Set data and normalize (no history push here)
  setData: (data: MindMapData) => {
    set((state) => {
      state.data = data;
      // Only use rootNodes array
      state.normalizedData = normalizeTreeData(data.rootNodes);
    });
  },

  // Update normalized data from current tree
  updateNormalizedData: () => {
    set((state) => {
      if (state.data) {
        state.normalizedData = normalizeTreeData(state.data.rootNodes);
      }
    });
  },

  // Sync normalized data back to tree structure and add to history
  syncToMindMapData: () => {
    set((state) => {
      if (state.normalizedData && state.data) {
        const newRootNodes = denormalizeTreeData(state.normalizedData);
        const newData = {
          ...state.data,
          rootNodes: newRootNodes,
          updatedAt: new Date().toISOString()
        };
        state.data = newData;
        
        // Add to history
        state.history = [...state.history.slice(0, state.historyIndex + 1), newData];
        state.historyIndex = state.history.length - 1;
      }
    });
  },

  applyAutoLayout: () => {
    const state = get();
    const rootNodes = state.data?.rootNodes || [];
    
    if (rootNodes.length === 0) {
      logger.warn('⚠️ Auto layout: No root nodes found');
      return;
    }
    
    // Validate autoSelectLayout function exists
    if (typeof autoSelectLayout !== 'function') {
      logger.error('❌ Auto layout: autoSelectLayout function not found');
      return;
    }
    
    try {
      logger.debug('🎯 Applying auto layout to root nodes:', {
        rootNodesCount: rootNodes.length,
        firstNodeId: rootNodes[0]?.id
      });
      
      // Memoized node size calculation
      const nodeSizeCache = new Map<string, { width: number; height: number }>();
      const getNodeSize = (node: MindMapNode): { width: number; height: number } => {
        const cacheKey = `${node.id}_${node.text}_${state.settings.fontSize}`;
        if (nodeSizeCache.has(cacheKey)) {
          return nodeSizeCache.get(cacheKey)!;
        }
        const size = calculateNodeSize(node, undefined, false, state.settings.fontSize);
        nodeSizeCache.set(cacheKey, size);
        return size;
      };

      // Optimized subtree bounds calculation with memoization
      const boundsCache = new Map<string, { minY: number; maxY: number }>();
      const getSubtreeBounds = (node: MindMapNode): { minY: number; maxY: number } => {
        // Create cache key based on node id and position (to invalidate on position changes)
        const cacheKey = `${node.id}_${node.y || 0}`;
        
        if (boundsCache.has(cacheKey)) {
          return boundsCache.get(cacheKey)!;
        }

        const nodeY = node.y || 0;
        const nodeSize = getNodeSize(node);
        const nodeTop = nodeY - nodeSize.height / 2;
        const nodeBottom = nodeY + nodeSize.height / 2;

        let minY = nodeTop;
        let maxY = nodeBottom;

        if (node.children && node.children.length > 0) {
          // Use parallel processing for children bounds calculation
          const childBounds = node.children.map(child => getSubtreeBounds(child));
          for (const bounds of childBounds) {
            minY = Math.min(minY, bounds.minY);
            maxY = Math.max(maxY, bounds.maxY);
          }
        }

        const result = { minY, maxY };
        boundsCache.set(cacheKey, result);
        return result;
      };

      // Memoized node count calculation  
      const nodeCountCache = new Map<string, number>();
      const getNodeCount = (node: MindMapNode): number => {
        if (nodeCountCache.has(node.id)) {
          return nodeCountCache.get(node.id)!;
        }
        
        const count = !node.children || node.children.length === 0 
          ? 1 
          : 1 + node.children.reduce((sum, child) => sum + getNodeCount(child), 0);
        
        nodeCountCache.set(node.id, count);
        return count;
      };

      // Apply layout to each root node separately
      const layoutedRootNodes: MindMapNode[] = [];
      let previousSubtreeBottom = 0;

      // Process root nodes sequentially but cache results
      for (let index = 0; index < rootNodes.length; index++) {
        const rootNode = rootNodes[index];
        const layoutedNode = autoSelectLayout(rootNode, {
          globalFontSize: state.settings.fontSize
        });

        if (!layoutedNode) continue;

        if (index > 0) {
          // Calculate current subtree bounds
          const currentSubtreeBounds = getSubtreeBounds(layoutedNode);
          const currentSubtreeTop = currentSubtreeBounds.minY;

          // Calculate adaptive spacing with cached node counts
          const previousRoot = layoutedRootNodes[index - 1];
          const previousNodeCount = getNodeCount(previousRoot);
          const currentNodeCount = getNodeCount(layoutedNode);

          // Optimized spacing calculation
          const baseSpacing = 8;
          const complexityFactor = Math.min(Math.max(previousNodeCount, currentNodeCount) * 0.5, 16);
          const adaptiveSpacing = baseSpacing + complexityFactor;

          // Calculate and apply offset
          const targetTopY = previousSubtreeBottom + adaptiveSpacing;
          const offsetY = targetTopY - currentSubtreeTop;

          // Optimized offset application using iteration instead of recursion
          const nodesToProcess = [layoutedNode];
          while (nodesToProcess.length > 0) {
            const currentNode = nodesToProcess.pop()!;
            currentNode.y = (currentNode.y || 0) + offsetY;
            
            if (currentNode.children) {
              nodesToProcess.push(...currentNode.children);
            }
          }

          // Clear cache for modified nodes to force recalculation
          boundsCache.clear();
          
          // Calculate final bottom position
          const finalBounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = finalBounds.maxY;
        } else {
          // First root node
          const bounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = bounds.maxY;
        }

        layoutedRootNodes.push(layoutedNode);
      }
      
      if (layoutedRootNodes.some(node => !node)) {
        logger.error('❌ Auto layout: One or more layouted nodes are null or undefined');
        return;
      }
      
      logger.debug('✅ Auto layout result:', {
        layoutedNodesCount: layoutedRootNodes.length
      });
      
      // Optimized state update using requestAnimationFrame for smoother UI (no history push)
      requestAnimationFrame(() => {
        set((draft) => {
          if (draft.data) {
            draft.data = {
              ...draft.data,
              rootNodes: layoutedRootNodes
            };
            
            // Update normalized data
            try {
              draft.normalizedData = normalizeTreeData(layoutedRootNodes);
            } catch (normalizeError) {
              logger.error('❌ Auto layout: Failed to normalize data:', normalizeError);
            }
          }
        });
      });
      
      logger.debug('🎉 Auto layout applied successfully');
    } catch (error) {
      logger.error('❌ Auto layout failed:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    }
  },
});
