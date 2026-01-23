/**
 * Markdown file input/output operations
 * Handles reading and writing markdown files with caching
 */

import type { MindMapData } from '@shared/types';
import { logger } from '@shared/utils';
import { MarkdownImporter } from '../../../features/markdown/markdownImporter';

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

interface SaveTarget {
  dir: DirHandle;
  fileName: string;
  isRoot: boolean;
  baseHeadingLevel?: number;
  headingLevelByText?: Record<string, number>;
  fileHandle?: FileHandle;
  handle?: DirHandle;
  id: string;
  name: string;
}

/**
 * Read markdown content from a file handle
 */
export async function readMarkdownFile(fileHandle: FileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Get file last modified timestamp
 */
export async function getFileLastModified(fileHandle: FileHandle): Promise<number> {
  const file = await fileHandle.getFile();
  return file.lastModified;
}

/**
 * Get file name from file handle
 */
export async function getFileName(fileHandle: FileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return file.name || 'map.md';
}

/**
 * Parse markdown file to MindMapData
 */
export async function parseMarkdownToMapData(
  markdown: string,
  mapId: string,
  workspaceId: string
): Promise<MindMapData | null> {
  try {
    const result = MarkdownImporter.parseMarkdownToNodes(markdown);

    if (!result || !result.rootNodes || result.rootNodes.length === 0) {
      return null;
    }

    const now = new Date().toISOString();

    const data: MindMapData = {
      rootNodes: result.rootNodes,
      title: mapId,
      createdAt: now,
      updatedAt: now,
      mapIdentifier: { mapId, workspaceId },
      settings: {} as MindMapData['settings'],
    };

    return data;
  } catch (error) {
    logger.error('Failed to parse markdown:', error);
    return null;
  }
}

/**
 * Write markdown content to a file
 */
export async function writeMarkdownFile(
  fileHandle: FileHandle,
  content: string
): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Create or get a markdown file in a directory
 */
export async function getOrCreateMarkdownFile(
  dir: DirHandle,
  fileName: string
): Promise<FileHandle> {
  return await dir.getFileHandle(fileName, { create: true });
}

/**
 * Check if content has changed (for optimization)
 */
export function hasContentChanged(
  lastSaved: string | undefined,
  newContent: string
): boolean {
  return lastSaved !== newContent;
}

/**
 * Load markdown file and parse to map data with error handling
 */
export async function loadMarkdownAsMapData(
  fileHandle: FileHandle,
  mapId: string,
  workspaceId: string,
  warnedFiles: Set<string>
): Promise<MindMapData | null> {
  try {
    const markdown = await readMarkdownFile(fileHandle);
    const data = await parseMarkdownToMapData(markdown, mapId, workspaceId);

    if (!data) {
      const fileName = await getFileName(fileHandle);
      if (!warnedFiles.has(fileName)) {
        logger.warn(`Skipping non-structured markdown file: ${fileName}`);
        warnedFiles.add(fileName);
      }
      return null;
    }

    return data;
  } catch (error) {
    const fileName = await getFileName(fileHandle);
    const errorName = (error as Error & { name?: string })?.name;

    // Only warn once per file for permission issues
    if (errorName === 'NotAllowedError' && !warnedFiles.has(fileName)) {
      logger.warn(`Permission denied for file: ${fileName}`);
      warnedFiles.add(fileName);
    } else if (!warnedFiles.has(fileName)) {
      logger.error(`Failed to read file ${fileName}:`, error);
      warnedFiles.add(fileName);
    }

    return null;
  }
}

/**
 * Save map data to markdown file
 */
export async function saveMapDataToFile(
  target: SaveTarget,
  markdown: string,
  lastSavedContent: Map<string, string>
): Promise<void> {
  // Guard: Do not overwrite files with empty content
  if (!markdown || markdown.trim().length === 0) {
    throw new Error('Cannot save empty markdown content');
  }

  const mapKey = `${target.id}/${target.name}`;

  // Optimization: Skip if content hasn't changed
  if (!hasContentChanged(lastSavedContent.get(mapKey), markdown)) {
    logger.debug(`Skipping save for ${mapKey} - content unchanged`);
    return;
  }

  const fileHandle = target.fileHandle || await getOrCreateMarkdownFile(target.dir, target.fileName);
  await writeMarkdownFile(fileHandle, markdown);

  // Update cache
  lastSavedContent.set(mapKey, markdown);

  logger.debug(`Saved markdown to ${target.fileName}`);
}
