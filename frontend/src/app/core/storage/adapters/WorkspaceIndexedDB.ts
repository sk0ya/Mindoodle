/**
 * IndexedDB operations for workspace persistence
 * Extracted from MarkdownFolderAdapter to reduce file complexity
 */

type WindowWithFSA = Window & {
  indexedDB?: IDBFactory & {
    databases?: () => Promise<Array<{ name?: string; version?: number }>>;
  };
};

type DirHandle = FileSystemDirectoryHandle;

export interface Workspace {
  id: string;
  name: string;
  handle: DirHandle;
}

const DB_NAME = 'mindoodle-fsa';
const DB_VERSION = 2;
const WORKSPACES_STORE = 'workspaces';
const HANDLES_STORE = 'handles';

/**
 * Open IndexedDB database for workspace storage
 */
export async function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = (window as WindowWithFSA).indexedDB?.open?.(DB_NAME, DB_VERSION);
    if (!req) {
      reject(new Error('indexedDB not available'));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }
      if (!db.objectStoreNames.contains(WORKSPACES_STORE)) {
        db.createObjectStore(WORKSPACES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist a workspace to IndexedDB
 */
export async function persistWorkspace(ws: Workspace): Promise<void> {
  const db = await openWorkspaceDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSPACES_STORE, 'readwrite');
      const req = tx.objectStore(WORKSPACES_STORE).put(
        { name: ws.name, handle: ws.handle },
        ws.id
      );
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Restore all workspaces from IndexedDB
 */
export async function restoreWorkspaces(): Promise<Workspace[]> {
  const workspaces: Workspace[] = [];

  try {
    // Check if database exists
    const databases = await (window as WindowWithFSA).indexedDB?.databases?.();
    const dbExists = databases?.some(db => db.name === DB_NAME);
    if (!dbExists) return workspaces;

    const db = await openWorkspaceDb();
    try {
      const items: Array<{ id: string; rec: { name: string; handle: DirHandle } }> =
        await new Promise((resolve, reject) => {
          const list: Array<{ id: string; rec: { name: string; handle: DirHandle } }> = [];
          const tx = db.transaction(WORKSPACES_STORE, 'readonly');
          const cursorReq = tx.objectStore(WORKSPACES_STORE).openCursor?.();

          if (!cursorReq) {
            resolve([]);
            return;
          }

          cursorReq.onsuccess = (ev: Event) => {
            const cursor = (ev.target as IDBRequest)?.result;
            if (cursor) {
              list.push({ id: String(cursor.key), rec: cursor.value });
              cursor.continue();
            } else {
              resolve(list);
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });

      for (const { id, rec } of items) {
        if (rec) {
          const name = rec.handle?.name || rec.name || 'workspace';
          workspaces.push({ id, name, handle: rec.handle });
        }
      }
    } finally {
      db.close();
    }
  } catch (error) {
    // Silently fail - return empty array
    console.warn('Failed to restore workspaces from IndexedDB:', error);
  }

  return workspaces;
}

/**
 * Check if database exists
 */
export async function checkWorkspaceDbExists(): Promise<boolean> {
  try {
    const databases = await (window as WindowWithFSA).indexedDB?.databases?.();
    return databases?.some(db => db.name === DB_NAME) ?? false;
  } catch {
    return false;
  }
}
