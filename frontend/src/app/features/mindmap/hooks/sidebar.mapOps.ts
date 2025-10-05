import { useState, useCallback } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';

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
      // parentPathからworkspaceIdを抽出
      // Pattern: /ws_xxx or /cloud
      let workspaceId: string | null = null;

      if (parentPath) {
        // Try to match workspace ID at the start of path
        const pathMatch = parentPath.match(/^\/?(ws_[^/]+|cloud)/);
        if (pathMatch) {
          workspaceId = pathMatch[1];
        }
      }

      // parentPathがnullまたはworkspaceIdが抽出できなかった場合
      if (!workspaceId) {
        if (currentWorkspaceId) {
          workspaceId = currentWorkspaceId;
        } else if (mindMaps.length > 0) {
          // 既存のマップから最初のワークスペースIDを取得
          workspaceId = mindMaps[0].mapIdentifier.workspaceId;
        } else {
          // デフォルトでローカルワークスペースを使用
          workspaceId = 'local';
        }
      }

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
