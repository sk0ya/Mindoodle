import type { MindMapData, MapIdentifier } from '@shared/types';

// Storage operation results
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Map persistence operations
export interface MapPersistenceOperations {
  // Map CRUD
  loadInitialData: () => Promise<void>;
  
  // Map list management
  refreshMapList: () => Promise<void>;
  addMapToList: (mapData: MindMapData) => Promise<void>;
  removeMapFromList: (id: MapIdentifier) => Promise<void>;
  
}

// Storage configuration
export interface StorageConfiguration {
  mode: 'local' | 'cloud';
  settings?: {
    autoSave?: boolean;
    syncInterval?: number;
    retryAttempts?: number;
  };
}

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  lastSync?: Date;
  pendingOperations: number;
  isSyncing: boolean;
  error?: string;
}

// Storage state
export interface StorageState {
  isInitialized: boolean;
  allMindMaps: MindMapData[];
  syncStatus: SyncStatus;
  configuration: StorageConfiguration;
}
