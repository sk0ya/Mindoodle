import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Direct imports since slices/index.ts was removed
import { type MindMapStore } from './slices/types';
import { createDataSlice } from './slices/dataSlice';
import { createHistorySlice } from './slices/historySlice';
import { createUISlice } from './slices/uiSlice';
import { createNodeSlice } from './slices/nodeSlice';
import { createAISlice } from './slices/aiSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { mindMapEvents } from '@core/streams';

export const useMindMapStore = create<MindMapStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        ...createDataSlice(...args),
        ...createHistorySlice(...args),
        ...createUISlice(...args),
        ...createNodeSlice(...args),
        ...createAISlice(...args),
        ...createSettingsSlice(...args),
      }))
    )
  )
);

// Subscribe to model change events and commit history snapshots centrally
mindMapEvents.subscribe((e) => {
  try {
    if (e.type !== 'model.changed') {
      // ignore layout-only or others for history granularity
      console.debug('[events] ignored event', { type: e.type, source: e.source });
      return;
    }
    const state: any = useMindMapStore.getState();
    const depth = state._groupDepth || 0;
    if (depth > 0) {
      // mark dirty but don't commit yet
      state._groupDirty = true;
      console.debug('[history] group dirty set (no commit yet)', { source: e.source, depth });
    } else {
      const { scheduleCommitSnapshot } = state as { scheduleCommitSnapshot?: () => void };
      if (typeof scheduleCommitSnapshot === 'function') {
        console.debug('[history] scheduling commit (model.changed)', { source: e.source });
        scheduleCommitSnapshot();
      }
    }
  } catch {
    // noop
  }
});

// Export types for convenience
export type { MindMapStore } from './slices/types';
