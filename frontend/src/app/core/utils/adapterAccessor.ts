

import type { StorageAdapter } from '@/app/core/types';


interface PersistenceHookLike {
  storageAdapter?: StorageAdapter | null;
  getAdapterForWorkspace?: (workspaceId: string | null) => StorageAdapter | null;
}


export function getAdapterForWorkspace(
  persistenceHook: PersistenceHookLike | null | undefined,
  workspaceId?: string | null
): StorageAdapter | null {
  if (!persistenceHook) {
    return null;
  }

  
  if (workspaceId !== undefined && typeof persistenceHook.getAdapterForWorkspace === 'function') {
    return persistenceHook.getAdapterForWorkspace(workspaceId);
  }

  
  return persistenceHook.storageAdapter ?? null;
}


export function getCurrentAdapter(
  persistenceHook: PersistenceHookLike | null | undefined
): StorageAdapter | null {
  return persistenceHook?.storageAdapter ?? null;
}
