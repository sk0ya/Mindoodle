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


/**
 * What a listing knows about a map without its document: enough for the
 * sidebar, the command palette and the map switcher.
 */
export interface MapSummary {
  mapIdentifier: MapIdentifier;
  title: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
}

/** A map summary together with its stored markdown. */
export interface MapDocument extends MapSummary {
  markdown: string;
}

/**
 * Fired on `window` when a remote workspace rejects a write because the map
 * changed since this client last read it.
 */
export const MAP_CONFLICT_EVENT = 'mindoodle:mapConflict';

export interface MapConflictDetail {
  mapIdentifier: MapIdentifier;
  currentUpdatedAt?: string;
}

export interface StorageAdapter {

  readonly isInitialized: boolean;


  /**
   * Every map with its parsed tree. Expensive for remote adapters: prefer
   * `listMapSummaries` when only titles and versions are needed.
   */
  loadAllMaps(): Promise<MindMapData[]>;
  /**
   * Remote adapters: the map list without downloading any document. Throws
   * when the listing fails, so callers can tell a failure from an empty
   * workspace.
   */
  listMapSummaries?(): Promise<MapSummary[]>;
  /**
   * Remote adapters: every map's markdown, for consumers that genuinely need
   * contents (full-text search). Unchanged documents are served from cache.
   */
  loadMapDocuments?(): Promise<MapDocument[]>;
  addMapToList(map: MindMapData): Promise<void>;
  removeMapFromList(id: MapIdentifier): Promise<void>;

  
  createFolder?(relativePath: string, workspaceId?: string): Promise<void>;

  
  getExplorerTree?(): Promise<ExplorerItem>;
  renameItem?(path: string, newName: string): Promise<void>;
  deleteItem?(path: string): Promise<void>;
  moveItem?(sourcePath: string, targetFolderPath: string): Promise<void>;

  
  getMapMarkdown?(id: MapIdentifier): Promise<string | null>;
  getMapLastModified?(id: MapIdentifier): Promise<number | null>;
  saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void>;
  saveImageFile?(relativePath: string, file: File | Blob, workspaceId?: string): Promise<void>;

  // Optional helpers for local adapters
  selectRootFolder?(): Promise<void>;
  readImageAsDataURL?(relativePath: string, workspaceId: string): Promise<string | null>;
  listMapIdentifiers?(): Promise<Array<{ mapId: string; workspaceId: string }>>;

  
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
