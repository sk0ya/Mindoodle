import type { CloudStorageAdapter } from '../../core/storage/adapters/CloudStorageAdapter';
import { logger } from '../utils';
import { setLocalStorage, getLocalStorage, STORAGE_KEYS } from '@shared/utils';

export interface Workspace {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  isRemovable: boolean;
  cloudAdapter?: CloudStorageAdapter;
}

export class WorkspaceService {
  private static instance: WorkspaceService | null = null;
  private workspaces: Map<string, Workspace> = new Map();
  private cloudAdapter: CloudStorageAdapter | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    // Initialize with any persisted workspaces
    this.loadPersistedWorkspaces();
  }

  static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  // Event listeners for workspace changes
  addListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  // Get all workspaces
  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values()).sort((a, b) => {
      // Cloud workspace first, then local workspaces
      if (a.type === 'cloud' && b.type !== 'cloud') return -1;
      if (a.type !== 'cloud' && b.type === 'cloud') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Get workspace by ID
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  // Add local workspace
  addLocalWorkspace(id: string, name: string): void {
    const workspace: Workspace = {
      id,
      name,
      type: 'local',
      isRemovable: true
    };

    this.workspaces.set(id, workspace);
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info(`Added local workspace: ${name} (${id})`);
  }

  // Add cloud workspace (when user authenticates)
  addCloudWorkspace(cloudAdapter: CloudStorageAdapter): void {
    const user = cloudAdapter.getCurrentUser();
    if (!user) {
      logger.warn('Cannot add cloud workspace: user not authenticated');
      return;
    }

    this.cloudAdapter = cloudAdapter;

    const workspace: Workspace = {
      id: 'cloud',
      name: 'Cloud',
      type: 'cloud',
      isRemovable: false, // Cloud workspace cannot be removed, only logged out
      cloudAdapter
    };

    this.workspaces.set('cloud', workspace);
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info(`Added cloud workspace for user: ${user.email}`);
  }

  // Remove workspace
  removeWorkspace(id: string): boolean {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      logger.warn(`Cannot remove workspace: workspace ${id} not found`);
      return false;
    }

    if (!workspace.isRemovable) {
      logger.warn(`Cannot remove workspace: workspace ${id} is not removable`);
      return false;
    }

    this.workspaces.delete(id);
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info(`Removed workspace: ${workspace.name} (${id})`);
    return true;
  }

  // Logout from cloud (removes cloud workspace)
  async logoutFromCloud(): Promise<void> {
    const cloudWorkspace = this.workspaces.get('cloud');
    if (cloudWorkspace?.cloudAdapter) {
      try {
        await cloudWorkspace.cloudAdapter.logout();
        logger.info('Successfully logged out from cloud');
      } catch (error) {
        logger.error('Error during cloud logout:', error);
      }
    }

    this.workspaces.delete('cloud');
    this.cloudAdapter = null;
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info('Removed cloud workspace');
  }

  // Get cloud adapter
  getCloudAdapter(): CloudStorageAdapter | null {
    return this.cloudAdapter;
  }

  // Set (or replace) the cloud adapter instance without registering a workspace.
  // Use this to ensure a single shared adapter instance app-wide before auth.
  setCloudAdapter(cloudAdapter: CloudStorageAdapter): void {
    this.cloudAdapter = cloudAdapter;
    // Do not persist or add a workspace here; that happens on successful auth.
    this.notifyListeners();
    logger.info('WorkspaceService: Cloud adapter reference set');
  }

  // Check if user is authenticated with cloud
  isCloudAuthenticated(): boolean {
    const cloudWorkspace = this.workspaces.get('cloud');
    return !!(cloudWorkspace?.cloudAdapter?.isAuthenticated);
  }

  // Get current user info for cloud workspace
  getCloudUser(): { id: string; email: string } | null {
    const cloudWorkspace = this.workspaces.get('cloud');
    return cloudWorkspace?.cloudAdapter?.getCurrentUser() || null;
  }

  // Persist workspace configuration to localStorage
  private persistWorkspaces(): void {
    try {
      const persistentData = {
        localWorkspaces: Array.from(this.workspaces.values())
          .filter(ws => ws.type === 'local')
          .map(ws => ({ id: ws.id, name: ws.name })),
        hasCloudWorkspace: this.workspaces.has('cloud')
      };

      setLocalStorage(STORAGE_KEYS.WORKSPACES, persistentData);
    } catch (error) {
      logger.error('Failed to persist workspaces:', error);
    }
  }

  // Load workspace configuration from localStorage
  private loadPersistedWorkspaces(): void {
    try {
      const saved = getLocalStorage<any>(STORAGE_KEYS.WORKSPACES);
      if (!saved.success || !saved.data) return;

      // Skip local workspaces - they are not used in new design
      // Only cloud workspace is managed by WorkspaceService

      // Note: Cloud workspace will be restored when CloudStorageAdapter initializes
      // and finds a valid auth token in localStorage

      logger.info(`Loaded persisted workspaces config`);
    } catch (error) {
      logger.error('Failed to load persisted workspaces:', error);
    }
  }


  // Restore cloud workspace on app startup (called by CloudStorageAdapter)
  restoreCloudWorkspace(cloudAdapter: CloudStorageAdapter): void {
    if (cloudAdapter.isAuthenticated) {
      this.addCloudWorkspace(cloudAdapter);
    }
  }

  // Get storage adapter for workspace
  getStorageAdapterForWorkspace(workspaceId: string): CloudStorageAdapter | null {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.cloudAdapter || null;
  }
}
