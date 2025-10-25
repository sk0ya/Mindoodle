import { logger } from '@shared/utils';
import { updateNormalizedNode, denormalizeTreeData } from '@core/data/normalizedStore';
import type { MindMapStore } from '../types';

/**
 * Editing operations for node text editing and UI state management
 */
export function createEditingOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Select a node for focus
     */
    selectNode: (nodeId: string | null) => {
      set((state) => {
        state.selectedNodeId = nodeId;
      });
    },

    /**
     * Start editing a node with select-all mode
     */
    startEditing: (nodeId: string) => {
      set((state) => {
        const node = state.normalizedData?.nodes[nodeId];
        if (node) {
          state.editingNodeId = nodeId;
          state.editText = node.text;
          state.editingMode = 'select-all';
        }
      });
    },

    /**
     * Start editing a node with cursor at end
     */
    startEditingWithCursorAtEnd: (nodeId: string) => {
      set((state) => {
        const node = state.normalizedData?.nodes[nodeId];
        if (node) {
          state.editingNodeId = nodeId;
          state.editText = node.text;
          state.editingMode = 'cursor-at-end';
        }
      });
    },

    /**
     * Start editing a node with cursor at start
     */
    startEditingWithCursorAtStart: (nodeId: string) => {
      set((state) => {
        const node = state.normalizedData?.nodes[nodeId];
        if (node) {
          state.editingNodeId = nodeId;
          state.editText = node.text;
          state.editingMode = 'cursor-at-start';
        }
      });
    },

    /**
     * Finish editing a node
     * If text is empty, delete the node instead
     */
    finishEditing: (nodeId: string, text: string) => {
      // Empty text = delete node
      if (!text) {
        let parentId: string | null = null;
        const { normalizedData } = get();
        if (normalizedData) {
          parentId = normalizedData.parentMap[nodeId] || null;
        }

        // Delete the node
        get().deleteNode(nodeId);

        const state4 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
        try { state4.endHistoryGroup?.(false); } catch {}

        // Compute fallback selection
        const { normalizedData: nd2 } = get();
        set((state) => {
          const fallbackRef = state.lastSelectionBeforeInsert || null;

          state.editingNodeId = null;
          state.editText = '';
          state.editingMode = null;
          // Compute selection
          if (fallbackRef && nd2 && nd2.nodes[fallbackRef]) {
            state.selectedNodeId = fallbackRef;
          } else if (parentId && parentId !== 'root') {
            state.selectedNodeId = parentId;
          } else if (parentId === 'root') {
            state.selectedNodeId = 'root';
          }

          state.lastSelectionBeforeInsert = null;
        });

        return;
      }

      // Update node text
      set((state) => {
        state.editingNodeId = null;
        state.editText = '';
        state.editingMode = null;
        // Keep node selected after editing
        state.selectedNodeId = nodeId;
        // Clear any pending fallback reference on successful edit
        state.lastSelectionBeforeInsert = null;
      });

      // Update the node text
      get().updateNode(nodeId, { text: text });
      // End group with commit – treat insert+text as single change
      const state5 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
      try { state5.endHistoryGroup?.(true); } catch {}

      // Apply auto layout if enabled (debounced to batch multiple rapid operations)
      const { data } = get();
      logger.debug('🔍 Auto layout check (finishEditing):', {
        hasData: !!data,
        hasSettings: !!data?.settings,
        autoLayoutEnabled: data?.settings?.autoLayout,
        settingsObject: data?.settings
      });
      if (data?.settings?.autoLayout) {
        logger.debug('✅ Applying auto layout after finishEditing');
        const applyAutoLayout = get().applyAutoLayout;
        if (typeof applyAutoLayout === 'function') {
          applyAutoLayout();
        } else {
          logger.error('❌ applyAutoLayout function not found');
        }
      } else {
        logger.debug('❌ Auto layout disabled or settings missing');
      }
    },

    /**
     * Cancel editing without saving changes
     */
    cancelEditing: () => {
      set((state) => {
        state.editingNodeId = null;
        state.editText = '';
        state.editingMode = null;
      });
      // End history group without commit if editing was cancelled
      const state6 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
      try { state6.endHistoryGroup?.(false); } catch {}
    },

    /**
     * Update the editing text in real-time
     */
    setEditText: (text: string) => {
      set((state) => {
        state.editText = text;
      });
    },

    /**
     * Toggle node collapse/expand state
     * For expanding nodes, applies layout immediately to ensure child positions are correct
     */
    toggleNodeCollapse: (nodeId: string) => {
      // Track previous collapse state
      const wasCollapsed = get().normalizedData?.nodes[nodeId]?.collapsed;

      set((state) => {
        if (!state.normalizedData) return;
        try {
          const node = state.normalizedData.nodes[nodeId];
          if (!node) return;
          const newCollapsedState = !node.collapsed;
          state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, { collapsed: newCollapsedState });
          // Reflect into tree data without emitting history events
          if (state.data) {
            const newRootNodes = denormalizeTreeData(state.normalizedData);
            state.data = { ...state.data, rootNodes: newRootNodes, updatedAt: new Date().toISOString() };
          }
        } catch (error) {
          logger.error('toggleNodeCollapse error:', error);
        }
      });

      // For expanding nodes (wasCollapsed === true), apply layout immediately
      // to ensure child nodes have correct positions before rendering
      const { data } = get();
      if (data?.settings?.autoLayout && wasCollapsed) {
        // Force immediate layout execution for expand operations
        get().applyAutoLayout(true);
      } else if (data?.settings?.autoLayout) {
        // Regular debounced layout for collapse operations
        get().applyAutoLayout();
      }
    },
  };
}
