import { describe, expect, it, vi } from 'vitest';
import {
  buildFullPath,
  extractWorkspaceId,
  getDirectoryFromWorkspace,
  getDirectoryPath,
  getFileNameFromPath,
  navigateToDirectory,
  parsePathParts,
  removeWorkspacePrefix,
  resolveParentDirAndName,
} from './PathResolver';
import type { Workspace } from './WorkspaceIndexedDB';

const directory = (name: string, children: Record<string, FileSystemDirectoryHandle> = {}): FileSystemDirectoryHandle => ({
  kind: 'directory', name,
  getDirectoryHandle: vi.fn(async (child: string) => {
    const result = children[child];
    if (!result) throw new Error('not found');
    return result;
  })
} as unknown as FileSystemDirectoryHandle);

describe('PathResolver', () => {
  it('normalizes paths and extracts their components', () => {
    expect(parsePathParts(' /folder// note.md ')).toEqual(['folder', 'note.md']);
    expect(parsePathParts('')).toEqual([]);
    expect(getFileNameFromPath('/a/b.md')).toBe('b.md');
    expect(getDirectoryPath('/a/b.md')).toBe('a');
    expect(buildFullPath('ws_1', 'folder/map.md')).toBe('ws_1/folder/map.md');
    expect(buildFullPath('', 'map.md')).toBe('map.md');
  });

  it('recognizes and removes workspace prefixes', () => {
    expect(extractWorkspaceId('/ws_123/folder/map.md')).toBe('ws_123');
    expect(extractWorkspaceId('folder/map.md')).toBeNull();
    expect(removeWorkspacePrefix('/ws_123/folder/map.md')).toBe('folder/map.md');
    expect(removeWorkspacePrefix('folder/map.md')).toBe('folder/map.md');
  });

  it('resolves directories from an existing workspace and returns null for missing paths', async () => {
    const nested = directory('nested');
    const root = directory('root', { folder: nested });
    const workspace = { id: 'ws_1', name: 'Workspace', handle: root } as Workspace;

    expect(await navigateToDirectory(root, ['folder'])).toBe(nested);
    expect(await navigateToDirectory(root, ['missing'])).toBeNull();
    expect(await getDirectoryFromWorkspace([workspace], 'ws_1', 'folder')).toBe(nested);
    expect(await getDirectoryFromWorkspace([workspace], 'missing', '')).toBeNull();
  });

  it('resolves workspace-qualified and default-root paths', async () => {
    const folder = directory('folder');
    const workspaceRoot = directory('workspace', { folder });
    const workspace = { id: 'ws_1', name: 'Workspace', handle: workspaceRoot } as Workspace;

    await expect(resolveParentDirAndName('ws_1/folder/map.md', [workspace], null))
      .resolves.toEqual({ dir: folder, name: 'map.md' });
    await expect(resolveParentDirAndName('folder/map.md', [workspace], null))
      .resolves.toEqual({ dir: folder, name: 'map.md' });
    await expect(resolveParentDirAndName('', [workspace], null)).resolves.toBeNull();
    await expect(resolveParentDirAndName('missing/map.md', [workspace], null)).resolves.toBeNull();
  });
});
