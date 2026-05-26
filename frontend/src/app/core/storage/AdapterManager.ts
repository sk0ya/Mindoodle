import type { StorageAdapter, StorageConfig } from '../types/storage.types';
import { MarkdownFolderAdapter, CloudStorageAdapter, GroupCloudStorageAdapter } from './adapters';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { logger } from '@shared/utils';

export interface WorkspaceInfo {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'group';
  adapter: StorageAdapter;
}

export class AdapterManager {
  private localAdapter: MarkdownFolderAdapter | null = null;
  private cloudAdapter: CloudStorageAdapter | null = null;
  private groupAdapter: CloudStorageAdapter | null = null;
  private currentWorkspaceId: string | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    
    this.localAdapter = new MarkdownFolderAdapter();
    await this.localAdapter.initialize();
    logger.info('AdapterManager: Local adapter initialized');

    
    if (this.config.mode === 'local+cloud') {
      const workspaceService = WorkspaceService.getInstance();
      const existingCloudAdapter = workspaceService.getCloudAdapter();
      const existingGroupAdapter = workspaceService.getGroupAdapter();

      if (existingCloudAdapter) {
        this.cloudAdapter = existingCloudAdapter;
        
        if (!this.cloudAdapter.isInitialized && typeof this.cloudAdapter.initialize === 'function') {
          await this.cloudAdapter.initialize();
        }
        logger.info(`AdapterManager: Using existing cloud adapter (authenticated=${this.cloudAdapter.isAuthenticated})`);
      } else {
        
        const apiEndpoint = this.config.cloudApiEndpoint || 'https://mindoodle-backend-production.shigekazukoya.workers.dev';
        this.cloudAdapter = new CloudStorageAdapter(apiEndpoint);
        workspaceService.setCloudAdapter(this.cloudAdapter);
        await this.cloudAdapter.initialize();

        
        if (this.cloudAdapter.isAuthenticated) {
          workspaceService.addCloudWorkspace(this.cloudAdapter);
        }
        logger.info('AdapterManager: Created and initialized shared cloud adapter');
      }

      if (existingGroupAdapter) {
        this.groupAdapter = existingGroupAdapter;
        if (!this.groupAdapter.isInitialized && typeof this.groupAdapter.initialize === 'function') {
          await this.groupAdapter.initialize();
        }
        logger.info(`AdapterManager: Using existing group adapter (authenticated=${this.groupAdapter.isAuthenticated})`);
      } else {
        const apiEndpoint = this.config.cloudApiEndpoint || 'https://mindoodle-backend-production.shigekazukoya.workers.dev';
        this.groupAdapter = new GroupCloudStorageAdapter(apiEndpoint);
        workspaceService.setGroupAdapter(this.groupAdapter);
        await this.groupAdapter.initialize();

        const user = this.groupAdapter.getCurrentUser();
        if (this.groupAdapter.isAuthenticated && user?.groupId) {
          workspaceService.addGroupWorkspace(this.groupAdapter);
        }
        logger.info('AdapterManager: Created and initialized shared group adapter');
      }
    }

    logger.info('AdapterManager: Initialization complete');
  }

  
  async getAvailableWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspaces: WorkspaceInfo[] = [];

    
    if (this.localAdapter && typeof this.localAdapter.listWorkspaces === 'function') {
      try {
        const localWorkspaces = await this.localAdapter.listWorkspaces();
        const adapter = this.localAdapter;
        localWorkspaces.forEach(ws => {
          workspaces.push({
            id: ws.id,
            name: ws.name,
            type: 'local',
            adapter
          });
        });
      } catch (error) {
        logger.warn('Failed to load local workspaces:', error);
      }
    }

    
    const workspaceService = WorkspaceService.getInstance();
    if (workspaceService.isCloudAuthenticated()) {
      const cloudAdapter = workspaceService.getCloudAdapter();
      if (cloudAdapter) {
        workspaces.push({
          id: 'cloud',
          name: 'Cloud',
          type: 'cloud',
          adapter: cloudAdapter
        });
        
        this.cloudAdapter = cloudAdapter;
      }
    }

    if (workspaceService.isGroupAuthenticated()) {
      const groupAdapter = workspaceService.getGroupAdapter();
      if (groupAdapter) {
        workspaces.push({
          id: 'group',
          name: 'Group',
          type: 'group',
          adapter: groupAdapter
        });

        this.groupAdapter = groupAdapter;
      }
    }

    return workspaces;
  }

  
  getCurrentAdapter(): StorageAdapter | null {
    return this.getAdapterForWorkspace(this.currentWorkspaceId);
  }

  
  getAdapterForWorkspace(workspaceId: string | null): StorageAdapter | null {
    if (!workspaceId) {
      
      return this.localAdapter;
    }

    if (workspaceId === 'cloud') {
      
      const workspaceService = WorkspaceService.getInstance();
      const cloudAdapter = workspaceService.getCloudAdapter();
      if (cloudAdapter) {
        this.cloudAdapter = cloudAdapter; 
        return cloudAdapter;
      }
      return this.cloudAdapter; 
    }

    if (workspaceId === 'group') {
      const workspaceService = WorkspaceService.getInstance();
      const groupAdapter = workspaceService.getGroupAdapter();
      if (groupAdapter) {
        this.groupAdapter = groupAdapter;
        return groupAdapter;
      }
      return this.groupAdapter;
    }

    
    return this.localAdapter;
  }

  
  setCurrentWorkspace(workspaceId: string | null): void {
    this.currentWorkspaceId = workspaceId;
    logger.info(`AdapterManager: Switched to workspace: ${workspaceId || 'default'}`);
  }

  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }

  
  setCloudAdapter(cloudAdapter: CloudStorageAdapter): void {
    this.cloudAdapter = cloudAdapter;
    logger.info('AdapterManager: Cloud adapter set');
  }

  
  removeCloudAdapter(): void {
    this.cloudAdapter = null;
    if (this.currentWorkspaceId === 'cloud') {
      this.currentWorkspaceId = null; 
    }
    logger.info('AdapterManager: Cloud adapter removed');
  }

  setGroupAdapter(groupAdapter: CloudStorageAdapter): void {
    this.groupAdapter = groupAdapter;
    logger.info('AdapterManager: Group adapter set');
  }

  removeGroupAdapter(): void {
    this.groupAdapter = null;
    if (this.currentWorkspaceId === 'group') {
      this.currentWorkspaceId = null;
    }
    logger.info('AdapterManager: Group adapter removed');
  }

  
  hasCloudAdapter(): boolean {
    return !!(this.cloudAdapter && this.cloudAdapter.isAuthenticated);
  }

  
  cleanup(): void {
    this.localAdapter?.cleanup();
    this.cloudAdapter?.cleanup();
    this.groupAdapter?.cleanup();
  }
}
