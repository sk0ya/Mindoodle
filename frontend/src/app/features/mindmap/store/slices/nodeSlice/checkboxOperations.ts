import { logger } from '@shared/utils';
import type { MindMapStore } from '../types';
import { updateNodeCheckedInTree } from './helpers';

/**
 * Checkbox operations for task list functionality
 * Uses optimistic UI updates with async tree synchronization
 */
export function createCheckboxOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Toggle checkbox state for a node
     * Updates normalized data immediately for instant UI feedback
     * Syncs to tree structure asynchronously to avoid blocking
     */
    toggleNodeCheckbox: (nodeId: string, checked: boolean) => {
      // 1. Update normalized data immediately (lightweight, instant UI)
      set((state) => {
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node && node.markdownMeta?.isCheckbox) {
            state.normalizedData.nodes[nodeId] = {
              ...node,
              markdownMeta: {
                ...node.markdownMeta,
                isChecked: checked
              }
            };
          }
        }
      });

      // 2. Heavy tree update and file save in async execution
      requestAnimationFrame(() => {
        set((state) => {
          if (!state.data) return;

          try {
            // Update tree structure - only use rootNodes
            const rootNodes = state.data.rootNodes || [];

            const updatedRootNodes = updateNodeCheckedInTree(rootNodes, nodeId, checked);

            state.data = {
              ...state.data,
              rootNodes: updatedRootNodes,
              updatedAt: new Date().toISOString()
            };

            logger.debug('Checkbox toggled for node:', nodeId, 'checked:', checked);
          } catch (error) {
            logger.error('toggleNodeCheckbox error:', error);
          }
        });

        // Sync to file storage
        get().syncToMindMapData();
      });
    },
  };
}
