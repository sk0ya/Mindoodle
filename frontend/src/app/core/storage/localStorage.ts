

import { logger, safeJsonParse, safeJsonStringify } from '@shared/utils';


export type LocalStorageResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};


export const STORAGE_KEYS = {
  
  APP_SETTINGS: 'mindflow_app_settings',
  STORAGE_MODE: 'mindflow_storage_mode',
  
  
  AI_SETTINGS: 'mindflow_ai_settings',
  
  
  NOTES_PANEL_WIDTH: 'mindflow_notes_panel_width',
  
  
  LAST_CLEANUP: 'mindflow_last_cleanup',

  
  FOLDER_GUIDE_DISMISSED: 'mindoodle_guide_dismissed',
  NODE_NOTE_PANEL_HEIGHT: 'mindoodle_node_note_panel_height',

  
  AUTH_TOKEN: 'mindoodle-auth-token',
  AUTH_USER: 'mindoodle-auth-user',
  GROUP_AUTH_TOKEN: 'mindoodle-group-auth-token',
  GROUP_AUTH_USER: 'mindoodle-group-auth-user',

  
  WORKSPACES: 'mindoodle-workspaces',

  
  ERROR_LOGS: 'mindflow_errors',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];


export class LocalStorageManager {
  private static instance: LocalStorageManager;
  
  private constructor() {}
  
  public static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }
  
  
  setItem<T>(key: StorageKey, value: T): LocalStorageResult<T> {
    try {
      const stringifyResult = safeJsonStringify(value);
      if (!stringifyResult.success) {
        logger.error(`❌ LocalStorage: JSON変換失敗`, { key, error: stringifyResult.error });
        return { success: false, error: stringifyResult.error || 'Stringify failed' };
      }
      const serialized = stringifyResult.data || '';
      localStorage.setItem(key, serialized);

      logger.debug(`💾 LocalStorage: 保存成功`, { key, type: typeof value });
      return { success: true, data: value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ LocalStorage: 保存失敗`, { key, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
  
  
  getItem<T>(key: StorageKey, defaultValue?: T): LocalStorageResult<T> {
    try {
      const item = localStorage.getItem(key);

      if (item === null) {
        logger.debug(`📋 LocalStorage: キー未発見 - デフォルト値使用`, { key });
        return {
          success: true,
          data: defaultValue
        };
      }

      const parseResult = safeJsonParse<T>(item);
      if (!parseResult.success) {
        logger.error(`❌ LocalStorage: JSON解析失敗`, { key, error: parseResult.error });
        return { success: false, error: parseResult.error || 'Parse failed', data: defaultValue };
      }
      const parsed = parseResult.data as T;
      logger.debug(`📋 LocalStorage: 取得成功`, { key, type: typeof parsed });
      return { success: true, data: parsed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ LocalStorage: 取得失敗`, { key, error: errorMessage });
      return { success: false, error: errorMessage, data: defaultValue };
    }
  }
  
  
  removeItem(key: StorageKey): LocalStorageResult<void> {
    try {
      localStorage.removeItem(key);
      logger.debug(`🗑️ LocalStorage: 削除成功`, { key });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ LocalStorage: 削除失敗`, { key, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
  
  
  removeItems(keys: StorageKey[]): LocalStorageResult<void> {
    try {
      keys.forEach(key => localStorage.removeItem(key));
      logger.debug(`🗑️ LocalStorage: 一括削除成功`, { keys, count: keys.length });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ LocalStorage: 一括削除失敗`, { keys, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
  
  
  getKeysWithPrefix(prefix: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }
  
  
  getStorageSize(): number {
    let total = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  }
}


export const localStorageManager = LocalStorageManager.getInstance();


export const setLocalStorage = <T>(key: StorageKey, value: T) => 
  localStorageManager.setItem(key, value);

export const getLocalStorage = <T>(key: StorageKey, defaultValue?: T) => 
  localStorageManager.getItem(key, defaultValue);

export const removeLocalStorage = (key: StorageKey) => 
  localStorageManager.removeItem(key);

export const removeLocalStorageItems = (keys: StorageKey[]) => 
  localStorageManager.removeItems(keys);
