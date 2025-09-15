import type { StateCreator } from 'zustand';
import type { MindMapData } from '@shared/types';
import { logger } from '../../../shared/utils/logger';
import { normalizeTreeData, denormalizeTreeData } from '../../data';
import { autoSelectLayout } from '../../../shared';
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
      const layoutedRootNodes = rootNodes.map((rootNode, index) => {
        const layoutedNode = autoSelectLayout(rootNode, {
          globalFontSize: state.settings.fontSize
        });

        // Offset multiple root nodes vertically to prevent overlap
        if (index > 0 && layoutedNode) {
          const offsetY = index * 400; // 400px spacing between root nodes vertically
          layoutedNode.y = (layoutedNode.y || 0) + offsetY;

          // Apply vertical offset to all children recursively
          const applyOffsetToChildren = (node: MindMapNode, offset: number) => {
            if (node.children) {
              node.children.forEach(child => {
                child.y = (child.y || 0) + offset;
                applyOffsetToChildren(child, offset);
              });
            }
          };
          applyOffsetToChildren(layoutedNode, offsetY);
        }

        return layoutedNode;
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
            rootNodes: layoutedRootNodes,
            updatedAt: new Date().toISOString()
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