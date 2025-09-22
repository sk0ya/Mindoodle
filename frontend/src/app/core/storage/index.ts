// Storage abstraction barrel exports
export type {
  StorageAdapter,
  StorageConfig,
  StorageMode,
  SyncStatus,
  StorageEvents,
  StorageAdapterFactory as IStorageAdapterFactory
} from './types';

// Mindoodle: only markdown folder adapter is used

export {
  StorageAdapterFactory,
  defaultStorageAdapterFactory,
  createStorageAdapter,
} from './StorageAdapterFactory';

// Local storage utilities
export {
  LocalStorageManager,
  localStorageManager,
  setLocalStorage,
  getLocalStorage,
  removeLocalStorage,
  removeLocalStorageItems,
  STORAGE_KEYS
} from './localStorage';
export type { LocalStorageResult, StorageKey } from './localStorage';

// File utilities
export {
  validateFile,
  formatFileSize,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES
} from './fileUtils';
