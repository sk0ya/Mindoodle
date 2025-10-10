import type { StateCreator } from 'zustand';
import { normalizeTreeData, denormalizeTreeData } from '@core/data/normalizedStore';


let historyCommitTimer: ReturnType<typeof setTimeout> | null = null;
const HISTORY_DEBOUNCE_MS = 120;
import type { MindMapStore, HistoryState } from './types';

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

export const createHistorySlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  HistorySlice
> = (set, get) => ({
  
  history: [],
  historyIndex: -1,
  

  
  undo: () => {
    
    if (historyCommitTimer) { clearTimeout(historyCommitTimer); historyCommitTimer = null; }
    const state = get();
    if (state.canUndo()) {
      const newIndex = state.historyIndex - 1;
      const previousData = state.history[newIndex];
      
      set((draft) => {
        draft.historyIndex = newIndex;
        draft.data = previousData;
        
        
        draft.normalizedData = normalizeTreeData(previousData.rootNodes);
        
        
        draft.editingNodeId = null;
        draft.editText = '';
      });
    }
  },

  redo: () => {
    // Avoid racing pending commit against redo
    if (historyCommitTimer) { clearTimeout(historyCommitTimer); historyCommitTimer = null; }
    const state = get();
    if (state.canRedo()) {
      const newIndex = state.historyIndex + 1;
      const nextData = state.history[newIndex];
      
      set((draft) => {
        draft.historyIndex = newIndex;
        draft.data = nextData;
        
        // Only use rootNodes array
        draft.normalizedData = normalizeTreeData(nextData.rootNodes);
        
        // Clear editing state when redoing
        draft.editingNodeId = null;
        draft.editText = '';
      });
    }
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

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

      
      const stripLayout = (nodes: any[]): any[] =>
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
    if (historyCommitTimer) clearTimeout(historyCommitTimer);
    historyCommitTimer = setTimeout(() => {
      historyCommitTimer = null;
      const s = get();
      if (s.normalizedData && s.data) {
        s.commitSnapshot();
      }
    }, HISTORY_DEBOUNCE_MS);
  },

  
  cancelPendingCommit: () => {
    if (historyCommitTimer) {
      clearTimeout(historyCommitTimer);
      historyCommitTimer = null;
    }
  },

  
  beginHistoryGroup: (_label?: string) => {
    
    set((draft: any) => {
      const depth = (draft._groupDepth || 0) + 1;
      draft._groupDepth = depth;
      if (depth === 1) {
        draft._groupDirty = false;
      }
    });
    
    if (historyCommitTimer) { clearTimeout(historyCommitTimer); historyCommitTimer = null; }
  },

  
  endHistoryGroup: (commit: boolean = true) => {
    const depth = (get() as any)._groupDepth || 0;
    if (depth <= 0) return;
    set((draft: any) => {
      draft._groupDepth = depth - 1;
    });
    const stillDepth = (get() as any)._groupDepth || 0;
    if (stillDepth > 0) return; 
    const dirty = (get() as any)._groupDirty || false;
    if (commit && dirty) {
      
      (get() as any).commitSnapshot();
    }
    set((draft: any) => { draft._groupDirty = false; });
  },
});
