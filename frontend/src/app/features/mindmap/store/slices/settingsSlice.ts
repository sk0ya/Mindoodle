/**
 * Settings slice - refactored with functional patterns
 * Reduced from 124 lines to 115 lines (7% reduction)
 */

import type { StateCreator } from 'zustand';
import type { MindMapStore, AppSettings, SettingsSlice } from './types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@shared/utils';

export type { AppSettings, SettingsSlice };

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'system-ui',
  nodeSpacing: 8,
  nodeTextWrapEnabled: true,
  nodeTextWrapWidth: 240,
  showVisualContentByDefault: true,
  layoutType: 'mindmap',
  storageMode: 'local',
  cloudApiEndpoint: 'https://mindoodle-backend-production.shigekazukoya.workers.dev',
  vimMindMap: true,
  vimEditor: false,
  vimLeader: ',',
  vimCustomKeybindings: {},
  vimMappingsSource: `" Vim-style mappings for Mindoodle\n" Lines starting with '"' are comments.\n\nset leader ,\n\n" Examples:\n" map <leader>h left\n" map <leader>j down\n" map <leader>k up\n" map <leader>l right\n`,
  vimEditorLeader: ',',
  vimEditorCustomKeybindings: {},
  vimEditorMappingsSource: `" Vim-style mappings for CodeMirror editor (experimental)\nset leader ,\n`,
  previewMode: false,
  addBlankLineAfterHeading: true,
  defaultCollapseDepth: 2,
  edgeColorSet: 'vibrant',
  visualizeInMapLinks: false,
  knowledgeGraph: { enabled: false, modelDownloaded: false },
};

const LAYOUT_AFFECTING_SETTINGS: (keyof AppSettings)[] = [
  'nodeSpacing',
  'fontSize',
  'nodeTextWrapEnabled',
  'nodeTextWrapWidth',
  'showVisualContentByDefault',
  'layoutType'
];

const applyLayoutAfterDelay = (get: () => MindMapStore) => {
  // applyAutoLayout already has its own debouncing, no need for additional delay
  get().applyAutoLayout?.();
};

const saveSettingsAfterDelay = (get: () => MindMapStore) => {
  setTimeout(() => get().saveSettingsToStorage(), 0);
};

const shouldApplyLayout = (keys: (keyof AppSettings)[]): boolean =>
  keys.some(key => LAYOUT_AFFECTING_SETTINGS.includes(key));

export const createSettingsSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    set((state) => {
      state.settings[key] = value;
    });
    saveSettingsAfterDelay(get);
    if (LAYOUT_AFFECTING_SETTINGS.includes(key)) {
      applyLayoutAfterDelay(get);
    }
  },

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => {
      Object.assign(state.settings, newSettings);
    });
    saveSettingsAfterDelay(get);
    if (shouldApplyLayout(Object.keys(newSettings) as (keyof AppSettings)[])) {
      applyLayoutAfterDelay(get);
    }
  },

  resetSettings: () => {
    set((state) => {
      state.settings = { ...DEFAULT_SETTINGS };
    });
    get().saveSettingsToStorage();
  },

  loadSettingsFromStorage: () => {
    const result = getLocalStorage(STORAGE_KEYS.APP_SETTINGS, DEFAULT_SETTINGS);
    if (result.success && result.data) {
      set((state) => {
        const loaded: AppSettings = { ...DEFAULT_SETTINGS, ...result.data };

        const legacyData = result.data as AppSettings & { vimMode?: boolean };
        if (typeof legacyData.vimMode === 'boolean') {
          if (typeof loaded.vimMindMap !== 'boolean') loaded.vimMindMap = legacyData.vimMode;
          if (typeof loaded.vimEditor !== 'boolean') loaded.vimEditor = legacyData.vimMode;
        }

        if (loaded.cloudApiEndpoint === 'https://mindoodle-backend.your-subdomain.workers.dev') {
          loaded.cloudApiEndpoint = DEFAULT_SETTINGS.cloudApiEndpoint;
        }

        state.settings = loaded;
      });
    }
  },

  saveSettingsToStorage: () => {
    const { settings } = get();
    setLocalStorage(STORAGE_KEYS.APP_SETTINGS, settings);
  },
});
