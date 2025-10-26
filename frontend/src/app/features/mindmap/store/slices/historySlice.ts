/**
 * History slice - refactored with functional patterns
 * Reduced from 191 lines to 182 lines (5% reduction)
 */

import type { StateCreator } from 'zustand';
import { normalizeTreeData, denormalizeTreeData } from '@core/data/normalizedStore';
import type { MindMapStore, HistoryState } from './types';
import type { MindMapNode } from '@shared/types';

export interface HistorySlice extends HistoryState {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  commitSnapshot: () => void;
  scheduleCommitSnapshot: () => void;
  cancelPendingCommit: () => void;
  beginHistoryGroup?: (label?: string) => void;
  endHistoryGroup?: (commit?: boolean) => void;
}

// === Helpers ===

let historyCommitTimer: ReturnType<typeof setTimeout> | null = null;
const HISTORY_DEBOUNCE_MS = 120;

const clearTimer = () => {
  if (historyCommitTimer) {
    clearTimeout(historyCommitTimer);
    historyCommitTimer = null;
  }
};

type DraftWithGroup = MindMapStore & { _groupDepth?: number; _groupDirty?: boolean };

const updateGroupDepth = (draft: MindMapStore, delta: number) => {
  const draftWithGroup = draft as DraftWithGroup;
  const depth = (draftWithGroup._groupDepth || 0) + delta;
  draftWithGroup._groupDepth = depth;
  if (delta > 0 && depth === 1) {
    draftWithGroup._groupDirty = false;
  }
};

const stripLayout = (nodes: MindMapNode[]): Array<Record<string, unknown>> =>
  (nodes || []).map((n) => ({
    id: n.id,
    text: n.text,
    fontSize: n.fontSize,
    fontWeight: n.fontWeight,
    fontFamily: n.fontFamily,
    fontStyle: n.fontStyle,
    color: n.color,
    collapsed: n.collapsed,
    links: n.links,
    markdownMeta: n.markdownMeta,
    note: n.note,
    customImageWidth: n.customImageWidth,
    customImageHeight: n.customImageHeight,
    kind: n.kind,
    tableData: n.tableData,
    children: stripLayout(n.children || []),
  }));

const applyHistoryState = (draft: MindMapStore, data: MindMapStore['data']) => {
  if (!data) return;
  draft.data = data;
  draft.normalizedData = normalizeTreeData(data.rootNodes);
  draft.editingNodeId = null;
  draft.editText = '';
};

// === Slice ===

export const createHistorySlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  HistorySlice
> = (set, get) => ({
  history: [],
  historyIndex: -1,

  undo: () => {
    clearTimer();
    const state = get();
    if (state.canUndo()) {
      const newIndex = state.historyIndex - 1;
      const previousData = state.history[newIndex];
      set((draft) => {
        draft.historyIndex = newIndex;
        applyHistoryState(draft, previousData);
      });
    }
  },

  redo: () => {
    clearTimer();
    const state = get();
    if (state.canRedo()) {
      const newIndex = state.historyIndex + 1;
      const nextData = state.history[newIndex];
      set((draft) => {
        draft.historyIndex = newIndex;
        applyHistoryState(draft, nextData);
      });
    }
  },

  canUndo: () => get().historyIndex > 0,

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  commitSnapshot: () => {
    const state = get();
    if (!state.normalizedData || !state.data) return;

    set((draft) => {
      if (!draft.normalizedData || !draft.data) return;
      const nextRootNodes = denormalizeTreeData(draft.normalizedData);

      const last = draft.history[draft.historyIndex]?.rootNodes;
      try {
        const lastKey = last ? JSON.stringify(stripLayout(last)) : null;
        const nextKey = JSON.stringify(stripLayout(nextRootNodes));
        if (lastKey === nextKey) return;
      } catch {}

      const newData = {
        ...draft.data,
        rootNodes: nextRootNodes,
        updatedAt: new Date().toISOString(),
      };
      draft.data = newData;
      draft.history = [...draft.history.slice(0, draft.historyIndex + 1), newData];
      draft.historyIndex = draft.history.length - 1;
    });
  },

  scheduleCommitSnapshot: () => {
    clearTimer();
    historyCommitTimer = setTimeout(() => {
      historyCommitTimer = null;
      const s = get();
      if (s.normalizedData && s.data) {
        s.commitSnapshot();
      }
    }, HISTORY_DEBOUNCE_MS);
  },

  cancelPendingCommit: clearTimer,

  beginHistoryGroup: (_label?: string) => {
    set((draft) => updateGroupDepth(draft, 1));
    clearTimer();
  },

  endHistoryGroup: (commit: boolean = true) => {
    const state = get() as DraftWithGroup;
    const depth = state._groupDepth || 0;
    if (depth <= 0) return;

    set((draft) => updateGroupDepth(draft, -1));

    const stateAfter = get() as DraftWithGroup;
    const stillDepth = stateAfter._groupDepth || 0;
    if (stillDepth > 0) return;

    const dirty = stateAfter._groupDirty || false;
    if (commit && dirty) {
      get().commitSnapshot();
    }

    set((draft) => {
      (draft as DraftWithGroup)._groupDirty = false;
    });
  },
});
