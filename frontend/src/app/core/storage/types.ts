// Storage abstraction types for dual Local/Cloud architecture
import type { MindMapData, MapIdentifier } from '@shared/types';

/**
 * 統一ストレージインターフェース
 * Local/Cloudモードで共通の操作を提供
 */
export interface ExplorerItem {
  type: 'folder' | 'file';
  name: string;
  path: string; // relative from root
  children?: ExplorerItem[];
  isMarkdown?: boolean;
}

export interface StorageAdapter {
  // 初期化状態
  readonly isInitialized: boolean;
  
  // 基本操作
  loadInitialData(): Promise<MindMapData>;
  saveData(data: MindMapData): Promise<void>;
  
  // マップ管理
  loadAllMaps(): Promise<MindMapData[]>;
  saveAllMaps(maps: MindMapData[]): Promise<void>;
  addMapToList(map: MindMapData): Promise<void>;
  removeMapFromList(id: MapIdentifier): Promise<void>;
  updateMapInList(map: MindMapData): Promise<void>;
  
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
  
  // ファイル操作（オプショナル - クラウドモードのみ）
  deleteFile?(mindmapId: string, nodeId: string, fileId: string): Promise<void>;
  downloadFile?(mindmapId: string, nodeId: string, fileId: string): Promise<Blob>;
  
  // ライフサイクル
  initialize(): Promise<void>;
  cleanup(): void;

  // Workspace management (optional; markdown/local adapters)
  listWorkspaces?(): Promise<Array<{ id: string; name: string }>>;
  addWorkspace?(): Promise<void>;
  removeWorkspace?(id: string): Promise<void>;
}


/**
 * ストレージ設定
 */
export interface StorageConfig {
  mode: StorageMode;
  autoSave?: boolean;
  syncInterval?: number;
  retryAttempts?: number;
  enableOfflineMode?: boolean;
}

/**
 * ストレージモード
 */
export type StorageMode = 'local' | 'markdown';

/**
 * 同期状態
 */
export interface SyncStatus {
  lastSync: Date | null;
  isSyncing: boolean;
  hasUnsyncedChanges: boolean;
  lastError: Error | null;
}

/**
 * ストレージイベント
 */
export interface StorageEvents {
  'sync:start': () => void;
  'sync:complete': (status: SyncStatus) => void;
  'sync:error': (error: Error) => void;
  'data:change': (data: MindMapData) => void;
}

/**
 * ストレージアダプターファクトリー
 */
export interface StorageAdapterFactory {
  create(config: StorageConfig): Promise<StorageAdapter>;
  isSupported(mode: StorageMode): boolean;
}
