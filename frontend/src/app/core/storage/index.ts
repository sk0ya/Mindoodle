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
