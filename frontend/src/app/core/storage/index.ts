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
