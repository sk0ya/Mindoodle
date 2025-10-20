/**
 * File System Access API helper functions
 */

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

// Type for FileSystemHandle with permission methods
type FSHandleWithPermissions = FileSystemHandle & {
  queryPermission?: (descriptor: { mode: string }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (descriptor: { mode: string }) => Promise<'granted' | 'denied' | 'prompt'>;
};

// Type for directory handle with iterator methods
type DirHandleWithIterators = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

/**
 * Query permission for a file system handle
 */
export async function queryPermission(handle: FileSystemHandle): Promise<'granted' | 'denied' | 'prompt'> {
  const handleWithPerm = handle as FSHandleWithPermissions;
  if (typeof handleWithPerm.queryPermission === 'function') {
    return await handleWithPerm.queryPermission({ mode: 'readwrite' });
  }
  return 'granted'; // Fallback for unsupported browsers
}

/**
 * Request permission for a file system handle
 */
export async function requestPermission(handle: FileSystemHandle): Promise<'granted' | 'denied' | 'prompt'> {
  const handleWithPerm = handle as FSHandleWithPermissions;
  if (typeof handleWithPerm.requestPermission === 'function') {
    return await handleWithPerm.requestPermission({ mode: 'readwrite' });
  }
  return 'granted'; // Fallback for unsupported browsers
}

/**
 * Ensure we have permission to access a file system handle
 */
export async function ensurePermission(handle: FileSystemHandle, permissionWarned: boolean): Promise<boolean> {
  const status = await queryPermission(handle);
  if (status === 'granted') {
    return true;
  }

  if (status === 'prompt') {
    const requested = await requestPermission(handle);
    if (requested === 'granted') {
      return true;
    }
  }

  if (!permissionWarned) {
    console.warn('[MarkdownFolderAdapter] Permission denied for folder access. Please grant permission.');
  }
  return false;
}

/**
 * Get or create a directory in a parent directory
 */
export async function getOrCreateDirectory(parent: DirHandle, name: string): Promise<DirHandle> {
  return await parent.getDirectoryHandle(name, { create: true });
}

/**
 * Get existing directory (throws if not found)
 */
export async function getExistingDirectory(parent: DirHandle, name: string): Promise<DirHandle> {
  return await parent.getDirectoryHandle(name, { create: false });
}

/**
 * Get existing file (throws if not found)
 */
export async function getExistingFile(parent: DirHandle, name: string): Promise<FileHandle> {
  return await parent.getFileHandle(name, { create: false });
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  const segs = path.split('/').filter(Boolean);
  return segs[segs.length - 1] || '';
}

/**
 * Copy file handle to a new directory
 */
export async function copyFileHandle(srcFile: FileHandle, destDir: DirHandle, destName: string): Promise<void> {
  const file = await srcFile.getFile();
  const newFile = await destDir.getFileHandle(destName, { create: true });
  const writable = await newFile.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

/**
 * Write text to a file
 */
export async function writeTextFile(fileHandle: FileHandle, content: string): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Iterate over directory entries
 */
export async function* iterateEntries(dir: DirHandle): AsyncIterable<[string, FileSystemHandle]> {
  const dirWithIter = dir as DirHandleWithIterators;
  if (dirWithIter.entries) {
    for await (const entry of dirWithIter.entries()) {
      yield entry;
    }
  }
}

/**
 * Iterate over markdown files in a directory recursively
 */
export async function* iterateMarkdownFiles(
  dir: DirHandle,
  parentPath: string = ''
): AsyncIterable<{ path: string; handle: FileHandle }> {
  for await (const [name, handle] of iterateEntries(dir)) {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    if (handle.kind === 'directory') {
      yield* iterateMarkdownFiles(handle as DirHandle, fullPath);
    } else if (handle.kind === 'file' && name.endsWith('.md')) {
      yield { path: fullPath, handle: handle as FileHandle };
    }
  }
}

/**
 * Copy directory recursively
 */
export async function copyDirectoryRecursive(srcDir: DirHandle, destDir: DirHandle): Promise<void> {
  for await (const [name, handle] of iterateEntries(srcDir)) {
    if (handle.kind === 'file') {
      await copyFileHandle(handle as FileHandle, destDir, name);
    } else if (handle.kind === 'directory') {
      const newSubDir = await getOrCreateDirectory(destDir, name);
      await copyDirectoryRecursive(handle as DirHandle, newSubDir);
    }
  }
}

/**
 * Resolve parent directory and name from path
 */
export async function resolveParentDirAndName(
  rootHandle: DirHandle,
  fullPath: string
): Promise<{ parentDir: DirHandle; name: string }> {
  const segments = fullPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Invalid path: empty');
  }

  const name = segments[segments.length - 1];
  let parentDir = rootHandle;

  for (let i = 0; i < segments.length - 1; i++) {
    parentDir = await getOrCreateDirectory(parentDir, segments[i]);
  }

  return { parentDir, name };
}

/**
 * Ensure unique file/folder name in directory
 */
export async function ensureUniqueName(dir: DirHandle, baseName: string, isDirectory: boolean): Promise<string> {
  const entries = new Set<string>();
  for await (const [name] of iterateEntries(dir)) {
    entries.add(name);
  }

  let candidate = baseName;
  let counter = 1;

  while (entries.has(candidate)) {
    const ext = isDirectory ? '' : '.md';
    const base = isDirectory ? baseName : baseName.replace(/\.md$/, '');
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }

  return candidate;
}

/**
 * Ensure unique folder name in directory
 */
export async function ensureUniqueFolderName(dir: DirHandle, baseName: string): Promise<string> {
  return ensureUniqueName(dir, baseName, true);
}
