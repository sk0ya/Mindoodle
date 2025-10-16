import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';


import { type MindMapStore } from './slices/types';
import { createDataSlice } from './slices/dataSlice';
import { createHistorySlice } from './slices/historySlice';
import { createUISlice } from './slices/uiSlice';
import { createNodeSlice } from './slices/nodeSlice';
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
        ...createSettingsSlice(...args),
      }))
    )
  )
);


mindMapEvents.subscribe((e) => {
  try {
    if (e.type !== 'model.changed') {

      return;
    }
    const state = useMindMapStore.getState() as MindMapStore & {
      _groupDepth?: number;
      _groupDirty?: boolean;
    };
    const depth = state._groupDepth || 0;
    if (depth > 0) {

      state._groupDirty = true;
    } else {
      const { scheduleCommitSnapshot } = state;
      if (typeof scheduleCommitSnapshot === 'function') {
        scheduleCommitSnapshot();
      }
    }
  } catch {

  }
});


export type { MindMapStore } from './slices/types';
