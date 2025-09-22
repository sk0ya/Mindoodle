// Pure utility functions only - domain-agnostic helpers
export * from './arrayUtils';
export * from './clipboard';
export * from './env';
export * from './eventUtils';
export * from './folderUtils';
export * from './highlightUtils';
export * from './hookUtils';
export * from './idGenerator';
export * from './listHeightUtils';
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

// Re-export from other organized directories
export * from '../markdown';

// Storage utilities (avoid type conflicts)
export {
  STORAGE_KEYS,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  removeLocalStorageItems,
  validateFile,
  formatFileSize,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES
} from '../../core/storage';

// Mindmap utilities
export * from '../../features/mindmap/utils';
