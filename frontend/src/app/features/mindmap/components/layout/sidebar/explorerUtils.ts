/**
 * Shared utilities and types for Explorer components
 * Reduces duplication across ExplorerView and ExplorerNodeView
 */

import type { ExplorerItem } from '@core/types';
import { cleanWorkspacePath, parseWorkspacePath } from '@shared/utils';

/**
 * Common props shared between ExplorerView and ExplorerNodeView
 */
export interface ExplorerCommonProps {
  searchTerm?: string;
  collapsed?: Record<string, boolean>;
  onTogglePath?: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, path: string, type: 'explorer-folder' | 'explorer-file') => void;
  onPathFocus?: (path: string, type: 'explorer-folder' | 'explorer-file') => void;
  currentMapId?: string | null;
  currentWorkspaceId?: string | null;
  editingMapId?: string | null;
  editingTitle?: string;
  onCancelRename?: () => void;
  onEditingTitleChange?: (title: string) => void;
}

/**
 * Props for ExplorerNodeView component
 */
export interface ExplorerNodeViewProps extends ExplorerCommonProps {
  item: ExplorerItem;
  dragOverPath?: string | null;
  setDragOverPath?: (path: string | null) => void;
}

/**
 * Extracts category path excluding workspace folder
 */
export function extractCategoryFromPath(path: string): string {
  if (!path) return '';
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (p.startsWith('ws_') || p.startsWith('cloud')) {
    const slash = p.indexOf('/');
    return slash >= 0 ? p.slice(slash + 1) : '';
  }
  return path;
}

/**
 * Parses workspace ID and map ID from a file path
 * @returns {workspaceId, mapId} or {null, null} if not a markdown file
 */
export function parseWorkspaceAndMapId(path: string): { workspaceId: string | null; mapId: string | null } {
  const { workspaceId, relativePath } = parseWorkspacePath(path);
  if (workspaceId && relativePath && /\.md$/i.test(relativePath)) {
    return {
      workspaceId,
      mapId: relativePath.replace(/\.md$/i, '')
    };
  }
  return { workspaceId: null, mapId: null };
}

/**
 * Extracts relative path from a full path (removes workspace prefix)
 */
export function extractRelativePath(path: string): string {
  return cleanWorkspacePath(path);
}

/**
 * Checks if a filename is an image file
 */
export function isImageFile(name: string | undefined): boolean {
  if (!name) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}
