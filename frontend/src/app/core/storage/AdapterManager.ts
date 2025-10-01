import type { StorageAdapter, StorageConfig } from '../types/storage.types';
import { MarkdownFolderAdapter, CloudStorageAdapter } from './adapters';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { logger } from '@shared/utils';

export interface WorkspaceInfo {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  adapter: StorageAdapter;
}

export class AdapterManager {
  private localAdapter: MarkdownFolderAdapter | null = null;
  private cloudAdapter: CloudStorageAdapter | null = null;
  private currentWorkspaceId: string | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Always initialize local adapter
    this.localAdapter = new MarkdownFolderAdapter();
    await this.localAdapter.initialize();
    logger.info('AdapterManager: Local adapter initialized');

    // Initialize cloud adapter if in local+cloud mode
    if (this.config.mode === 'local+cloud') {
      const workspaceService = WorkspaceService.getInstance();
      const existingCloudAdapter = workspaceService.getCloudAdapter();

      if (existingCloudAdapter && existingCloudAdapter.isAuthenticated) {
        this.cloudAdapter = existingCloudAdapter;
        logger.info('AdapterManager: Using existing authenticated cloud adapter');
      } else {
        // Always create cloud adapter in local+cloud mode, even if not authenticated yet
        const apiEndpoint = this.config.cloudApiEndpoint || 'https://mindoodle-backend-production.shigekazukoya.workers.dev';
        this.cloudAdapter = new CloudStorageAdapter(apiEndpoint);
        await this.cloudAdapter.initialize();

        // If it becomes authenticated after initialization, register it with WorkspaceService
        if (this.cloudAdapter.isAuthenticated) {
          workspaceService.addCloudWorkspace(this.cloudAdapter);
        }
      }
    }

    logger.info('AdapterManager: Initialization complete');
  }

  // Get list of all available workspaces
  async getAvailableWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspaces: WorkspaceInfo[] = [];

    // Add local workspaces (from folder structure)
    if (this.localAdapter && typeof this.localAdapter.listWorkspaces === 'function') {
      try {
        const localWorkspaces = await this.localAdapter.listWorkspaces();
        localWorkspaces.forEach(ws => {
          workspaces.push({
            id: ws.id,
            name: ws.name,
            type: 'local',
            adapter: this.localAdapter!
          });
        });
      } catch (error) {
        logger.warn('Failed to load local workspaces:', error);
      }
    }

    // Get cloud workspace from WorkspaceService
    const workspaceService = WorkspaceService.getInstance();
    if (workspaceService.isCloudAuthenticated()) {
      const cloudAdapter = workspaceService.getCloudAdapter();
      if (cloudAdapter) {
        workspaces.push({
          id: 'cloud',
          name: '🌐 Cloud',
          type: 'cloud',
          adapter: cloudAdapter
        });
        // Update our cloud adapter reference
        this.cloudAdapter = cloudAdapter;
      }
    }

    return workspaces;
  }

  // Get current adapter based on selected workspace
  getCurrentAdapter(): StorageAdapter | null {
    return this.getAdapterForWorkspace(this.currentWorkspaceId);
  }

  // Get adapter for specific workspace ID
  getAdapterForWorkspace(workspaceId: string | null): StorageAdapter | null {
    if (!workspaceId) {
      // Default to local adapter if no workspace specified
      return this.localAdapter;
    }

    if (workspaceId === 'cloud') {
      // For cloud workspace, get adapter from WorkspaceService to ensure it's current
      const workspaceService = WorkspaceService.getInstance();
      const cloudAdapter = workspaceService.getCloudAdapter();
      if (cloudAdapter) {
        this.cloudAdapter = cloudAdapter; // Update our reference
        return cloudAdapter;
      }
      return this.cloudAdapter; // Fallback to our stored reference
    }

    // For local workspace IDs, return local adapter
    return this.localAdapter;
  }

  // Switch to specific workspace
  setCurrentWorkspace(workspaceId: string | null): void {
    this.currentWorkspaceId = workspaceId;
    logger.info(`AdapterManager: Switched to workspace: ${workspaceId || 'default'}`);
  }

  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }

  // Add cloud adapter when user authenticates
  setCloudAdapter(cloudAdapter: CloudStorageAdapter): void {
    this.cloudAdapter = cloudAdapter;
    logger.info('AdapterManager: Cloud adapter set');
  }

  // Remove cloud adapter when user logs out
  removeCloudAdapter(): void {
    this.cloudAdapter = null;
    if (this.currentWorkspaceId === 'cloud') {
      this.currentWorkspaceId = null; // Switch back to default local
    }
    logger.info('AdapterManager: Cloud adapter removed');
  }

  // Check if cloud is available
  hasCloudAdapter(): boolean {
    return !!(this.cloudAdapter && this.cloudAdapter.isAuthenticated);
  }

  // Cleanup
  cleanup(): void {
    this.localAdapter?.cleanup();
    this.cloudAdapter?.cleanup();
  }
}