/**
 * Explorer tree building utilities
 * Constructs file/folder hierarchy for the explorer UI
 */

import type { ExplorerItem } from '../../types/storage.types';
import type { Workspace } from './WorkspaceIndexedDB';
import { ensurePermission } from './fileSystemHelpers';
import { logger } from '@shared/utils';

type DirHandle = FileSystemDirectoryHandle;

type DirHandleWithIterators = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

/**
 * Build explorer tree for multiple workspaces
 */
export async function buildWorkspacesExplorerTree(
  workspaces: Workspace[],
  permissionWarned: boolean
): Promise<ExplorerItem> {
  const root: ExplorerItem = {
    type: 'folder',
    name: 'workspaces',
    path: '',
    children: [],
  };

  for (const ws of workspaces) {
    const hasPermission = await ensurePermission(ws.handle, permissionWarned);
    const children = hasPermission ? await buildExplorerItems(ws.handle, `/${ws.id}`) : [];
    const name = hasPermission ? ws.name : `${ws.name} (権限が必要)`;

    root.children?.push({
      type: 'folder',
      name,
      path: `/${ws.id}`,
      children,
    });
  }

  return root;
}

/**
 * Build explorer tree for a single root handle
 */
export async function buildRootExplorerTree(
  rootHandle: DirHandle,
  permissionWarned: boolean
): Promise<ExplorerItem> {
  const hasPermission = await ensurePermission(rootHandle, permissionWarned);

  if (!hasPermission) {
    if (!permissionWarned) {
      logger.warn('Root folder permission is not granted. Please reselect the folder.');
    }
    return {
      type: 'folder',
      name: rootHandle?.name || '',
      path: '',
      children: [],
    };
  }

  const root: ExplorerItem = {
    type: 'folder',
    name: rootHandle.name || '',
    path: '',
    children: [],
  };

  root.children = await buildExplorerItems(rootHandle, '');
  return root;
}

/**
 * Build explorer items recursively from a directory
 */
export async function buildExplorerItems(
  dir: DirHandle,
  basePath: string
): Promise<ExplorerItem[]> {
  const items: ExplorerItem[] = [];
  const valuesFn = (dir as DirHandleWithIterators).values;

  const processEntries = async (iterator: AsyncIterable<FileSystemHandle>) => {
    for await (const entry of iterator) {
      if (entry.kind === 'directory') {
        const path = basePath ? `${basePath}/${entry.name}` : entry.name;
        const subHandle = entry as DirHandle;
        const children = await buildExplorerItems(subHandle, path);
        items.push({
          type: 'folder',
          name: entry.name,
          path,
          children,
        });
      } else if (entry.kind === 'file') {
        if (entry.name.toLowerCase().endsWith('.md')) {
          const path = basePath ? `${basePath}/${entry.name}` : entry.name;
          items.push({
            type: 'file',
            name: entry.name,
            path,
          });
        }
      }
    }
  };

  if (typeof valuesFn === 'function') {
    await processEntries(valuesFn.call(dir));
  }

  // Sort: folders first, then files, alphabetically within each group
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Iterate through directory entries
 */
export async function* iterateDirectoryEntries(
  dir: DirHandle
): AsyncGenerator<FileSystemDirectoryHandle | FileSystemFileHandle, void, unknown> {
  const entriesFn = (dir as DirHandleWithIterators).entries;
  if (typeof entriesFn === 'function') {
    for await (const [, entry] of entriesFn.call(dir)) {
      yield entry as FileSystemDirectoryHandle | FileSystemFileHandle;
    }
  }
}

/**
 * Count markdown files in a directory (recursive)
 */
export async function countMarkdownFiles(dir: DirHandle): Promise<number> {
  let count = 0;

  for await (const entry of iterateDirectoryEntries(dir)) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
      count++;
    } else if (entry.kind === 'directory') {
      count += await countMarkdownFiles(entry as DirHandle);
    }
  }

  return count;
}

/**
 * Find all markdown files in a directory (recursive)
 */
export async function findAllMarkdownFiles(
  dir: DirHandle,
  basePath: string = ''
): Promise<Array<{ name: string; path: string; handle: FileSystemFileHandle }>> {
  const files: Array<{ name: string; path: string; handle: FileSystemFileHandle }> = [];

  for await (const entry of iterateDirectoryEntries(dir)) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
      files.push({
        name: entry.name,
        path: entryPath,
        handle: entry as FileSystemFileHandle,
      });
    } else if (entry.kind === 'directory') {
      const subFiles = await findAllMarkdownFiles(entry as DirHandle, entryPath);
      files.push(...subFiles);
    }
  }

  return files;
}
