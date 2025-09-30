import type { StateCreator } from 'zustand';
import type { MindMapStore } from './types';
import type { StorageMode } from '@core/types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@shared/utils';

export interface AppSettings {
  // テーマ設定
  theme: 'dark' | 'light';

  // フォント設定
  fontSize: number;
  fontFamily: string;

  // レイアウト設定
  nodeSpacing: number; // ノード間隔（ピクセル）

  // ストレージ設定
  storageMode: StorageMode; // ローカル or ローカル+クラウド
  cloudApiEndpoint?: string; // クラウドAPIエンドポイント

  // エディタ設定
  // Legacy: vimMode (kept for storage backward-compat only)
  // Split Vim settings
  vimMindMap: boolean; // Mind map canvas Vim (default ON)
  vimEditor: boolean;  // Markdown editor Vim (default OFF)
  previewMode: boolean;
}

export interface SettingsSlice {
  settings: AppSettings;
  
  // Settings Actions
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadSettingsFromStorage: () => void;
  saveSettingsToStorage: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'system-ui',
  nodeSpacing: 8, // デフォルトノード間隔8px
  storageMode: 'local', // デフォルトはローカルストレージ
  cloudApiEndpoint: 'https://mindoodle-backend.your-subdomain.workers.dev',
  vimMindMap: true,
  vimEditor: false,
  previewMode: false,
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
    // 設定変更後に自動でlocalStorageに保存
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);

    // レイアウトに影響する設定の場合は自動レイアウトを実行
    const layoutAffectingSettings: (keyof AppSettings)[] = ['nodeSpacing', 'fontSize'];
    if (layoutAffectingSettings.includes(key)) {
      setTimeout(() => {
        const state = get();
        if (state.applyAutoLayout) {
          state.applyAutoLayout();
        }
      }, 50); // 設定反映後に少し遅延してレイアウト実行
    }
  },

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => {
      Object.assign(state.settings, newSettings);
    });
    // 設定変更後に自動でlocalStorageに保存
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);

    // レイアウトに影響する設定が含まれている場合は自動レイアウトを実行
    const layoutAffectingSettings: (keyof AppSettings)[] = ['nodeSpacing', 'fontSize'];
    const hasLayoutAffectingChanges = layoutAffectingSettings.some(setting =>
      setting in newSettings
    );

    if (hasLayoutAffectingChanges) {
      setTimeout(() => {
        const state = get();
        if (state.applyAutoLayout) {
          state.applyAutoLayout();
        }
      }, 50); // 設定反映後に少し遅延してレイアウト実行
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
        const loaded: any = { ...DEFAULT_SETTINGS, ...result.data };
        // Backward compatibility: map legacy vimMode to new keys if present and new keys missing
        if (typeof (result.data as any).vimMode === 'boolean') {
          if (typeof loaded.vimMindMap !== 'boolean') loaded.vimMindMap = (result.data as any).vimMode;
          if (typeof loaded.vimEditor !== 'boolean') loaded.vimEditor = (result.data as any).vimMode;
        }
        state.settings = loaded as AppSettings;
      });
    }
  },

  saveSettingsToStorage: () => {
    const { settings } = get();
    setLocalStorage(STORAGE_KEYS.APP_SETTINGS, settings);
  },
});
