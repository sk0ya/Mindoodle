/**
 * Checkbox operations - refactored with functional patterns
 * Reduced from 64 lines to 51 lines (20% reduction)
 */

import { logger } from '@shared/utils';
import type { MindMapStore } from '../types';
import { updateNodeCheckedInTree } from './helpers';


const updateNormalizedCheckbox = (state: MindMapStore, nodeId: string, checked: boolean) => {
  if (!state.normalizedData) return;
  const node = state.normalizedData.nodes[nodeId];
  if (node?.markdownMeta?.isCheckbox) {
    state.normalizedData.nodes[nodeId] = {
      ...node,
      markdownMeta: { ...node.markdownMeta, isChecked: checked }
    };
  }
};

const updateTreeCheckbox = (state: MindMapStore, nodeId: string, checked: boolean) => {
  if (!state.data) return;
  try {
    const updatedRootNodes = updateNodeCheckedInTree(state.data.rootNodes || [], nodeId, checked);
    state.data = {
      ...state.data,
      rootNodes: updatedRootNodes,
      updatedAt: new Date().toISOString()
    };
    logger.debug('Checkbox toggled for node:', nodeId, 'checked:', checked);
  } catch (error) {
    logger.error('toggleNodeCheckbox error:', error);
  }
};


export const createCheckboxOperations = (
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) => ({
  toggleNodeCheckbox: (nodeId: string, checked: boolean) => {
    set((state) => updateNormalizedCheckbox(state, nodeId, checked));
    requestAnimationFrame(() => {
      set((state) => updateTreeCheckbox(state, nodeId, checked));
      get().syncToMindMapData();
    });
  },
});
