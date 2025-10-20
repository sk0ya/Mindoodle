import type { StateCreator } from 'zustand';
import type { MindMapStore, AppSettings, SettingsSlice } from './types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@shared/utils';

// Re-export types for external use
export type { AppSettings, SettingsSlice };

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'system-ui',
  nodeSpacing: 8, 
  nodeTextWrapEnabled: true,
  nodeTextWrapWidth: 240,
  storageMode: 'local', 
  cloudApiEndpoint: 'https://mindoodle-backend-production.shigekazukoya.workers.dev',
  vimMindMap: true,
  vimEditor: false,
  vimLeader: ',',
  vimCustomKeybindings: {},
  vimMappingsSource: `" Vim-style mappings for Mindoodle\n" Lines starting with '"' are comments.\n\nset leader ,\n\n" Examples:\n" map <leader>h left\n" map <leader>j down\n" map <leader>k up\n" map <leader>l right\n` ,
  vimEditorLeader: ',',
  vimEditorCustomKeybindings: {},
  vimEditorMappingsSource: `" Vim-style mappings for CodeMirror editor (experimental)\nset leader ,\n` ,
  previewMode: false,
  addBlankLineAfterHeading: true, 
  defaultCollapseDepth: 2, 
  edgeColorSet: 'vibrant', 
  visualizeInMapLinks: false, 
  knowledgeGraph: {
    enabled: false, 
    modelDownloaded: false,
  },
};

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
    
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);

    
    const layoutAffectingSettings: (keyof AppSettings)[] = ['nodeSpacing', 'fontSize', 'nodeTextWrapEnabled', 'nodeTextWrapWidth'];
    if (layoutAffectingSettings.includes(key)) {
      setTimeout(() => {
        const state = get();
        if (state.applyAutoLayout) {
          state.applyAutoLayout();
        }
      }, 50); 
    }
  },

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => {
      Object.assign(state.settings, newSettings);
    });
    
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);

    
    const layoutAffectingSettings: (keyof AppSettings)[] = ['nodeSpacing', 'fontSize', 'nodeTextWrapEnabled', 'nodeTextWrapWidth'];
    const hasLayoutAffectingChanges = layoutAffectingSettings.some(setting =>
      setting in newSettings
    );

    if (hasLayoutAffectingChanges) {
      setTimeout(() => {
        const state = get();
        if (state.applyAutoLayout) {
          state.applyAutoLayout();
        }
      }, 50); 
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
