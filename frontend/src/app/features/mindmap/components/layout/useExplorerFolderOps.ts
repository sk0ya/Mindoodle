import React from 'react';

interface MindMapLike {
  createFolder?: (relativePath: string, workspaceId?: string) => Promise<void> | void;
}

export const useExplorerFolderOps = (mindMap: MindMapLike) => {
  const handleCreateFolder = React.useCallback(async (path: string) => {
    if (typeof mindMap?.createFolder !== 'function') return;
    const trimmed = String(path || '').replace(/^\/+/, '');
    const parts = trimmed.split('/');
    const first = parts[0];
    if (first && (first.startsWith('ws_') || first === 'cloud')) {
      const workspaceId = first;
      const relativePath = parts.slice(1).join('/');
      await mindMap.createFolder(relativePath, workspaceId);
    } else {
      await mindMap.createFolder(path);
    }
  }, [mindMap]);

  return { handleCreateFolder };
};

