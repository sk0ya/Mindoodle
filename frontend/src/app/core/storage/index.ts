// Storage abstraction barrel exports
export type {
  StorageAdapter,
  StorageConfig,
  StorageMode,
  SyncStatus,
  StorageAdapterFactory as IStorageAdapterFactory
} from '../types/storage.types';

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
