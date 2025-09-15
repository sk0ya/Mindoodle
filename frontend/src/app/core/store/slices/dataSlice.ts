import type { StateCreator } from 'zustand';
import type { MindMapData } from '@shared/types';
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

  // Set data and normalize
  setData: (data: MindMapData) => {
    set((state) => {
      state.data = data;
      // Only use rootNodes array
      state.normalizedData = normalizeTreeData(data.rootNodes);
      
      // Add to history if not already there
      if (state.history.length === 0 || state.history[state.historyIndex] !== data) {
        state.history = [...state.history.slice(0, state.historyIndex + 1), data];
        state.historyIndex = state.history.length - 1;
      }
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
      
      // Apply layout to each root node separately
      const layoutedRootNodes: MindMapNode[] = [];
      let previousSubtreeBottom = 0;

      rootNodes.forEach((rootNode, index) => {
        const layoutedNode = autoSelectLayout(rootNode, {
          globalFontSize: state.settings.fontSize
        });

        if (!layoutedNode) return;

        // Calculate subtree bounds (min/max Y coordinates including node size)
        const getSubtreeBounds = (node: MindMapNode): { minY: number; maxY: number } => {
          const nodeY = node.y || 0;

          // Calculate actual node bounds using node size
          const nodeSize = calculateNodeSize(node, undefined, false, state.settings.fontSize);
          const nodeTop = nodeY - nodeSize.height / 2;
          const nodeBottom = nodeY + nodeSize.height / 2;

          let minY = nodeTop;
          let maxY = nodeBottom;

          if (node.children) {
            node.children.forEach(child => {
              const childBounds = getSubtreeBounds(child);
              minY = Math.min(minY, childBounds.minY);
              maxY = Math.max(maxY, childBounds.maxY);
            });
          }

          return { minY, maxY };
        };

        if (index > 0) {
          // For subsequent root nodes, first calculate current subtree bounds
          const currentSubtreeBounds = getSubtreeBounds(layoutedNode);
          const currentSubtreeTop = currentSubtreeBounds.minY;

          // Calculate offset needed to position this subtree 4px below the previous one
          const targetTopY = previousSubtreeBottom + 4;
          const offsetY = targetTopY - currentSubtreeTop;

          // Apply offset to root and all children
          const applyOffsetToSubtree = (node: MindMapNode, offset: number) => {
            node.y = (node.y || 0) + offset;
            if (node.children) {
              node.children.forEach(child => applyOffsetToSubtree(child, offset));
            }
          };

          applyOffsetToSubtree(layoutedNode, offsetY);

          // Now calculate the final bottom position after offset
          const finalBounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = finalBounds.maxY;
        } else {
          // First root node - calculate its bottom boundary
          const bounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = bounds.maxY;
        }

        layoutedRootNodes.push(layoutedNode);
      });
      
      if (layoutedRootNodes.some(node => !node)) {
        logger.error('❌ Auto layout: One or more layouted nodes are null or undefined');
        return;
      }
      
      logger.debug('✅ Auto layout result:', {
        layoutedNodesCount: layoutedRootNodes.length
      });
      
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
          
          // Add to history
          try {
            draft.history = [...draft.history.slice(0, draft.historyIndex + 1), draft.data];
            draft.historyIndex = draft.history.length - 1;
          } catch (historyError) {
            logger.error('❌ Auto layout: Failed to update history:', historyError);
          }
        }
      });
      logger.debug('🎉 Auto layout applied successfully');
    } catch (error) {
      logger.error('❌ Auto layout failed:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    }
  },
});;;