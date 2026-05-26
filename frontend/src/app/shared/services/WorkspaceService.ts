import type { CloudStorageAdapter } from '../../core/storage/adapters/CloudStorageAdapter';
import { logger } from '../utils';
import { setLocalStorage, getLocalStorage, STORAGE_KEYS } from '@shared/utils';

export interface Workspace {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'group';
  isRemovable: boolean;
  cloudAdapter?: CloudStorageAdapter;
}

export class WorkspaceService {
  private static instance: WorkspaceService | null = null;
  private workspaces: Map<string, Workspace> = new Map();
  private cloudAdapter: CloudStorageAdapter | null = null;
  private groupAdapter: CloudStorageAdapter | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    
    this.loadPersistedWorkspaces();
  }

  static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  
  addListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  
  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values()).sort((a, b) => {
      
      if (a.type === 'cloud' && b.type !== 'cloud') return -1;
      if (a.type !== 'cloud' && b.type === 'cloud') return 1;
      if (a.type === 'group' && b.type !== 'group') return -1;
      if (a.type !== 'group' && b.type === 'group') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  
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
      isRemovable: false, 
      cloudAdapter
    };

    this.workspaces.set('cloud', workspace);
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info(`Added cloud workspace for user: ${user.email}`);
  }

  addGroupWorkspace(groupAdapter: CloudStorageAdapter): void {
    const user = groupAdapter.getCurrentUser();
    if (!user?.groupId) {
      logger.warn('Cannot add group workspace: user is not a group member');
      return;
    }

    this.groupAdapter = groupAdapter;

    const workspace: Workspace = {
      id: 'group',
      name: 'Group',
      type: 'group',
      isRemovable: false,
      cloudAdapter: groupAdapter
    };

    this.workspaces.set('group', workspace);
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info(`Added group workspace for user: ${user.email}`);
  }

  
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

  
  logoutFromCloud(): void {
    const cloudWorkspace = this.workspaces.get('cloud');

    
    this.workspaces.delete('cloud');
    this.cloudAdapter = null;
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info('Removed cloud workspace');

    
    if (cloudWorkspace?.cloudAdapter) {
      cloudWorkspace.cloudAdapter.logout().then(() => {
        logger.info('Successfully logged out from cloud');
      }).catch((error) => {
        logger.error('Error during cloud logout:', error);
      });
    }
  }

  removeGroupWorkspace(): void {
    this.workspaces.delete('group');
    this.groupAdapter = null;
    this.persistWorkspaces();
    this.notifyListeners();
    logger.info('Removed group workspace');
  }

  
  getCloudAdapter(): CloudStorageAdapter | null {
    return this.cloudAdapter;
  }

  getGroupAdapter(): CloudStorageAdapter | null {
    return this.groupAdapter;
  }

  
  
  setCloudAdapter(cloudAdapter: CloudStorageAdapter): void {
    this.cloudAdapter = cloudAdapter;
    
    this.notifyListeners();
    logger.info('WorkspaceService: Cloud adapter reference set');
  }

  setGroupAdapter(groupAdapter: CloudStorageAdapter): void {
    this.groupAdapter = groupAdapter;
    this.notifyListeners();
    logger.info('WorkspaceService: Group adapter reference set');
  }

  
  isCloudAuthenticated(): boolean {
    const cloudWorkspace = this.workspaces.get('cloud');
    return !!(cloudWorkspace?.cloudAdapter?.isAuthenticated);
  }

  isGroupAuthenticated(): boolean {
    const groupWorkspace = this.workspaces.get('group');
    const user = groupWorkspace?.cloudAdapter?.getCurrentUser();
    return !!(groupWorkspace?.cloudAdapter?.isAuthenticated && user?.groupId);
  }

  
  getCloudUser(): { id: string; email: string } | null {
    const cloudWorkspace = this.workspaces.get('cloud');
    return cloudWorkspace?.cloudAdapter?.getCurrentUser() || null;
  }

  
  private persistWorkspaces(): void {
    try {
      const persistentData = {
        localWorkspaces: Array.from(this.workspaces.values())
          .filter(ws => ws.type === 'local')
          .map(ws => ({ id: ws.id, name: ws.name })),
        hasCloudWorkspace: this.workspaces.has('cloud'),
        hasGroupWorkspace: this.workspaces.has('group')
      };

      setLocalStorage(STORAGE_KEYS.WORKSPACES, persistentData);
    } catch (error) {
      logger.error('Failed to persist workspaces:', error);
    }
  }

  
  private loadPersistedWorkspaces(): void {
    try {
      const saved = getLocalStorage<{ localWorkspaces?: Array<{id: string; name: string}>; hasCloudWorkspace?: boolean }>(STORAGE_KEYS.WORKSPACES);
      if (!saved.success || !saved.data) return;

      
      

      
      

      logger.info(`Loaded persisted workspaces config`);
    } catch (error) {
      logger.error('Failed to load persisted workspaces:', error);
    }
  }


  
  restoreCloudWorkspace(cloudAdapter: CloudStorageAdapter): void {
    if (cloudAdapter.isAuthenticated) {
      this.addCloudWorkspace(cloudAdapter);
    }
  }

  restoreGroupWorkspace(groupAdapter: CloudStorageAdapter): void {
    const user = groupAdapter.getCurrentUser();
    if (groupAdapter.isAuthenticated && user?.groupId) {
      this.addGroupWorkspace(groupAdapter);
    }
  }

  
  getStorageAdapterForWorkspace(workspaceId: string): CloudStorageAdapter | null {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.cloudAdapter || null;
  }
}
