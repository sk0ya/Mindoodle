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
export * from './eventManager';
export * from './lodash-utils';
export * from './logger';
export * from './mapPath';
// Navigation functions moved to @mindmap/utils/nodeOperations
// export * from './navigation';
export * from './pathOperations';
export * from './safeEmitStatus';
export * from './safeJson';
export * from './searchUtils';
export * from './stringUtils';
export * from './typeUtils';
// Validation - exclude isMindMapNode and validateMindMapNode to avoid conflicts with @mindmap/utils
export {
  isMindMapData,
  validateMindMapData,
  isValidFileExtension,
  isValidUrl,
  isSafeString,
  type DataValidationResult
} from './validation';

// Storage utilities (avoid type conflicts) - direct import since index.ts removed
export {
  STORAGE_KEYS,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  removeLocalStorageItems,
} from '../../core/storage/localStorage';
