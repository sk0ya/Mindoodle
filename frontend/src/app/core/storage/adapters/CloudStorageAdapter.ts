import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../../types/storage.types';
import { logger, getLocalStorage, setLocalStorage, removeLocalStorage, STORAGE_KEYS } from '@shared/utils';
import { WorkspaceService } from '@shared/services';
import { MarkdownImporter } from '../../../features/markdown/markdownImporter';
import { nodeToMarkdown } from '../../../features/markdown/markdownExport';

interface CloudUser {
  id: string;
  email: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: CloudUser;
  error?: string;
}

interface MeResponse {
  success: boolean;
  user?: CloudUser;
}

interface MapsListResponse {
  success: boolean;
  maps?: Array<{ id: string; title?: string; createdAt?: string; updatedAt?: string }>;
  error?: string;
}

interface MapDetailResponse {
  success: boolean;
  map?: { id: string; title?: string; content?: string; createdAt: string; updatedAt: string };
  error?: string;
}

interface ImagesListResponse {
  success: boolean;
  files?: string[];
}

interface ImageGetResponse {
  success: boolean;
  data?: string;
  contentType?: string;
}

export class CloudStorageAdapter implements StorageAdapter {
  private _isInitialized = false;
  private baseUrl: string;
  private authToken: string | null = null;
  private user: CloudUser | null = null;
  private virtualFolders: Set<string> = new Set();

  constructor(baseUrl = 'https://mindoodle-backend-production.shigekazukoya.workers.dev') {
    this.baseUrl = baseUrl;
  }

  
  

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get isAuthenticated(): boolean {
    return !!this.authToken && !!this.user;
  }

  async initialize(): Promise<void> {
    
    try {
      const tokenRes = getLocalStorage<string>(STORAGE_KEYS.AUTH_TOKEN);
      const userRes = getLocalStorage<CloudUser>(STORAGE_KEYS.AUTH_USER);

      if (tokenRes.success && tokenRes.data && userRes.success && userRes.data) {
        this.authToken = tokenRes.data;
        this.user = userRes.data;

        
        const isValid = await this.verifyAuth();

        if (!isValid) {
          this.clearAuth();
        } else {
          
          const workspaceService = WorkspaceService.getInstance();
          workspaceService.restoreCloudWorkspace(this);
        }
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to restore auth from localStorage', error);
      this.clearAuth();
    }

    this._isInitialized = true;
    logger.info(`CloudStorageAdapter: Initialized, authenticated: ${this.isAuthenticated}`);
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {})
    };
    
    if (!isFormData && !('Content-Type' in headers)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      
      let errMsg = response.statusText || 'Network error';
      try {
        const errorData = await response.json();
        errMsg = errorData.error || errMsg;
      } catch {}
      throw new Error(errMsg || `HTTP ${response.status}`);
    }

    
    return await response.json() as T;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success && response.token && response.user) {
        this.authToken = response.token;
        this.user = response.user;
        this.saveAuth();
      }

      return response;
    } catch (error) {
      logger.error('CloudStorageAdapter: Registration failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success && response.token && response.user) {
        this.authToken = response.token;
        this.user = response.user;
        this.saveAuth();
      }

      return response;
    } catch (error) {
      logger.error('CloudStorageAdapter: Login failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        await this.makeRequest('/api/auth/logout', {
          method: 'POST'
        });
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Logout request failed', error);
    } finally {
      this.clearAuth();
    }
  }

  private async verifyAuth(): Promise<boolean> {
    try {
      const response = await this.makeRequest<MeResponse>('/api/auth/me');
      return !!response.success;
    } catch (error) {
      logger.warn('CloudStorageAdapter: verifyAuth failed', error);
      return false;
    }
  }

  private saveAuth(): void {
    if (this.authToken && this.user) {
      setLocalStorage(STORAGE_KEYS.AUTH_TOKEN, this.authToken);
      setLocalStorage(STORAGE_KEYS.AUTH_USER, this.user);
    }
  }

  private clearAuth(): void {
    this.authToken = null;
    this.user = null;
    removeLocalStorage(STORAGE_KEYS.AUTH_TOKEN);
    removeLocalStorage(STORAGE_KEYS.AUTH_USER);
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    logger.info(`CloudStorageAdapter: loadAllMaps called - authenticated: ${this.isAuthenticated}, token: ${!!this.authToken}, user: ${!!this.user}`);

    if (!this.isAuthenticated) {
      logger.warn('CloudStorageAdapter: Not authenticated, returning empty map list');
      return [];
    }

    try {
      logger.info('CloudStorageAdapter: Making request to /api/maps');
      const response = await this.makeRequest<MapsListResponse>('/api/maps');
      logger.info('CloudStorageAdapter: Maps list response:', response);

      if (!response.success || !response.maps) {
        logger.warn('CloudStorageAdapter: Failed to load maps', response.error);
        return [];
      }

      logger.info(`CloudStorageAdapter: Found ${response.maps.length} maps in cloud`);
      const maps: MindMapData[] = [];
      for (const cloudMap of response.maps as Array<{ id: string }>) {
        try {
          
          logger.info(`CloudStorageAdapter: Loading full data for map ${cloudMap.id}`);
          const fullMapResponse = await this.makeRequest<MapDetailResponse>(`/api/maps/${encodeURIComponent(cloudMap.id)}`);
          if (fullMapResponse.success && fullMapResponse.map) {
            const markdown = fullMapResponse.map.content || '';
            const parseResult = MarkdownImporter.parseMarkdownToNodes(markdown);

            const mindMapData: MindMapData = {
              title: fullMapResponse.map.title || 'Untitled',
              rootNodes: parseResult.rootNodes,
              createdAt: fullMapResponse.map.createdAt,
              updatedAt: fullMapResponse.map.updatedAt,
              settings: {
                autoSave: true,
                autoLayout: true,
                showGrid: false,
                animationEnabled: true
              },
              mapIdentifier: {
                mapId: fullMapResponse.map.id,
                workspaceId: 'cloud'
              }
            };

            maps.push(mindMapData);
            logger.info(`CloudStorageAdapter: Successfully loaded map: ${mindMapData.title}`);
          }
        } catch (error) {
          logger.warn(`CloudStorageAdapter: Failed to load map ${cloudMap.id}`, error);
        }
      }

      logger.info(`CloudStorageAdapter: Successfully loaded ${maps.length} maps from cloud`);
      return maps;
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to load maps', error);
      return [];
    }
  }

  // Lightweight list of map identifiers for workspace-wide operations (no content fetch)
  async listMapIdentifiers?(): Promise<Array<{ mapId: string; workspaceId: string }>> {
    if (!this.isAuthenticated) {
      return [];
    }
    try {
      const response = await this.makeRequest<MapsListResponse>('/api/maps');
      if (!response.success || !Array.isArray(response.maps)) return [];
      return (response.maps as Array<{ id: string }>).map((m) => ({ mapId: m.id, workspaceId: 'cloud' }));
    } catch {
      return [];
    }
  }

  async addMapToList(map: MindMapData): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      
      let markdown = `# ${map.title}\n`;
      map.rootNodes.forEach(node => {
        markdown += nodeToMarkdown(node, 0);
      });

      const mapPath = (map.mapIdentifier.mapId || '').trim();
      if (!mapPath || mapPath === 'new') {
        throw new Error('Cloud save requires explicit mapId path (e.g., "Folder/Title")');
      }
      
      await this.makeRequest(`/api/maps/${encodeURIComponent(mapPath)}` , {
        method: 'PUT',
        body: JSON.stringify({ title: map.title, content: markdown })
      });

      logger.info(`CloudStorageAdapter: Saved map ${map.title} to cloud`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to save map', error);
      throw error;
    }
  }

  async removeMapFromList(id: MapIdentifier): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      await this.makeRequest(`/api/maps/${encodeURIComponent(id.mapId)}` , {
        method: 'DELETE'
      });

      logger.info(`CloudStorageAdapter: Deleted map ${id.mapId} from cloud`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to delete map', error);
      throw error;
    }
  }


  async listWorkspaces(): Promise<Array<{ id: string; name: string }>> {
    
    return [
      {
        id: 'cloud',
        name: '🌐 Cloud'
      }
    ];
  }

  cleanup(): void {
    
  }


  
  async createFolder?(relativePath: string, workspaceId?: string): Promise<void> {
    
    
    
    if (relativePath) {
      this.virtualFolders.add(relativePath);
      logger.info('CloudStorageAdapter: Virtual folder added', { relativePath, workspaceId });
    }
  }

  async getExplorerTree?(): Promise<ExplorerItem> {
    if (!this.isAuthenticated) {
      return { type: 'folder', name: 'Cloud', path: '/cloud', children: [] };
    }

    try {
      
      const listResp = await this.makeRequest<ImagesListResponse>(`/api/images/list?path=${encodeURIComponent('')}`);
      const keys: string[] = Array.isArray(listResp?.files) ? (listResp.files) : [];

      
      type Node = { name: string; children?: Map<string, Node>; isFile?: boolean; path?: string; isMarkdown?: boolean };
      const root: Node = { name: 'cloud', children: new Map() };

      const ensureDir = (dir: Node, segment: string): Node => {
        if (!dir.children) dir.children = new Map();
        if (!dir.children.has(segment)) {
          dir.children.set(segment, { name: segment, children: new Map() });
        }
        const child = dir.children.get(segment);
        if (!child) throw new Error(`Failed to get or create directory: ${segment}`);
        return child;
      };

      const addFile = (dir: Node, fileName: string, fullPath: string) => {
        if (!dir.children) dir.children = new Map();
        dir.children.set(fileName, {
          name: fileName,
          isFile: true,
          path: `/cloud/${fullPath}`,
          isMarkdown: /\.md$/i.test(fileName)
        });
      };

      for (const key of keys) {
        
        // Remove leading/trailing slashes without regex backtracking
        const raw = String(key || '');
        let start = 0;
        let end = raw.length;
        while (start < end && raw.charCodeAt(start) === 47 /* '/' */) start++;
        while (end > start && raw.charCodeAt(end - 1) === 47 /* '/' */) end--;
        const clean = raw.slice(start, end);
        if (!clean) continue;

        const parts = clean.split('/');
        let cursor = root;
        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i];
          const isLast = i === parts.length - 1;
          if (isLast) {
            addFile(cursor, seg, clean);
          } else {
            cursor = ensureDir(cursor, seg);
          }
        }
      }

      // Add virtual folders that don't have any files yet
      for (const virtualPath of this.virtualFolders) {
        const parts = virtualPath.split('/').filter(p => p.trim());
        if (parts.length === 0) continue;

        let cursor = root;
        for (const seg of parts) {
          cursor = ensureDir(cursor, seg);
        }
      }

      
      const toExplorer = (node: Node, currentPath: string): ExplorerItem => {
        if (node.isFile) {
          const filePath = node.path || `/cloud/${currentPath}`;
          return { type: 'file', name: node.name, path: filePath, isMarkdown: node.isMarkdown } as ExplorerItem;
        }
        const children: ExplorerItem[] = [];
        for (const child of (node.children?.values() || [])) {
          children.push(toExplorer(child, currentPath ? `${currentPath}/${child.name}` : child.name));
        }
        
        children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return { type: 'folder', name: currentPath ? node.name : 'Cloud', path: currentPath ? `/cloud/${currentPath}` : '/cloud', children } as ExplorerItem;
      };

      return toExplorer(root, '');
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to build explorer tree', error);
      return { type: 'folder', name: 'Cloud', path: '/cloud', children: [] };
    }
  }

  async renameItem?(_path: string, _newName: string): Promise<void> {
    throw new Error('Cloud storage does not support item renaming');
  }

  async deleteItem?(path: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    
    const clean = (path || '').replace(/^\/+/, '');
    let rel = clean.startsWith('cloud/') ? clean.slice('cloud/'.length) : clean;
    // Remove leading slash if any
    rel = rel.replace(/^\/+/, '');
    // Remove .md extension to get full map ID including folders
    const mapId = rel.replace(/\.md$/i, '');

    try {
      await this.makeRequest(`/api/maps/${encodeURIComponent(mapId)}`, {
        method: 'DELETE'
      });

      logger.info(`CloudStorageAdapter: Deleted map ${mapId} from cloud`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to delete map', error);
      throw error;
    }
  }

  async moveItem?(_sourcePath: string, _targetFolderPath: string): Promise<void> {
    throw new Error('Cloud storage does not support item moving');
  }

  async getMapMarkdown?(id: MapIdentifier): Promise<string | null> {
    if (!this.isAuthenticated) return null;

    try {
      const response = await this.makeRequest<MapDetailResponse>(`/api/maps/${encodeURIComponent(id.mapId)}`);
      if (response.success && response.map) {
        return response.map.content || null;
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to get map markdown', error);
    }

    return null;
  }

  async getMapLastModified?(id: MapIdentifier): Promise<number | null> {
    if (!this.isAuthenticated) return null;

    try {
      const response = await this.makeRequest<MapDetailResponse>(`/api/maps/${encodeURIComponent(id.mapId)}`);
      if (response.success && response.map) {
        return new Date(response.map.updatedAt).getTime();
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to get map last modified', error);
    }

    return null;
  }

  async saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      
      // Extract first level-1 heading as title without using complex regex
      let title = 'Untitled';
      const lines = markdown.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith('# ')) { title = line.slice(2).trim(); break; }
      }

      const idPath = (id.mapId || '').trim();
      if (!idPath || idPath === 'new') {
        
        throw new Error('Cloud save requires explicit mapId path (e.g., "Folder/Title")');
      }

      
      
      await this.makeRequest(`/api/maps/${encodeURIComponent(idPath)}` , {
        method: 'PUT',
        body: JSON.stringify({ title, content: markdown })
      });

      logger.info(`CloudStorageAdapter: Saved markdown for map ${id.mapId}`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to save markdown', error);
      throw error;
    }
  }


  async addWorkspace?(): Promise<void> {
    throw new Error('Cloud storage does not support adding workspaces');
  }

  async removeWorkspace?(_id: string): Promise<void> {
    throw new Error('Cloud storage does not support removing workspaces');
  }

  
  async saveImageFile?(relativePath: string, file: File, _workspaceId?: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      
      const tryMultipart = async (): Promise<void> => {
        const form = new FormData();
        form.append('path', relativePath);
        form.append('file', file, (file && file.name) ? file.name : 'image');

        const res = await fetch(`${this.baseUrl}/api/images/upload`, {
          method: 'POST',
          headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } as Record<string, string> : undefined,
          body: form,
        });

        if (!res.ok) {
          let errMsg = res.statusText || `HTTP ${res.status}`;
          try { const j = await res.json(); errMsg = j?.error || errMsg; } catch {}
          const e = new Error(errMsg) as Error & { status?: number };
          e.status = res.status;
          throw e;
        }

        try {
          const j = await res.json();
          if (j && j.success === false) {
            throw new Error(j.error || 'Upload failed');
          }
        } catch {
          
        }
        logger.info(`CloudStorageAdapter: Uploaded image via multipart: ${relativePath}`);
      };

      
      const tryJsonBase64 = async (): Promise<void> => {
        const reader = new FileReader();
        const base64Data: string = await new Promise((resolve, reject) => {
          reader.onload = () => {
            try {
              const result = reader.result as string;
              const base64 = result.includes(',') ? result.split(',')[1] : result;
              resolve(base64);
            } catch (e) { reject(e); }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await this.makeRequest('/api/images/upload', {
          method: 'POST',
          body: JSON.stringify({ path: relativePath, data: base64Data, contentType: file.type || 'image/png' })
        });

        logger.info(`CloudStorageAdapter: Uploaded image via JSON base64: ${relativePath}`);
      };

      try {
        await tryMultipart();
      } catch (e) {
        
        logger.warn('CloudStorageAdapter: Multipart upload failed, falling back to JSON', e);
        await tryJsonBase64();
      }
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to upload image', error);
      const msg = error instanceof Error ? error.message : 'Internal server error during upload';
      throw new Error(msg);
    }
  }

  async readImageFile?(relativePath: string, _workspaceId?: string): Promise<File | null> {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      
      const response = await this.makeRequest<ImageGetResponse>(`/api/images/${encodeURIComponent(relativePath)}`);

      if (response.success && response.data) {
        
        const byteCharacters = atob(response.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.contentType || 'image/png' });

        
        const filename = relativePath.split('/').pop() || 'image.png';
        return new File([blob], filename, { type: response.contentType || 'image/png' });
      }

      return null;
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to read image', error);
      return null;
    }
  }

  
  async readImageAsDataURL?(relativePath: string, _workspaceId?: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      const response = await this.makeRequest<ImageGetResponse>(`/api/images/${encodeURIComponent(relativePath)}`);
      if (response?.success && response?.data) {
        const ct = response.contentType || 'image/png';
        return `data:${ct};base64,${response.data}`;
      }
      return null;
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to read image as data URL', error);
      return null;
    }
  }

  async deleteImageFile?(relativePath: string, _workspaceId?: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      await this.makeRequest(`/api/images/${encodeURIComponent(relativePath)}`, {
        method: 'DELETE'
      });

      logger.info(`CloudStorageAdapter: Deleted image from R2: ${relativePath}`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to delete image', error);
      throw error;
    }
  }

  async listImageFiles?(directoryPath: string, _workspaceId?: string): Promise<string[]> {
    if (!this.isAuthenticated) {
      return [];
    }

    try {
      const response = await this.makeRequest<ImagesListResponse>(`/api/images/list?path=${encodeURIComponent(directoryPath)}`);

      if (response.success && response.files) {
        return response.files;
      }

      return [];
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to list images', error);
      return [];
    }
  }

  
  getCurrentUser(): CloudUser | null {
    return this.user;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}
