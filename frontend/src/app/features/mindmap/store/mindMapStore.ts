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

const storeInitializer = (set: any, get: any, store: any) => ({
  ...createDataSlice(set, get, store),
  ...createHistorySlice(set, get, store),
  ...createUISlice(set, get, store),
  ...createNodeSlice(set, get, store),
  ...createSettingsSlice(set, get, store),
});

// Always apply devtools in type definition, but conditionally enable in runtime
export const useMindMapStore = create<MindMapStore>()(
  devtools(subscribeWithSelector(immer(storeInitializer)), {
    enabled: import.meta.env?.DEV ?? false,
  })
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
