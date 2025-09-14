// Minimal helpers to work with File System Access API

type DirHandle = any;
type FileHandle = any;

// Load previously saved root directory handle from IndexedDB (same DB/key as MarkdownFolderAdapter)
export async function loadRootDirectoryHandle(): Promise<DirHandle | null> {
  try {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = (window as any).indexedDB?.open?.('mindoodle-fsa', 1);
      if (!req) { reject(new Error('indexedDB not available')); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const handle: DirHandle | null = await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const req = store.get('root');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function resolveDirectory(root: DirHandle, relativePath: string): Promise<DirHandle | null> {
  const parts = (relativePath || '').split('/').filter(Boolean);
  let dir: DirHandle = root;
  for (const part of parts) {
    if (part === '.' ) continue;
    if (part === '..') return null; // do not allow parent traversal
    try {
      dir = await (dir.getDirectoryHandle?.(part) ?? (dir as any).getDirectoryHandle(part));
    } catch {
      return null;
    }
  }
  return dir;
}

export async function readFileFromRoot(root: DirHandle, fullPath: string): Promise<Blob | null> {
  const segments = fullPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const fileName = segments.pop() as string;
  const dirPath = segments.join('/');
  const dir = await resolveDirectory(root, dirPath);
  if (!dir) return null;
  try {
    const fh: FileHandle = await (dir.getFileHandle?.(fileName) ?? (dir as any).getFileHandle(fileName));
    const file = await fh.getFile();
    return file as Blob;
  } catch {
    return null;
  }
}

