
export * from './arrayUtils';
export * from './clipboard';
export * from './env';
export * from './eventUtils';
export * from './folderUtils';
// Re-export selected functional helpers to avoid name conflicts with arrayUtils
export { pipe, compose, groupBy, uniqueBy, partition, sortBy, pick, omit, mapValues, filterObject, memoize } from './functionalHelpers';
export * from './functionalReact';
export * from './hashUtils';
export * from './highlightUtils';
export * from './idGenerator';
export * from './lruCache';
export * from './listHeightUtils';
export * from './lodash-utils';
export * from './logger';
export * from './mapPath';
export * from './pathOperations';
export * from './safeEmitStatus';
export * from './safeJson';
export * from './globalSearch';
export * from './stringUtils';
export * from './typeUtils';

export {
  isMindMapData,
  validateMindMapData,
  isValidFileExtension,
  isValidUrl,
  isSafeString,
  type DataValidationResult
} from './validation';

export {
  STORAGE_KEYS,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  removeLocalStorageItems,
} from '../../core/storage/localStorage';
