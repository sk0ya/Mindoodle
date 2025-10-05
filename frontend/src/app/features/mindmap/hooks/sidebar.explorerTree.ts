import { useState, useMemo } from 'react';
import type { ExplorerItem } from '@core/types';

interface UseSidebarExplorerTreeOptions {
  explorerTree: ExplorerItem;
  emptyFolders: Set<string>;
  currentWorkspaceId: string | null;
}

export const useSidebarExplorerTree = ({
  explorerTree,
  emptyFolders,
  currentWorkspaceId
}: UseSidebarExplorerTreeOptions) => {
  // Explorer collapsed state mapping: path -> collapsed?
  const [explorerCollapsed, setExplorerCollapsed] = useState<Record<string, boolean>>({});

  // Merge emptyFolders into explorerTree
  const enhancedExplorerTree = useMemo(() => {
    if (!explorerTree) return null;
    if (emptyFolders.size === 0 || !currentWorkspaceId) return explorerTree;

    // Clone the tree
    const clonedTree: ExplorerItem = JSON.parse(JSON.stringify(explorerTree));

    // Find the current workspace node in the tree
    const workspaceNode = clonedTree.children?.find(
      child => child.path === `/${currentWorkspaceId}` || child.path === currentWorkspaceId
    );

    if (!workspaceNode) {
      console.warn('MindMapSidebar: Workspace node not found in tree');
      return clonedTree;
    }

    // Add empty folders to the workspace node
    emptyFolders.forEach(folderPath => {
      const parts = folderPath.split('/').filter(p => p.trim());
      let current = workspaceNode;

      parts.forEach((part) => {
        if (!current.children) current.children = [];

        let folder = current.children.find(
          child => child.type === 'folder' && child.name === part
        );

        if (!folder) {
          const fullPath = `${current.path}/${part}`;
          folder = {
            type: 'folder',
            name: part,
            path: fullPath,
            children: []
          };
          current.children.push(folder);
        }

        current = folder;
      });
    });

    return clonedTree;
  }, [explorerTree, emptyFolders, currentWorkspaceId]);

  return {
    enhancedExplorerTree,
    explorerCollapsed,
    setExplorerCollapsed
  };
};
// moved from hooks/sidebar to flatten sidebar hooks
