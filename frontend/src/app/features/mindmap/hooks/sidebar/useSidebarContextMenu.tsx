import { useState, useCallback, useMemo } from 'react';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen } from 'lucide-react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ContextMenuItem } from '../../components/layout/ContextMenu';

interface UseSidebarContextMenuOptions {
  mindMaps: MindMapData[];
  collapsedCategories: Set<string>;
  onSelectMap: (id: MapIdentifier) => void;
  onDeleteMap: (id: MapIdentifier) => void;
  handleCreateMap: (parentPath: string | null) => void;
  handleCreateFolder: (parentPath: string | null) => void;
  handleRenameFolder: (path: string) => void;
  handleDeleteFolder: (path: string) => void;
  handleStartRename: (mapIdentifier: MapIdentifier, currentTitle: string) => void;
  toggleCategoryCollapse: (category: string) => void;
  extractCategory: (fullPath: string | null) => string | undefined;
}

interface ContextMenuState {
  isVisible: boolean;
  position: { x: number; y: number };
  targetPath: string | null;
  targetType: 'folder' | 'empty' | 'map' | 'explorer-folder' | 'explorer-file' | null;
  mapData?: MindMapData | null;
}

export const useSidebarContextMenu = ({
  mindMaps,
  collapsedCategories,
  onSelectMap,
  onDeleteMap,
  handleCreateMap,
  handleCreateFolder,
  handleRenameFolder,
  handleDeleteFolder,
  handleStartRename,
  toggleCategoryCollapse,
  extractCategory
}: UseSidebarContextMenuOptions) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    targetPath: null,
    targetType: null,
    mapData: null
  });

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      targetPath: null,
      targetType: null,
      mapData: null
    });
  }, []);

  // コンテキストメニューのアイテムを生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const { targetPath, targetType, mapData } = contextMenu;

    if (targetType === 'folder') {
      const mapsInFolder = targetPath ? mindMaps.filter(map => map.category === targetPath) : [];
      const mapsInSubfolders = targetPath ? mindMaps.filter(map =>
        map.category && map.category.startsWith(targetPath + '/')
      ) : [];

      const totalMaps = mapsInFolder.length + mapsInSubfolders.length;

      // フォルダ削除可能かどうかの判定（空フォルダのみ削除可能）
      const canDelete = totalMaps === 0;

      return [
        {
          label: 'マップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(targetPath)
        },
        {
          label: 'フォルダを作成',
          icon: <Folder size={14} />,
          onClick: () => handleCreateFolder(targetPath)
        },
        { separator: true },
        {
          label: 'フォルダを展開',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            if (targetPath) {
              toggleCategoryCollapse(targetPath);
            }
          }
        },
        { separator: true },
        {
          label: 'フォルダ名を変更',
          icon: <Edit3 size={14} />,
          onClick: () => {
            if (targetPath) {
              handleRenameFolder(targetPath);
            }
          }
        },
        {
          label: 'フォルダを削除',
          icon: <Trash2 size={14} />,
          disabled: !canDelete,
          onClick: () => {
            if (targetPath) {
              handleDeleteFolder(targetPath);
            }
          }
        }
      ];
    } else if (targetType === 'map' && mapData) {
      const mapCategory = mapData.category || '';
      return [
        {
          label: '同じフォルダにマップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(mapCategory)
        },
        { separator: true },
        {
          label: 'マップを開く',
          icon: <BookOpen size={14} />,
          onClick: () => onSelectMap(mapData.mapIdentifier)
        },
        {
          label: '名前を変更',
          icon: <Edit3 size={14} />,
          onClick: () => handleStartRename(mapData.mapIdentifier, mapData.title)
        },
        {
          label: 'マップを削除',
          icon: <Trash2 size={14} />,
          onClick: () => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`「${mapData.title}」を削除しますか？`)) {
              onDeleteMap(mapData.mapIdentifier);
            }
          }
        }
      ];
    } else if (targetType === 'empty') {
      return [
        {
          label: 'マップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(null)
        },
        {
          label: 'フォルダを作成',
          icon: <Folder size={14} />,
          onClick: () => handleCreateFolder(null)
        }
      ];
    } else if (targetType === 'explorer-folder') {
      const isRoot = targetPath === '';
      const isCollapsed = !!(targetPath && collapsedCategories.has(targetPath));
      const baseItems: ContextMenuItem[] = [
        {
          label: 'マップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(targetPath)
        },
        {
          label: 'フォルダを作成',
          icon: <Folder size={14} />,
          onClick: () => handleCreateFolder(targetPath)
        }
      ];
      const mutatingItems: ContextMenuItem[] = isRoot ? [] : [
        { separator: true },
        {
          label: '名前を変更',
          icon: <Edit3 size={14} />,
          onClick: () => {
            if (!targetPath) return;
            const currentName = targetPath.split('/').pop() || targetPath;
            const newName = window.prompt('新しいフォルダ名', currentName);
            if (newName && newName.trim()) {
              const parent = targetPath.split('/').slice(0, -1).join('/');
              const newPath = parent ? `${parent}/${newName.trim()}` : newName.trim();
              window.dispatchEvent(new CustomEvent('mindoodle:renameItem', { detail: { oldPath: targetPath, newName: newName.trim(), newPath } }));
            }
          }
        },
        {
          label: '削除',
          icon: <Trash2 size={14} />,
          onClick: () => {
            if (targetPath) {
              // Display name should exclude workspace ID for user-friendly message
              const displayPath = extractCategory(targetPath) || targetPath;
              if (window.confirm(`フォルダ「${displayPath}」を削除しますか？（中身も削除されます）`)) {
                window.dispatchEvent(new CustomEvent('mindoodle:deleteItem', { detail: { path: targetPath } }));
              }
            }
          }
        }
      ];
      const rest: ContextMenuItem[] = [
        { separator: true },
        {
          label: isCollapsed ? '展開' : '折りたたみ',
          icon: isCollapsed ? <FolderOpen size={14} /> : <Folder size={14} />,
          onClick: () => targetPath && toggleCategoryCollapse(targetPath)
        },
        { separator: true },
        {
          label: '再読み込み',
          icon: <Workflow size={14} />, // generic
          onClick: () => window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'))
        }
      ];
      return [...baseItems, ...mutatingItems, ...rest];
    } else if (targetType === 'explorer-file') {
      return [
        {
          label: '開く',
          icon: <BookOpen size={14} />,
          onClick: () => {
            if (targetPath && /\.md$/i.test(targetPath)) {
              const wsMatch = targetPath.match(/^\/((ws_[^/]+))\//);
              const workspaceId = wsMatch ? wsMatch[1] : undefined;
              const mapId = targetPath.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '');
              window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail: { mapId, workspaceId } }));
            }
          }
        },
        {
          label: '名前を変更',
          icon: <Edit3 size={14} />,
          onClick: () => {
            if (!targetPath) return;
            const fileName = targetPath.split('/').pop() || targetPath;
            const baseName = fileName.replace(/\.md$/i, '');
            const newName = window.prompt('新しいファイル名（拡張子なし）', baseName);
            if (newName && newName.trim()) {
              const parent = targetPath.split('/').slice(0, -1).join('/');
              const newPath = `${parent}/${newName.trim()}.md`;
              window.dispatchEvent(new CustomEvent('mindoodle:renameItem', { detail: { oldPath: targetPath, newName: newName.trim(), newPath } }));
            }
          }
        },
        {
          label: '削除',
          icon: <Trash2 size={14} />,
          onClick: () => {
            if (targetPath) {
              const fileName = targetPath.split('/').pop() || targetPath;
              if (window.confirm(`ファイル「${fileName}」を削除しますか？`)) {
                window.dispatchEvent(new CustomEvent('mindoodle:deleteItem', { detail: { path: targetPath } }));
              }
            }
          }
        }
      ];
    }

    return [];
  }, [
    contextMenu,
    mindMaps,
    collapsedCategories,
    handleCreateMap,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleStartRename,
    onSelectMap,
    onDeleteMap,
    toggleCategoryCollapse,
    extractCategory
  ]);

  return {
    contextMenu,
    contextMenuItems,
    setContextMenu,
    closeContextMenu
  };
};
