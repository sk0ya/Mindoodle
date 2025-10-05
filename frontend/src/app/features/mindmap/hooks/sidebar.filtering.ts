import { useState, useMemo } from 'react';
import type { MindMapData } from '@shared/types';

interface UseSidebarFilteringOptions {
  mindMaps: MindMapData[];
  emptyFolders: Set<string>;
  currentWorkspaceId: string | null;
  extractCategory: (fullPath: string | null) => string | undefined;
}

export const useSidebarFiltering = ({
  mindMaps,
  emptyFolders,
  currentWorkspaceId,
  extractCategory
}: UseSidebarFilteringOptions) => {
  const [searchTerm, setSearchTerm] = useState('');

  // フィルタリングとグルーピング
  const { filteredMaps, groupedMaps, visibleFolders } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    // 現在のワークスペースに属するマップのみをフィルタリング
    const workspaceMaps = currentWorkspaceId
      ? mindMaps.filter(map => map.mapIdentifier.workspaceId === currentWorkspaceId)
      : mindMaps;

    const filtered = workspaceMaps.filter(map => {
      const titleMatch = map.title.toLowerCase().includes(searchLower);

      // カテゴリ名での検索（workspaceフォルダ部分は除外）
      let categoryMatch = false;
      if (map.category) {
        // workspaceフォルダ部分を除外したカテゴリパスを取得
        const cleanCategory = extractCategory(map.category) || map.category;
        categoryMatch = cleanCategory.toLowerCase().includes(searchLower);
      }

      return titleMatch || categoryMatch;
    });

    const grouped = filtered.reduce((groups: { [key: string]: MindMapData[] }, map) => {
      const category = map.category || '';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
      return groups;
    }, {});

    // 各カテゴリ内のマップを50音順でソート
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        return a.title.localeCompare(b.title, 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
      });
    });

    // 検索時のフォルダフィルタリング
    let foldersToShow = new Set<string>();

    if (searchTerm) {
      // 検索がある場合：マップが含まれるフォルダ + 検索にヒットするフォルダ名 + その親フォルダも含める
      Object.keys(grouped).forEach(category => {
        // マップが含まれるフォルダを追加
        foldersToShow.add(category);

        // 親フォルダも追加（階層構造を維持するため）
        const parts = category.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          foldersToShow.add(parentPath);
        }
      });

      // フォルダ名が検索条件にマッチするフォルダも追加（workspaceフォルダは除外）
      Array.from(emptyFolders).forEach(folder => {
        // workspaceフォルダ部分を除外したパスを取得
        const cleanFolderPath = extractCategory(folder) || folder;
        if (cleanFolderPath && cleanFolderPath.toLowerCase().includes(searchLower)) {
          foldersToShow.add(folder);

          // その親フォルダも追加
          const parts = folder.split('/');
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join('/');
            foldersToShow.add(parentPath);
          }
        }
      });
    } else {
      // 検索がない場合：すべてのフォルダを表示（中間フォルダも補完して表示）
      foldersToShow = new Set([...Object.keys(grouped), ...Array.from(emptyFolders)]);

      // 中間の祖先フォルダをすべて追加
      const addAncestors = (path: string) => {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          if (parentPath) foldersToShow.add(parentPath);
        }
      };
      Object.keys(grouped).forEach(addAncestors);
      Array.from(emptyFolders).forEach(addAncestors);
    }

    // 階層構造を保持したソート
    const sortedFolders = Array.from(foldersToShow).sort((a, b) => {
      // パスを分割
      const partsA = a.split('/');
      const partsB = b.split('/');

      // 共通の親パスを見つけるまで比較
      const minLength = Math.min(partsA.length, partsB.length);
      for (let i = 0; i < minLength; i++) {
        const comparison = partsA[i].localeCompare(partsB[i], 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
        if (comparison !== 0) return comparison;
      }

      // 共通部分が同じ場合、階層の深い方を後に
      return partsA.length - partsB.length;
    });

    return {
      filteredMaps: filtered,
      groupedMaps: grouped,
      visibleFolders: sortedFolders
    };
  }, [mindMaps, searchTerm, emptyFolders, currentWorkspaceId, extractCategory]);

  return {
    searchTerm,
    setSearchTerm,
    filteredMaps,
    groupedMaps,
    visibleFolders
  };
};
// moved from hooks/sidebar to flatten sidebar hooks
