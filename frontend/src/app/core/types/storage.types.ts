import type { MindMapData, MapIdentifier } from '@shared/types';


export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}


export interface ExplorerItem {
  type: 'folder' | 'file';
  name: string;
  path: string; 
  children?: ExplorerItem[];
  isMarkdown?: boolean;
}


export interface StorageAdapter {
  
  readonly isInitialized: boolean;

  
  loadAllMaps(): Promise<MindMapData[]>;
  addMapToList(map: MindMapData): Promise<void>;
  removeMapFromList(id: MapIdentifier): Promise<void>;

  
  createFolder?(relativePath: string): Promise<void>;

  
  getExplorerTree?(): Promise<ExplorerItem>;
  renameItem?(path: string, newName: string): Promise<void>;
  deleteItem?(path: string): Promise<void>;
  moveItem?(sourcePath: string, targetFolderPath: string): Promise<void>;

  
  getMapMarkdown?(id: MapIdentifier): Promise<string | null>;
  getMapLastModified?(id: MapIdentifier): Promise<number | null>;
  saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void>;

  
  initialize(): Promise<void>;
  cleanup(): void;

  
  listWorkspaces?(): Promise<Array<{ id: string; name: string }>>;
  addWorkspace?(): Promise<void>;
  removeWorkspace?(id: string): Promise<void>;
}


export interface MapPersistenceOperations {
  
  refreshMapList: () => Promise<void>;
  addMapToList: (mapData: MindMapData) => Promise<void>;
  removeMapFromList: (id: MapIdentifier) => Promise<void>;
}


export type StorageMode = 'local' | 'local+cloud';


export interface StorageConfig {
  mode: StorageMode;
  autoSave?: boolean;
  syncInterval?: number;
  retryAttempts?: number;
  enableOfflineMode?: boolean;
  
  cloudApiEndpoint?: string;
  authToken?: string;
}



export interface StorageAdapterFactory {
  create(config: StorageConfig): Promise<StorageAdapter>;
  isSupported(mode: StorageMode): boolean;
}