import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../../types/storage.types';
import { logger } from '@shared/utils';
import { WorkspaceService } from '@shared/services';

interface CloudMapData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

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

export class CloudStorageAdapter implements StorageAdapter {
  private _isInitialized = false;
  private baseUrl: string;
  private authToken: string | null = null;
  private user: CloudUser | null = null;

  constructor(baseUrl = 'https://mindoodle-backend.your-subdomain.workers.dev') {
    this.baseUrl = baseUrl;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get isAuthenticated(): boolean {
    return !!this.authToken && !!this.user;
  }

  async initialize(): Promise<void> {
    // Try to restore auth token from localStorage
    try {
      const savedToken = localStorage.getItem('mindoodle-auth-token');
      const savedUser = localStorage.getItem('mindoodle-auth-user');

      if (savedToken && savedUser) {
        this.authToken = savedToken;
        this.user = JSON.parse(savedUser);

        // Verify token is still valid
        const isValid = await this.verifyAuth();
        if (!isValid) {
          this.clearAuth();
        } else {
          // Restore cloud workspace in WorkspaceService
          const workspaceService = WorkspaceService.getInstance();
          workspaceService.restoreCloudWorkspace(this);
        }
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to restore auth from localStorage', error);
      this.clearAuth();
    }

    this._isInitialized = true;
    logger.info('CloudStorageAdapter: Initialized');
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/api/auth/register', {
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
      const response = await this.makeRequest('/api/auth/login', {
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
      const response = await this.makeRequest('/api/auth/me');
      return response.success;
    } catch (error) {
      return false;
    }
  }

  private saveAuth(): void {
    if (this.authToken && this.user) {
      localStorage.setItem('mindoodle-auth-token', this.authToken);
      localStorage.setItem('mindoodle-auth-user', JSON.stringify(this.user));
    }
  }

  private clearAuth(): void {
    this.authToken = null;
    this.user = null;
    localStorage.removeItem('mindoodle-auth-token');
    localStorage.removeItem('mindoodle-auth-user');
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this.isAuthenticated) {
      logger.warn('CloudStorageAdapter: Not authenticated, returning empty map list');
      return [];
    }

    try {
      const response = await this.makeRequest('/api/maps');

      if (!response.success || !response.maps) {
        logger.warn('CloudStorageAdapter: Failed to load maps', response.error);
        return [];
      }

      const maps: MindMapData[] = [];
      for (const cloudMap of response.maps) {
        try {
          // Get full map data
          const fullMapResponse = await this.makeRequest(`/api/maps/${cloudMap.id}`);
          if (fullMapResponse.success && fullMapResponse.map) {
            const mindMapData = this.convertCloudMapToMindMapData(fullMapResponse.map);
            maps.push(mindMapData);
          }
        } catch (error) {
          logger.warn(`CloudStorageAdapter: Failed to load map ${cloudMap.id}`, error);
        }
      }

      logger.info(`CloudStorageAdapter: Loaded ${maps.length} maps from cloud`);
      return maps;
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to load maps', error);
      return [];
    }
  }

  async addMapToList(map: MindMapData): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const cloudMapData = this.convertMindMapDataToCloudMap(map);

      if (map.mapIdentifier.mapId && map.mapIdentifier.mapId !== 'new') {
        // Update existing map
        await this.makeRequest(`/api/maps/${cloudMapData.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: cloudMapData.title,
            content: cloudMapData.content
          })
        });
      } else {
        // Create new map
        const response = await this.makeRequest('/api/maps', {
          method: 'POST',
          body: JSON.stringify({
            title: cloudMapData.title,
            content: cloudMapData.content
          })
        });

        if (response.success && response.map) {
          // Update the map identifier with the new ID from server
          map.mapIdentifier.mapId = response.map.id;
        }
      }

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
      await this.makeRequest(`/api/maps/${id.mapId}`, {
        method: 'DELETE'
      });

      logger.info(`CloudStorageAdapter: Deleted map ${id.mapId} from cloud`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to delete map', error);
      throw error;
    }
  }

  private convertCloudMapToMindMapData(cloudMap: CloudMapData): MindMapData {
    const content = JSON.parse(cloudMap.content);

    return {
      title: cloudMap.title,
      category: 'Cloud', // All cloud maps are in "Cloud" category
      rootNodes: content.rootNodes || [],
      createdAt: cloudMap.createdAt,
      updatedAt: cloudMap.updatedAt,
      settings: content.settings || {
        autoSave: true,
        autoLayout: true,
        showGrid: false,
        animationEnabled: true
      },
      mapIdentifier: {
        mapId: cloudMap.id,
        workspaceId: 'cloud'
      }
    };
  }

  private convertMindMapDataToCloudMap(mindMapData: MindMapData): CloudMapData {
    const content = {
      rootNodes: mindMapData.rootNodes,
      settings: mindMapData.settings
    };

    return {
      id: mindMapData.mapIdentifier.mapId || '',
      title: mindMapData.title,
      content: JSON.stringify(content),
      createdAt: mindMapData.createdAt,
      updatedAt: mindMapData.updatedAt
    };
  }

  cleanup(): void {
    // Nothing to cleanup for cloud storage
  }

  // Optional methods - not implemented for cloud storage
  async createFolder?(relativePath: string): Promise<void> {
    throw new Error('Cloud storage does not support folder creation');
  }

  async getExplorerTree?(): Promise<ExplorerItem> {
    // Return a simple tree showing cloud maps
    return {
      type: 'folder',
      name: 'Cloud',
      path: '/cloud',
      children: []
    };
  }

  async renameItem?(path: string, newName: string): Promise<void> {
    throw new Error('Cloud storage does not support item renaming');
  }

  async deleteItem?(path: string): Promise<void> {
    throw new Error('Cloud storage does not support item deletion via path');
  }

  async moveItem?(sourcePath: string, targetFolderPath: string): Promise<void> {
    throw new Error('Cloud storage does not support item moving');
  }

  async getMapMarkdown?(id: MapIdentifier): Promise<string | null> {
    // For cloud storage, we don't store raw markdown
    return null;
  }

  async getMapLastModified?(id: MapIdentifier): Promise<number | null> {
    if (!this.isAuthenticated) return null;

    try {
      const response = await this.makeRequest(`/api/maps/${id.mapId}`);
      if (response.success && response.map) {
        return new Date(response.map.updatedAt).getTime();
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to get map last modified', error);
    }

    return null;
  }

  async saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void> {
    throw new Error('Cloud storage does not support raw markdown saving');
  }

  async listWorkspaces?(): Promise<Array<{ id: string; name: string }>> {
    if (!this.isAuthenticated) return [];
    return [{ id: 'cloud', name: 'Cloud' }];
  }

  async addWorkspace?(): Promise<void> {
    throw new Error('Cloud storage does not support adding workspaces');
  }

  async removeWorkspace?(id: string): Promise<void> {
    throw new Error('Cloud storage does not support removing workspaces');
  }

  // Public API for frontend integration
  getCurrentUser(): CloudUser | null {
    return this.user;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}