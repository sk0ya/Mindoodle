import { useState, useCallback, useEffect } from 'react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { createChildFolderPath, logger, getLastPathSegment, splitPath } from '@shared/utils';

interface UseSidebarFolderOpsOptions {
  mindMaps: MindMapData[];
  currentWorkspaceId: string | null;
  onChangeCategory: (id: MapIdentifier, category: string) => void;
  onCreateFolder?: (path: string) => Promise<void> | void;
}

export const useSidebarFolderOps = ({
  mindMaps,
  currentWorkspaceId,
  onChangeCategory,
  onCreateFolder
}: UseSidebarFolderOpsOptions) => {
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());

  // Clear emptyFolders when workspace changes
  useEffect(() => {
    setEmptyFolders(new Set());
  }, [currentWorkspaceId]);

  // workspaceIdを除去してcategoryを作成するヘルパー関数
  const extractCategory = useCallback((fullPath: string | null): string | undefined => {
    if (!fullPath) return undefined;

    // workspaceIdのパターンにマッチするかチェック (ws_xxx or cloud)
    const wsMatch = fullPath.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
    if (wsMatch) {
      const [, , categoryPart] = wsMatch;
      return categoryPart || undefined;
    }

    // workspaceIdパターンでない場合はそのまま返す
    return fullPath || undefined;
  }, []);

  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      return prev.has(category)
        ? (prev.size === 1 ? new Set<string>() : (() => { const s = new Set(prev); s.delete(category); return s; })())
        : (() => { const s = new Set(prev); s.add(category); return s; })();
    });
  }, []);

  const handleCreateFolder = useCallback((parentPath: string | null) => {
    const parentInfo = parentPath ? ` (${parentPath} の下)` : '';
    // eslint-disable-next-line no-alert
    const newFolderName = window.prompt(`新しいフォルダ名を入力してください${parentInfo}:`, '');
    if (newFolderName && newFolderName.trim()) {
      // parentPathからworkspaceIdを抽出
      let workspaceId: string;
      let cleanParentPath: string | null = null;

      if (parentPath) {
        const wsMatch = parentPath.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
        if (wsMatch) {
          workspaceId = wsMatch[1];
          cleanParentPath = wsMatch[2] || null;
        } else {
          // ワークスペース情報が含まれていない場合、現在のワークスペースを使用
          workspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : 'local');
          cleanParentPath = parentPath;
        }
      } else {
        // parentPathがnullの場合、適切なワークスペースを決定
        workspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : 'local');
      }

      const newFolderPath = createChildFolderPath(cleanParentPath, newFolderName.trim());

      if (onCreateFolder) {
        const fullPath = `/${workspaceId}/${newFolderPath}`;
        Promise.resolve(onCreateFolder(fullPath)).then(() => {
          // Successfully created folder - update UI state
          setEmptyFolders(prev => new Set([...prev, newFolderPath]));
          setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            newSet.delete(newFolderPath);
            return newSet;
          });
        }).catch((err) => {
          console.error('MindMapSidebar: onCreateFolder failed:', err);
        });
      } else {
        // フォールバック: UIのみ更新
        setEmptyFolders(prev => new Set([...prev, newFolderPath]));
        setCollapsedCategories(prev => {
          const newSet = new Set(prev);
          newSet.delete(newFolderPath);
          return newSet;
        });
      }
    }
  }, [onCreateFolder, currentWorkspaceId, mindMaps]);

  // フォルダの削除ハンドラー
  const handleDeleteFolder = useCallback((folderPath: string) => {
    // そのフォルダに属するマップをチェック
    const mapsInFolder = mindMaps.filter(map => map.category === folderPath);

    // そのフォルダの子フォルダに属するマップもチェック
    const mapsInSubfolders = mindMaps.filter(map =>
      map.category && map.category.startsWith(folderPath + '/')
    );

    const totalMaps = mapsInFolder.length + mapsInSubfolders.length;

    if (totalMaps > 0) {
      // マップが含まれている場合は削除を拒否
      // eslint-disable-next-line no-alert
      alert(`「${folderPath}」またはその子フォルダにマップが含まれているため削除できません。先にマップを移動または削除してください。`);
      return;
    }

    // 空のフォルダの場合
    // eslint-disable-next-line no-alert
    if (window.confirm(`空のフォルダ「${folderPath}」を削除しますか？`)) {
      // 空フォルダリストから削除
      setEmptyFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        // 子フォルダも削除
        Array.from(prev).forEach(folder => {
          if (folder.startsWith(folderPath + '/')) {
            newSet.delete(folder);
          }
        });
        return newSet;
      });

      // 折りたたみ状態からも削除
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });

      logger.info(`空のフォルダ「${folderPath}」を削除しました`);
    }
  }, [mindMaps]);

  // フォルダのリネームハンドラー
  const handleRenameFolder = useCallback((oldPath: string) => {
    const currentName = getLastPathSegment(oldPath) || oldPath;
    // eslint-disable-next-line no-alert
    const newName = window.prompt(`フォルダ名を変更:`, currentName);

    if (newName && newName.trim() && newName.trim() !== currentName) {
      const pathParts = splitPath(oldPath);
      pathParts[pathParts.length - 1] = newName.trim();
      const newPath = pathParts.join('/');

      // そのフォルダ内のすべてのマップのカテゴリを更新
      const mapsToUpdate = mindMaps.filter(map =>
        map.category === oldPath || (map.category && map.category.startsWith(oldPath + '/'))
      );

      mapsToUpdate.forEach(map => {
        const updatedCategory = map.category?.replace(oldPath, newPath);
        if (updatedCategory) {
          onChangeCategory({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId }, updatedCategory);
        }
      });

      // 空フォルダの場合もパス更新
      setEmptyFolders(prev => {
        const newSet = new Set<string>();
        Array.from(prev).forEach(folder => {
          if (folder === oldPath) {
            newSet.add(newPath);
          } else if (folder.startsWith(oldPath + '/')) {
            newSet.add(folder.replace(oldPath, newPath));
          } else {
            newSet.add(folder);
          }
        });
        return newSet;
      });

      // 折りたたみ状態も更新
      setCollapsedCategories(prev => {
        const newSet = new Set<string>();
        Array.from(prev).forEach(category => {
          if (category === oldPath) {
            newSet.add(newPath);
          } else if (category.startsWith(oldPath + '/')) {
            newSet.add(category.replace(oldPath, newPath));
          } else {
            newSet.add(category);
          }
        });
        return newSet;
      });

      logger.info(`フォルダ名を「${oldPath}」から「${newPath}」に変更しました`);
    }
  }, [mindMaps, onChangeCategory]);

  return {
    emptyFolders,
    setEmptyFolders,
    collapsedCategories,
    extractCategory,
    toggleCategoryCollapse,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder
  };
};
// moved from hooks/sidebar to flatten sidebar hooks
