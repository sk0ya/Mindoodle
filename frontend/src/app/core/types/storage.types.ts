import type { MindMapData, MapIdentifier } from '@shared/types';

// Storage operation results
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Explorer item for file system operations
export interface ExplorerItem {
  type: 'folder' | 'file';
  name: string;
  path: string; // relative from root
  children?: ExplorerItem[];
  isMarkdown?: boolean;
}

// Storage adapter interface
export interface StorageAdapter {
  // 初期化状態
  readonly isInitialized: boolean;

  // マップ管理
  loadAllMaps(): Promise<MindMapData[]>;
  addMapToList(map: MindMapData): Promise<void>;
  removeMapFromList(id: MapIdentifier): Promise<void>;

  // File system operations (optional)
  createFolder?(relativePath: string): Promise<void>;

  // Explorer tree (optional)
  getExplorerTree?(): Promise<ExplorerItem>;
  renameItem?(path: string, newName: string): Promise<void>;
  deleteItem?(path: string): Promise<void>;
  moveItem?(sourcePath: string, targetFolderPath: string): Promise<void>;

  // Markdown helpers (optional)
  getMapMarkdown?(id: MapIdentifier): Promise<string | null>;
  getMapLastModified?(id: MapIdentifier): Promise<number | null>;
  saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void>;

  // ライフサイクル
  initialize(): Promise<void>;
  cleanup(): void;

  // Workspace management (optional; markdown/local adapters)
  listWorkspaces?(): Promise<Array<{ id: string; name: string }>>;
  addWorkspace?(): Promise<void>;
  removeWorkspace?(id: string): Promise<void>;
}

// Map persistence operations
export interface MapPersistenceOperations {
  // Map list management
  refreshMapList: () => Promise<void>;
  addMapToList: (mapData: MindMapData) => Promise<void>;
  removeMapFromList: (id: MapIdentifier) => Promise<void>;
}

// Storage mode type
export type StorageMode = 'local' | 'markdown';

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  lastSync?: Date;
  pendingOperations: number;
  isSyncing: boolean;
  error?: string;
}

// Storage configuration type
export interface StorageConfig {
  mode: StorageMode;
  autoSave?: boolean;
  syncInterval?: number;
  retryAttempts?: number;
  enableOfflineMode?: boolean;
}


// Storage adapter factory
export interface StorageAdapterFactory {
  create(config: StorageConfig): Promise<StorageAdapter>;
  isSupported(mode: StorageMode): boolean;
}