import type { MindMapData, MapIdentifier } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../../types/storage.types';
import { generateTimestampedFilename } from '@shared/utils';

/**
 * Base storage adapter providing common utilities and patterns for all storage implementations.
 * Subclasses must implement all abstract methods to fulfill the StorageAdapter interface.
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  protected _isInitialized = false;

  // Abstract methods - must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract loadAllMaps(): Promise<MindMapData[]>;
  abstract addMapToList(map: MindMapData): Promise<void>;
  abstract removeMapFromList(id: MapIdentifier): Promise<void>;
  abstract updateMapInList?(map: MindMapData): Promise<void>;
  abstract cleanup(): void;
  abstract listWorkspaces?(): Promise<Array<{ id: string; name: string }>>;
  abstract getExplorerTree?(): Promise<ExplorerItem>;
  abstract createFolder?(relativePath: string, workspaceId?: string): Promise<void>;
  abstract deleteItem?(path: string): Promise<void>;
  abstract renameItem?(path: string, newName: string): Promise<void>;
  abstract moveItem?(sourcePath: string, targetFolderPath: string): Promise<void>;
  abstract getMapMarkdown?(id: MapIdentifier): Promise<string | null>;
  abstract getMapLastModified?(id: MapIdentifier): Promise<number | null>;
  abstract saveMapMarkdown?(id: MapIdentifier, markdown: string): Promise<void>;
  abstract saveImageFile?(relativePath: string, file: File | Blob, workspaceId?: string): Promise<void>;
  abstract readImageAsDataURL?(relativePath: string, workspaceId?: string): Promise<string | null>;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Parse a path string into an array of non-empty segments.
   * Splits on '/' and filters out empty strings.
   *
   * @example
   * parsePathParts('folder/subfolder/file.md') // ['folder', 'subfolder', 'file.md']
   * parsePathParts('/leading/slash/') // ['leading', 'slash']
   */
  protected parsePathParts(path: string): string[] {
    return (path || '').split('/').filter(Boolean);
  }

  /**
   * Clean a path by removing leading slashes and optional prefix.
   * Useful for normalizing paths from different sources.
   *
   * @param path - Path to clean
   * @param prefix - Optional prefix to remove (e.g., 'cloud/')
   */
  protected cleanPath(path: string, prefix?: string): string {
    const clean = (path || '').replace(/^\/+/, '');
    if (prefix && clean.startsWith(prefix)) {
      return clean.slice(prefix.length).replace(/^\/+/, '');
    }
    return clean.replace(/^\/+/, '');
  }

  /**
   * Remove .md extension from a path if present.
   * Case-insensitive to handle .MD, .md, .Md, etc.
   */
  protected removeMdExtension(path: string): string {
    return path.replace(/\.md$/i, '');
  }

  /**
   * Safe async wrapper that catches errors and returns a fallback value.
   * Prevents uncaught promise rejections and provides consistent error handling.
   *
   * @param fn - Async function to execute
   * @param fallback - Value to return if fn throws
   */
  protected async safeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  /**
   * Validate that markdown content is non-empty and suitable for saving.
   * Guards against accidentally overwriting files with empty content.
   *
   * @param markdown - Markdown content to validate
   * @returns true if markdown is a non-empty string
   */
  protected validateMarkdown(markdown: string): boolean {
    return typeof markdown === 'string' && markdown.trim().length > 0;
  }

  /**
   * Extract the title from markdown content by finding the first level-1 heading.
   * Falls back to 'Untitled' if no heading is found.
   *
   * @param markdown - Markdown content
   * @returns Extracted title or 'Untitled'
   */
  protected extractTitleFromMarkdown(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.slice(2).trim();
      }
    }
    return 'Untitled';
  }

  /**
   * Sort explorer items: folders first (alphabetically), then files (alphabetically).
   * Uses Japanese locale-aware comparison for proper sorting.
   *
   * @param items - Array of explorer items to sort
   * @returns Sorted array (mutates in place and returns)
   */
  protected sortExplorerItems(items: ExplorerItem[]): ExplorerItem[] {
    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ja');
    });
  }

  /**
   * Generate a unique name by appending a numeric suffix if the desired name already exists.
   * Tries suffixes from 1 to 999, then falls back to timestamp-based name.
   *
   * @param desiredName - The preferred name
   * @param extension - File extension (including dot)
   * @param existsCheck - Async function to check if a name already exists
   * @returns Promise resolving to a unique name
   */
  protected async generateUniqueName(
    desiredName: string,
    extension: string,
    existsCheck: (name: string) => Promise<boolean>
  ): Promise<string> {
    const baseWithoutExt = desiredName.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), '');

    if (!(await existsCheck(desiredName))) {
      return desiredName;
    }

    for (let i = 1; i < 1000; i++) {
      const candidate = `${baseWithoutExt}-${i}${extension}`;
      if (!(await existsCheck(candidate))) {
        return candidate;
      }
    }

    return generateTimestampedFilename(baseWithoutExt, extension);
  }

  /**
   * Generate a unique folder name by appending a numeric suffix if needed.
   * Similar to generateUniqueName but for folders (no extension).
   *
   * @param desiredName - The preferred folder name
   * @param existsCheck - Async function to check if a folder name already exists
   * @returns Promise resolving to a unique folder name
   */
  protected async generateUniqueFolderName(
    desiredName: string,
    existsCheck: (name: string) => Promise<boolean>
  ): Promise<string> {
    if (!(await existsCheck(desiredName))) {
      return desiredName;
    }

    for (let i = 1; i < 1000; i++) {
      const candidate = `${desiredName}-${i}`;
      if (!(await existsCheck(candidate))) {
        return candidate;
      }
    }

    return generateTimestampedFilename(desiredName);
  }

  /**
   * Check if two map identifiers refer to the same map.
   * Compares both mapId and workspaceId for uniqueness.
   *
   * @param id1 - First map identifier
   * @param id2 - Second map identifier
   * @returns true if identifiers match
   */
  protected isSameMap(id1: MapIdentifier, id2: MapIdentifier): boolean {
    return id1.mapId === id2.mapId && id1.workspaceId === id2.workspaceId;
  }
}
