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

// Export types for convenience
export type { MindMapStore } from './slices/types';