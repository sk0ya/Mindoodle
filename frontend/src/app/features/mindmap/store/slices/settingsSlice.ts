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

  // ノードテキスト折り返し設定
  nodeTextWrapEnabled: boolean;
  nodeTextWrapWidth: number; // 折り返し時の最大行幅（px）

  // ストレージ設定
  storageMode: StorageMode; // ローカル or ローカル+クラウド
  cloudApiEndpoint?: string; // クラウドAPIエンドポイント

  // エディタ設定
  // Legacy: vimMode (kept for storage backward-compat only)
  // Split Vim settings
  vimMindMap: boolean; // Mind map canvas Vim (default ON)
  vimEditor: boolean;  // Markdown editor Vim (default OFF)
  // Vim customization
  // Leader key and custom keybindings for Vim mode on the mind map canvas
  vimLeader: string; // single character leader (default ',')
  vimCustomKeybindings: Record<string, string>; // e.g. { '<leader>h': 'left' }
  vimMappingsSource: string; // text-based mapping source (vim-like)
  // Monaco Editor Vim mapping (separate from mind map mappings)
  vimEditorLeader: string;
  vimEditorCustomKeybindings: Record<string, string>;
  vimEditorMappingsSource: string;
  previewMode: boolean;

  // マークダウン設定
  addBlankLineAfterHeading: boolean; // 見出しノード追加時に空行を追加（デフォルト: true）
  defaultCollapseDepth?: number; // デフォルトで折りたたむ階層の深さ (0=折りたたまない, 1=1階層目から, 2=2階層目から)

  // 接続線の色設定
  edgeColorSet: string; // カラーセット名（vibrant, gentle, pastel, nord, warm, cool, monochrome, sunset）

  // 表示設定
  // マップ内のリンクを可視化（点線の矢印で表示）
  visualizeInMapLinks: boolean;

  // ナレッジグラフ設定
  knowledgeGraph: {
    enabled: boolean; // グラフ表示機能のON/OFF（デフォルト: false）
    modelDownloaded: boolean; // モデルダウンロード済みフラグ（内部管理用）
  };
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
  nodeTextWrapEnabled: true,
  nodeTextWrapWidth: 240,
  storageMode: 'local', // デフォルトはローカルストレージ
  cloudApiEndpoint: 'https://mindoodle-backend-production.shigekazukoya.workers.dev',
  vimMindMap: true,
  vimEditor: false,
  vimLeader: ',',
  vimCustomKeybindings: {},
  vimMappingsSource: `" Vim-style mappings for Mindoodle\n" Lines starting with '"' are comments.\n\nset leader ,\n\n" Examples:\n" map <leader>h left\n" map <leader>j down\n" map <leader>k up\n" map <leader>l right\n` ,
  vimEditorLeader: ',',
  vimEditorCustomKeybindings: {},
  vimEditorMappingsSource: `" Vim-style mappings for Monaco editor (experimental)\nset leader ,\n` ,
  previewMode: false,
  addBlankLineAfterHeading: true, // デフォルトで見出し後に空行を追加
  defaultCollapseDepth: 2, // デフォルトで2階層目から折りたたむ
  edgeColorSet: 'vibrant', // デフォルトのカラーセット
  visualizeInMapLinks: false, // デフォルトは非表示
  knowledgeGraph: {
    enabled: false, // デフォルトはOFF
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
    // 設定変更後に自動でlocalStorageに保存
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);

    // レイアウトに影響する設定の場合は自動レイアウトを実行
    const layoutAffectingSettings: (keyof AppSettings)[] = ['nodeSpacing', 'fontSize', 'nodeTextWrapEnabled', 'nodeTextWrapWidth'];
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

        // Migration: Update old cloudApiEndpoint to new production URL
        if (loaded.cloudApiEndpoint === 'https://mindoodle-backend.your-subdomain.workers.dev') {
          loaded.cloudApiEndpoint = DEFAULT_SETTINGS.cloudApiEndpoint;
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
