// moved to layout/sidebar
import React from 'react';
import { ExplorerNodeView } from './ExplorerNodeView';
import type { ExplorerItem } from '@core/types';

interface ExplorerViewProps {
  tree: ExplorerItem;
  searchTerm?: string;
  collapsed?: Record<string, boolean>;
  onTogglePath?: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, path: string, type: 'explorer-folder' | 'explorer-file') => void;
  currentMapId?: string | null;
  currentWorkspaceId?: string | null;
  editingMapId?: string | null;
  editingTitle?: string;
  onCancelRename?: () => void;
  onEditingTitleChange?: (title: string) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  tree,
  searchTerm = '',
  collapsed = {},
  onTogglePath,
  onContextMenu,
  currentMapId = null,
  currentWorkspaceId = null,
  editingMapId = null,
  editingTitle = '',
  onCancelRename,
  onEditingTitleChange
}) => {
  const toggle = (path: string) => onTogglePath && onTogglePath(path);
  const [dragOverPath, setDragOverPath] = React.useState<string | null>(null);

  // Helper function to extract category path excluding workspace folder
  const extractCategoryFromPath = (path: string): string => {
    if (!path) return '';
    // Support both local workspaces (ws_*) and cloud workspace
    const wsMatch = path.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
    if (wsMatch) {
      return wsMatch[2] || '';
    }
    return path;
  };

  // Helper function to filter tree based on search term while preserving structure
  const filterTree = (item: ExplorerItem, searchLower: string): ExplorerItem | null => {
    if (!searchTerm) return item;

    const isFile = item.type === 'file';

    // For files: check filename (excluding workspace folder)
    let fileMatches = false;
    if (isFile) {
      const filename = item.name || '';
      fileMatches = filename.toLowerCase().includes(searchLower);
    }

    // For folders: check folder name (excluding workspace folder)
    let folderMatches = false;
    if (item.type === 'folder') {
      const cleanFolderName = extractCategoryFromPath(item.path);
      const folderName = item.name || '';
      // Only search in the folder name itself, not workspace prefixes
      folderMatches = folderName.toLowerCase().includes(searchLower) || cleanFolderName.toLowerCase().includes(searchLower);
    }

    // Filter children recursively
    let filteredChildren: ExplorerItem[] = [];
    if (item.children) {
      filteredChildren = item.children
        .map(child => filterTree(child, searchLower))
        .filter((child): child is ExplorerItem => child !== null);
    }

    // Include this item if:
    // 1. It matches the search term directly
    // 2. It has children that match (to preserve tree structure)
    const shouldInclude = fileMatches || folderMatches || filteredChildren.length > 0;

    if (shouldInclude) {
      return {
        ...item,
        children: filteredChildren
      };
    }

    return null;
  };

  // Hide dot-files and dot-folders from explorer
  const pruneDotEntries = (item: ExplorerItem): ExplorerItem | null => {
    if (!item) return null as any;
    const name = item.name || '';
    // Skip items starting with '.'
    if (name.startsWith('.')) return null;
    // Recurse for folders
    if (item.type === 'folder' && Array.isArray(item.children)) {
      const pruned = item.children
        .map(pruneDotEntries)
        .filter((c): c is ExplorerItem => !!c);
      return { ...item, children: pruned };
    }
    return item;
  };

  const treeNoDots = pruneDotEntries(tree);

  // Apply search filtering on top of dot filtering
  const filteredTree = searchTerm && treeNoDots
    ? filterTree(treeNoDots, searchTerm.toLowerCase())
    : treeNoDots;


  // Return null if no filtered tree
  if (!filteredTree) {
    return (
      <div className="no-results">
        <span>No results found</span>
      </div>
    );
  }

  return (
    <div>
      {filteredTree.children && filteredTree.children.length > 0 ? (
        filteredTree.children.map((child, index) => (
          <ExplorerNodeView
            key={child.path || index}
            item={child}
            searchTerm={searchTerm}
            collapsed={collapsed}
            onTogglePath={toggle}
            onContextMenu={onContextMenu}
            currentMapId={currentMapId}
            currentWorkspaceId={currentWorkspaceId}
            dragOverPath={dragOverPath}
            setDragOverPath={setDragOverPath}
            editingMapId={editingMapId}
            editingTitle={editingTitle}
            onCancelRename={onCancelRename}
            onEditingTitleChange={onEditingTitleChange}
          />
        ))
      ) : (
        <ExplorerNodeView
          item={filteredTree}
          searchTerm={searchTerm}
          collapsed={collapsed}
          onTogglePath={toggle}
          onContextMenu={onContextMenu}
          currentMapId={currentMapId}
          currentWorkspaceId={currentWorkspaceId}
          dragOverPath={dragOverPath}
          setDragOverPath={setDragOverPath}
          editingMapId={editingMapId}
          editingTitle={editingTitle}
          onCancelRename={onCancelRename}
          onEditingTitleChange={onEditingTitleChange}
        />
      )}
    </div>
  );
};
