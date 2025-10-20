/**
 * IndexedDB helper functions for storing FileSystemHandles
 */

type DirHandle = FileSystemDirectoryHandle;

interface WorkspaceInfo {
  id: string;
  name: string;
  handle: DirHandle;
}

const DB_NAME = 'mindoodle-workspaces';
const DB_VERSION = 1;
const WORKSPACE_STORE = 'workspaces';
const LEGACY_DB_NAME = 'mindoodle-folder';
const LEGACY_STORE = 'root-handle';

/**
 * Open IndexedDB for workspaces
 */
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Open legacy IndexedDB (for backward compatibility)
 */
export function openLegacyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Load root handle from legacy storage
 */
export async function loadRootHandle(): Promise<DirHandle | null> {
  try {
    const db = await openLegacyDb();
    return new Promise<DirHandle | null>((resolve) => {
      const tx = db.transaction(LEGACY_STORE, 'readonly');
      const store = tx.objectStore(LEGACY_STORE);
      const req = store.get('root-folder-handle');

      req.onsuccess = () => {
        const result = req.result as DirHandle | undefined;
        resolve(result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save root handle to legacy storage
 */
export async function saveRootHandle(handle: DirHandle): Promise<void> {
  const db = await openLegacyDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE, 'readwrite');
    const store = tx.objectStore(LEGACY_STORE);
    const req = store.put(handle, 'root-folder-handle');

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist workspace to IndexedDB
 */
export async function persistWorkspace(workspace: WorkspaceInfo): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = tx.objectStore(WORKSPACE_STORE);
    const req = store.put(workspace);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Restore workspaces from IndexedDB
 */
export async function restoreWorkspaces(): Promise<WorkspaceInfo[]> {
  try {
    const db = await openDb();
    return new Promise<WorkspaceInfo[]>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readonly');
      const store = tx.objectStore(WORKSPACE_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const workspaces = req.result as WorkspaceInfo[] | undefined;
        resolve(workspaces || []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[indexedDBHelpers] Failed to restore workspaces:', err);
    return [];
  }
}

/**
 * Delete workspace from IndexedDB
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = tx.objectStore(WORKSPACE_STORE);
    const req = store.delete(workspaceId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
