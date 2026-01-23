/**
 * Path resolution and directory navigation utilities
 * Handles parsing map paths and resolving them to FileSystem handles
 */

import type { Workspace } from './WorkspaceIndexedDB';
import { getExistingDirectoryOrNull } from './fileSystemHelpers';

type DirHandle = FileSystemDirectoryHandle;

/**
 * Parse a map path into directory segments
 * Handles paths like "ws_123/folder/map.md" or "folder/map.md"
 */
export function parsePathParts(path: string): string[] {
  if (!path) return [];

  return path
    .split('/')
    .map(p => p.trim())
    .filter(Boolean);
}

/**
 * Get file name from a path
 */
export function getFileNameFromPath(path: string): string {
  const parts = parsePathParts(path);
  return parts[parts.length - 1] || '';
}

/**
 * Get directory path from a full file path
 */
export function getDirectoryPath(path: string): string {
  const parts = parsePathParts(path);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

/**
 * Resolve parent directory and file name from a path
 */
export async function resolveParentDirAndName(
  path: string,
  workspaces: Workspace[],
  rootHandle: DirHandle | null
): Promise<{ dir: DirHandle; name: string } | null> {
  const parts = parsePathParts(path);
  if (parts.length === 0) return null;

  let baseHandle: DirHandle | null = null;
  let pathParts = parts;

  // Check if path starts with workspace ID
  if (parts[0]?.startsWith('ws_')) {
    const workspace = workspaces.find(ws => ws.id === parts[0]);
    if (workspace?.handle) {
      baseHandle = workspace.handle;
      pathParts = parts.slice(1);
    }
  }

  // Fallback to first workspace or root handle
  baseHandle = baseHandle || workspaces[0]?.handle || rootHandle;
  if (!baseHandle || pathParts.length === 0) return null;

  const name = pathParts.pop()!;
  let dir: DirHandle = baseHandle;

  // Navigate through directory structure
  for (const part of pathParts) {
    const next = await getExistingDirectoryOrNull(dir, part);
    if (!next) return null;
    dir = next;
  }

  return { dir, name };
}

/**
 * Build full path including workspace ID
 */
export function buildFullPath(workspaceId: string, mapId: string): string {
  if (!mapId) return workspaceId;
  return workspaceId ? `${workspaceId}/${mapId}` : mapId;
}

/**
 * Extract workspace ID from path
 */
export function extractWorkspaceId(path: string): string | null {
  const parts = parsePathParts(path);
  if (parts.length > 0 && parts[0]?.startsWith('ws_')) {
    return parts[0];
  }
  return null;
}

/**
 * Remove workspace ID prefix from path
 */
export function removeWorkspacePrefix(path: string): string {
  const parts = parsePathParts(path);
  if (parts.length > 0 && parts[0]?.startsWith('ws_')) {
    return parts.slice(1).join('/');
  }
  return path;
}

/**
 * Navigate to a directory handle by path parts
 */
export async function navigateToDirectory(
  baseHandle: DirHandle,
  pathParts: string[]
): Promise<DirHandle | null> {
  let current: DirHandle = baseHandle;

  for (const part of pathParts) {
    const next = await getExistingDirectoryOrNull(current, part);
    if (!next) return null;
    current = next;
  }

  return current;
}

/**
 * Get directory handle from workspace and path
 */
export async function getDirectoryFromWorkspace(
  workspaces: Workspace[],
  workspaceId: string,
  dirPath: string
): Promise<DirHandle | null> {
  const workspace = workspaces.find(ws => ws.id === workspaceId);
  if (!workspace) return null;

  const parts = parsePathParts(dirPath);
  if (parts.length === 0) return workspace.handle;

  return await navigateToDirectory(workspace.handle, parts);
}
