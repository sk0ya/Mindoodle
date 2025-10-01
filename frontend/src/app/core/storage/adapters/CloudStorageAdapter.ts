import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../../types/storage.types';
import { logger } from '@shared/utils';
import { WorkspaceService } from '@shared/services';
import { MarkdownImporter } from '../../../features/markdown/markdownImporter';
import { nodeToMarkdown } from '../../../features/markdown/markdownExport';

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
    logger.info(`CloudStorageAdapter: Initialized, authenticated: ${this.isAuthenticated}`);
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
    logger.info(`CloudStorageAdapter: loadAllMaps called - authenticated: ${this.isAuthenticated}, token: ${!!this.authToken}, user: ${!!this.user}`);

    if (!this.isAuthenticated) {
      logger.warn('CloudStorageAdapter: Not authenticated, returning empty map list');
      return [];
    }

    try {
      logger.info('CloudStorageAdapter: Making request to /api/maps');
      const response = await this.makeRequest('/api/maps');
      logger.info('CloudStorageAdapter: Maps list response:', response);

      if (!response.success || !response.maps) {
        logger.warn('CloudStorageAdapter: Failed to load maps', response.error);
        return [];
      }

      logger.info(`CloudStorageAdapter: Found ${response.maps.length} maps in cloud`);
      const maps: MindMapData[] = [];
      for (const cloudMap of response.maps) {
        try {
          // Get full map data with markdown content
          logger.info(`CloudStorageAdapter: Loading full data for map ${cloudMap.id}`);
          const fullMapResponse = await this.makeRequest(`/api/maps/${cloudMap.id}`);
          if (fullMapResponse.success && fullMapResponse.map) {
            const mindMapData = this.convertCloudMapToMindMapData(fullMapResponse.map);
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
    // Extract frontmatter from markdown content
    const { category, content } = this.extractFrontmatter(cloudMap.content);

    // Parse markdown content to get rootNodes
    const parseResult = MarkdownImporter.parseMarkdownToNodes(content);

    return {
      title: cloudMap.title,
      category: category,
      rootNodes: parseResult.rootNodes,
      createdAt: cloudMap.createdAt,
      updatedAt: cloudMap.updatedAt,
      settings: {
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
    // Add frontmatter with category if present
    let markdown = '';
    if (mindMapData.category) {
      markdown += `---\ncategory: ${mindMapData.category}\n---\n\n`;
    }

    // Convert rootNodes to markdown
    markdown += `# ${mindMapData.title}\n\n`;

    // Convert each root node to markdown
    mindMapData.rootNodes.forEach(node => {
      markdown += nodeToMarkdown(node, 0);
    });

    return {
      id: mindMapData.mapIdentifier.mapId || '',
      title: mindMapData.title,
      content: markdown,
      createdAt: mindMapData.createdAt,
      updatedAt: mindMapData.updatedAt
    };
  }

  async listWorkspaces(): Promise<Array<{ id: string; name: string }>> {
    // For cloud storage, we provide a single "Cloud" workspace
    return [
      {
        id: 'cloud',
        name: '🌐 Cloud'
      }
    ];
  }

  cleanup(): void {
    // Nothing to cleanup for cloud storage
  }

  // Helper method to extract frontmatter from markdown
  private extractFrontmatter(markdown: string): { category: string; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = markdown.match(frontmatterRegex);

    if (!match) {
      return { category: '', content: markdown };
    }

    const frontmatterContent = match[1];
    const categoryMatch = frontmatterContent.match(/^category:\s*(.+)$/m);
    const category = categoryMatch ? categoryMatch[1].trim() : '';
    const content = markdown.slice(match[0].length);

    return { category, content };
  }

  // Optional methods - not implemented for cloud storage
  async createFolder?(relativePath: string, workspaceId?: string): Promise<void> {
    // Virtual folders - no actual folder creation needed
    // Folders are derived from map categories
    logger.info('CloudStorageAdapter: Virtual folder created (no-op)', { relativePath, workspaceId });
  }

  async getExplorerTree?(): Promise<ExplorerItem> {
    if (!this.isAuthenticated) {
      return {
        type: 'folder',
        name: 'Cloud',
        path: '/cloud',
        children: []
      };
    }

    try {
      // Load all maps to build the tree
      const maps = await this.loadAllMaps();

      // Build folder structure from categories
      const root: ExplorerItem = {
        type: 'folder',
        name: 'Cloud',
        path: '/cloud',
        children: []
      };

      // Helper function to build nested folder structure
      const getOrCreateFolder = (parent: ExplorerItem, pathParts: string[]): ExplorerItem => {
        if (pathParts.length === 0) return parent;

        const [currentPart, ...remaining] = pathParts;
        let folder = parent.children?.find(
          child => child.type === 'folder' && child.name === currentPart
        );

        if (!folder) {
          folder = {
            type: 'folder',
            name: currentPart,
            path: `${parent.path}/${currentPart}`,
            children: []
          };
          if (!parent.children) parent.children = [];
          parent.children.push(folder);
        }

        return getOrCreateFolder(folder, remaining);
      };

      // Add each map to the tree
      for (const map of maps) {
        const pathParts = map.category ? map.category.split('/').filter(p => p.trim()) : [];
        const parentFolder = getOrCreateFolder(root, pathParts);

        const fileItem: ExplorerItem = {
          type: 'file',
          name: `${map.title}.md`,
          path: `${parentFolder.path}/${map.mapIdentifier.mapId}.md`,
          isMarkdown: true
        };

        if (!parentFolder.children) parentFolder.children = [];
        parentFolder.children.push(fileItem);
      }

      // Sort children: folders first, then files
      const sortChildren = (item: ExplorerItem) => {
        if (item.children) {
          item.children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
          });
          item.children.forEach(sortChildren);
        }
      };
      sortChildren(root);

      return root;
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to build explorer tree', error);
      return {
        type: 'folder',
        name: 'Cloud',
        path: '/cloud',
        children: []
      };
    }
  }

  async renameItem?(_path: string, _newName: string): Promise<void> {
    throw new Error('Cloud storage does not support item renaming');
  }

  async deleteItem?(path: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    // Extract map ID from path: /cloud/[folders...]/mapId.md
    const pathParts = path.split('/').filter(p => p.trim());
    const fileName = pathParts[pathParts.length - 1];

    // Remove .md extension to get map ID
    const mapId = fileName.replace(/\.md$/, '');

    try {
      await this.makeRequest(`/api/maps/${mapId}`, {
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
      const response = await this.makeRequest(`/api/maps/${id.mapId}`);
      if (response.success && response.map) {
        return response.map.content;
      }
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to get map markdown', error);
    }

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
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Extract title from markdown (first line starting with #)
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Untitled';

      if (id.mapId && id.mapId !== 'new') {
        // Update existing map
        await this.makeRequest(`/api/maps/${id.mapId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            content: markdown
          })
        });
      } else {
        // Create new map
        const response = await this.makeRequest('/api/maps', {
          method: 'POST',
          body: JSON.stringify({
            title,
            content: markdown
          })
        });

        if (response.success && response.map) {
          // Update the map identifier with the new ID from server
          id.mapId = response.map.id;
        }
      }

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

  // Image handling for R2 bucket
  async saveImageFile?(relativePath: string, file: File, _workspaceId?: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Convert File to base64 for JSON transfer
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to R2 via backend API
      await this.makeRequest('/api/images/upload', {
        method: 'POST',
        body: JSON.stringify({
          path: relativePath,
          data: base64Data,
          contentType: file.type
        })
      });

      logger.info(`CloudStorageAdapter: Uploaded image to R2: ${relativePath}`);
    } catch (error) {
      logger.error('CloudStorageAdapter: Failed to upload image', error);
      throw error;
    }
  }

  async readImageFile?(relativePath: string, _workspaceId?: string): Promise<File | null> {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      // Download from R2 via backend API
      const response = await this.makeRequest(`/api/images/${encodeURIComponent(relativePath)}`);

      if (response.success && response.data) {
        // Convert base64 back to File
        const byteCharacters = atob(response.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.contentType || 'image/png' });

        // Extract filename from path
        const filename = relativePath.split('/').pop() || 'image.png';
        return new File([blob], filename, { type: response.contentType || 'image/png' });
      }

      return null;
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to read image', error);
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
      const response = await this.makeRequest(`/api/images/list?path=${encodeURIComponent(directoryPath)}`);

      if (response.success && response.files) {
        return response.files;
      }

      return [];
    } catch (error) {
      logger.warn('CloudStorageAdapter: Failed to list images', error);
      return [];
    }
  }

  // Public API for frontend integration
  getCurrentUser(): CloudUser | null {
    return this.user;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}