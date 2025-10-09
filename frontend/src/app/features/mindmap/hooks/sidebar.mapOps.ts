import { useState, useCallback } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { resolveWorkspaceId } from '@shared/utils/pathOperations';

interface UseSidebarMapOpsOptions {
  mindMaps: MindMapData[];
  currentWorkspaceId: string | null;
  onCreateMap: (title: string, workspaceId: string, category?: string) => void;
  extractCategory: (fullPath: string | null) => string | undefined;
  setEmptyFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useSidebarMapOps = ({
  mindMaps,
  currentWorkspaceId,
  onCreateMap,
  extractCategory,
  setEmptyFolders
}: UseSidebarMapOpsOptions) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = useCallback((mapIdentifier: MapIdentifier, currentTitle: string) => {
    setEditingMapId(mapIdentifier.mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  }, []);

  const handleCreateMap = useCallback((parentPath: string | null) => {
    const category = extractCategory(parentPath);
    const displayPath = category || 'ルート';
    const parentInfo = category ? ` (${displayPath} 内)` : '';

    // eslint-disable-next-line no-alert
    const mapName = window.prompt(`新しいマインドマップの名前を入力してください${parentInfo}:`, '新しいマインドマップ');
    if (mapName && mapName.trim()) {
      // parentPathからworkspaceIdを解決（フォールバック付き）
      const fallbackWorkspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : null);
      const workspaceId = resolveWorkspaceId(parentPath, fallbackWorkspaceId, 'local');

      onCreateMap(mapName.trim(), workspaceId, category);

      // マップが作成されたフォルダを空フォルダリストから削除
      if (parentPath) {
        setEmptyFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
      }
    }
  }, [onCreateMap, setEmptyFolders, extractCategory, currentWorkspaceId, mindMaps]);

  return {
    editingMapId,
    editingTitle,
    setEditingTitle,
    handleStartRename,
    handleCancelRename,
    handleCreateMap
  };
};
// moved from hooks/sidebar to flatten sidebar hooks
