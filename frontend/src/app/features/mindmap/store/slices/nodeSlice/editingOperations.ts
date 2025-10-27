/**
 * Editing operations for node text editing and UI state management - refactored with functional patterns
 * Reduced from 204 lines to 165 lines (19% reduction)
 */

import { logger } from '@shared/utils';
import { updateNormalizedNode, denormalizeTreeData } from '@core/data/normalizedStore';
import type { MindMapStore } from '../types';


type EditingMode = 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;

const clearEditingState = (state: MindMapStore) => {
  state.editingNodeId = null;
  state.editText = '';
  state.editingMode = null;
};

const endHistoryGroup = (get: () => MindMapStore, commit: boolean) => {
  const state = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
  try {
    state.endHistoryGroup?.(commit);
  } catch {}
};

const applyAutoLayoutIfEnabled = (get: () => MindMapStore, immediate: boolean = false) => {
  const { data, applyAutoLayout } = get();
  if (!data?.settings?.autoLayout) {
    logger.debug('Auto layout disabled or settings missing');
    return;
  }

  logger.debug('Applying auto layout', { immediate });
  if (typeof applyAutoLayout === 'function') {
    applyAutoLayout(immediate);
  } else {
    logger.error('applyAutoLayout function not found');
  }
};

const setEditingState = (state: MindMapStore, nodeId: string, mode: EditingMode) => {
  const node = state.normalizedData?.nodes[nodeId];
  if (node) {
    state.editingNodeId = nodeId;
    state.editText = node.text;
    state.editingMode = mode;
  }
};

const computeFallbackSelection = (
  state: MindMapStore,
  parentId: string | null,
  normalizedData: MindMapStore['normalizedData']
) => {
  const fallbackRef = state.lastSelectionBeforeInsert || null;

  if (fallbackRef && normalizedData?.nodes[fallbackRef]) {
    state.selectedNodeId = fallbackRef;
  } else if (parentId && parentId !== 'root') {
    state.selectedNodeId = parentId;
  } else if (parentId === 'root') {
    state.selectedNodeId = 'root';
  }

  state.lastSelectionBeforeInsert = null;
};


export function createEditingOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    selectNode: (nodeId: string | null) => {
      set((state) => {
        state.selectedNodeId = nodeId;
      });
    },

    startEditing: (nodeId: string) => {
      set((state) => setEditingState(state, nodeId, 'select-all'));
    },

    startEditingWithCursorAtEnd: (nodeId: string) => {
      set((state) => setEditingState(state, nodeId, 'cursor-at-end'));
    },

    startEditingWithCursorAtStart: (nodeId: string) => {
      set((state) => setEditingState(state, nodeId, 'cursor-at-start'));
    },

    finishEditing: (nodeId: string, text: string) => {
      // Empty text = delete node
      if (!text) {
        const { normalizedData } = get();
        const parentId = normalizedData?.parentMap[nodeId] || null;

        get().deleteNode(nodeId);
        endHistoryGroup(get, false);

        const { normalizedData: nd2 } = get();
        set((state) => {
          clearEditingState(state);
          computeFallbackSelection(state, parentId, nd2);
        });

        return;
      }

      // Update node text
      set((state) => {
        clearEditingState(state);
        state.selectedNodeId = nodeId;
        state.lastSelectionBeforeInsert = null;
      });

      get().updateNode(nodeId, { text });
      endHistoryGroup(get, true);

      logger.debug('Auto layout check (finishEditing):', {
        hasData: !!get().data,
        autoLayoutEnabled: get().data?.settings?.autoLayout
      });
      applyAutoLayoutIfEnabled(get);
    },

    cancelEditing: () => {
      set((state) => clearEditingState(state));
      endHistoryGroup(get, false);
    },

    setEditText: (text: string) => {
      set((state) => {
        state.editText = text;
      });
    },

    toggleNodeCollapse: (nodeId: string) => {
      const wasCollapsed = get().normalizedData?.nodes[nodeId]?.collapsed;

      set((state) => {
        if (!state.normalizedData) return;
        try {
          const node = state.normalizedData.nodes[nodeId];
          if (!node) return;

          const newCollapsedState = !node.collapsed;
          state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, { collapsed: newCollapsedState });

          if (state.data) {
            const newRootNodes = denormalizeTreeData(state.normalizedData);
            state.data = { ...state.data, rootNodes: newRootNodes, updatedAt: new Date().toISOString() };
          }
        } catch (error) {
          logger.error('toggleNodeCollapse error:', error);
        }
      });

      // Apply layout: immediate for expand, debounced for collapse
      applyAutoLayoutIfEnabled(get, !!wasCollapsed);
    },
  };
}
