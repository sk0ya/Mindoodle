// Pure utility functions only - domain-agnostic helpers
export * from './arrayUtils';
export * from './clipboard';
export * from './env';
export * from './eventUtils';
export * from './folderUtils';
export * from './highlightUtils';
export * from './hookUtils';
export * from './idGenerator';
export * from './lruCache';
export * from './listHeightUtils';
export * from './setUtils';
export * from './memoryManager';
export * from './eventManager';
// Avoid re-exporting memoryMonitor to prevent auto-start side effects
export * from './memoryUtils';
export * from './lodash-utils';
export * from './logger';
export * from './mapPath';
export * from './navigation';
export * from './safeEmitStatus';
export * from './safeJson';
export * from './searchUtils';
export * from './stringUtils';
export * from './typeUtils';
export * from './validation';

// Storage utilities (avoid type conflicts) - direct import since index.ts removed
export {
  STORAGE_KEYS,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  removeLocalStorageItems,
} from '../../core/storage/localStorage';
