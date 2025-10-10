import { useState, useEffect, useMemo } from 'react';
import { useStableCallback } from '@shared/hooks';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen } from 'lucide-react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';
import type { ContextMenuItem } from '../components/layout/overlay/ContextMenu';
import { logger, getLastPathSegment, splitPath } from '@shared/utils';
import {
  parseWorkspacePath,
  buildChildPath,
  buildWorkspacePath,
  extractParentPaths,
  resolveWorkspaceId
} from '@shared/utils/pathOperations';

/**
 * Unified Sidebar Hook - Phase 4.1 Consolidation
 *
 * Integrates all sidebar-related functionality into a single cohesive hook:
 * - Map operations (create, rename, delete)
 * - Folder operations (create, rename, delete, collapse)
 * - Filtering and search
 * - Explorer tree management
 * - Context menu handling
 *
 * This consolidation reduces hook proliferation and improves maintainability
 * by providing a single source of truth for sidebar state and operations.
 */

interface UseSidebarOptions {
  mindMaps: MindMapData[];
  currentWorkspaceId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => void;
  onDeleteMap: (id: MapIdentifier) => void;
  onChangeCategory: (id: MapIdentifier, category: string) => void;
  onCreateFolder?: (path: string) => Promise<void> | void;
  explorerTree: ExplorerItem;
}

interface ContextMenuState {
  isVisible: boolean;
  position: { x: number; y: number };
  targetPath: string | null;
  targetType: 'folder' | 'empty' | 'map' | 'explorer-folder' | 'explorer-file' | null;
  mapData?: MindMapData | null;
}

export const useSidebar = ({
  mindMaps,
  currentWorkspaceId,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onChangeCategory,
  onCreateFolder,
  explorerTree
}: UseSidebarOptions) => {
  // ========================================
  // Folder Operations State
  // ========================================
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());

  // Clear emptyFolders when workspace changes
  useEffect(() => {
    setEmptyFolders(new Set());
  }, [currentWorkspaceId]);

  // Extract category helper (removes workspace ID prefix)
  const extractCategory = useStableCallback((fullPath: string | null): string | undefined => {
    if (!fullPath) return undefined;
    const { relativePath } = parseWorkspacePath(fullPath);
    return relativePath || undefined;
  });

  const toggleCategoryCollapse = useStableCallback((category: string) => {
    setCollapsedCategories(prev => {
      return prev.has(category)
        ? (prev.size === 1 ? new Set<string>() : (() => { const s = new Set(prev); s.delete(category); return s; })())
        : (() => { const s = new Set(prev); s.add(category); return s; })();
    });
  });

  const handleCreateFolder = useStableCallback((parentPath: string | null) => {
    const parentInfo = parentPath ? ` (${parentPath} の下)` : '';
    // eslint-disable-next-line no-alert
    const newFolderName = window.prompt(`新しいフォルダ名を入力してください${parentInfo}:`, '');
    if (newFolderName && newFolderName.trim()) {
      const { workspaceId: extractedWorkspaceId, relativePath: cleanParentPath } = parseWorkspacePath(parentPath);
      const fallbackWorkspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : null);
      const workspaceId = extractedWorkspaceId || fallbackWorkspaceId || 'local';
      const newFolderPath = buildChildPath(cleanParentPath, newFolderName.trim());

      if (onCreateFolder) {
        const fullPath = buildWorkspacePath(workspaceId, newFolderPath);
        Promise.resolve(onCreateFolder(fullPath)).then(() => {
          setEmptyFolders(prev => new Set([...prev, newFolderPath]));
          setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            newSet.delete(newFolderPath);
            return newSet;
          });
        }).catch((err) => {
          console.error('useSidebar: onCreateFolder failed:', err);
        });
      } else {
        setEmptyFolders(prev => new Set([...prev, newFolderPath]));
        setCollapsedCategories(prev => {
          const newSet = new Set(prev);
          newSet.delete(newFolderPath);
          return newSet;
        });
      }
    }
  });

  const handleDeleteFolder = useStableCallback((folderPath: string) => {
    const mapsInFolder = mindMaps.filter(map => map.category === folderPath);
    const mapsInSubfolders = mindMaps.filter(map =>
      map.category && map.category.startsWith(folderPath + '/')
    );
    const totalMaps = mapsInFolder.length + mapsInSubfolders.length;

    if (totalMaps > 0) {
      // eslint-disable-next-line no-alert
      alert(`「${folderPath}」またはその子フォルダにマップが含まれているため削除できません。先にマップを移動または削除してください。`);
      return;
    }

    // eslint-disable-next-line no-alert
    if (window.confirm(`空のフォルダ「${folderPath}」を削除しますか？`)) {
      setEmptyFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        Array.from(prev).forEach(folder => {
          if (folder.startsWith(folderPath + '/')) {
            newSet.delete(folder);
          }
        });
        return newSet;
      });

      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });

      logger.info(`空のフォルダ「${folderPath}」を削除しました`);
    }
  });

  const handleRenameFolder = useStableCallback((oldPath: string) => {
    const currentName = getLastPathSegment(oldPath) || oldPath;
    // eslint-disable-next-line no-alert
    const newName = window.prompt(`フォルダ名を変更:`, currentName);

    if (newName && newName.trim() && newName.trim() !== currentName) {
      const pathParts = splitPath(oldPath);
      pathParts[pathParts.length - 1] = newName.trim();
      const newPath = pathParts.join('/');

      const mapsToUpdate = mindMaps.filter(map =>
        map.category === oldPath || (map.category && map.category.startsWith(oldPath + '/'))
      );

      mapsToUpdate.forEach(map => {
        const updatedCategory = map.category?.replace(oldPath, newPath);
        if (updatedCategory) {
          onChangeCategory({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId }, updatedCategory);
        }
      });

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
  });

  // ========================================
  // Map Operations State
  // ========================================
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = useStableCallback((mapIdentifier: MapIdentifier, currentTitle: string) => {
    setEditingMapId(mapIdentifier.mapId);
    setEditingTitle(currentTitle);
  });

  const handleCancelRename = useStableCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  });

  const handleCreateMap = useStableCallback((parentPath: string | null) => {
    const category = extractCategory(parentPath);
    const displayPath = category || 'ルート';
    const parentInfo = category ? ` (${displayPath} 内)` : '';

    // eslint-disable-next-line no-alert
    const mapName = window.prompt(`新しいマインドマップの名前を入力してください${parentInfo}:`, '新しいマインドマップ');
    if (mapName && mapName.trim()) {
      const fallbackWorkspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : null);
      const workspaceId = resolveWorkspaceId(parentPath, fallbackWorkspaceId, 'local');

      onCreateMap(mapName.trim(), workspaceId, category);

      if (parentPath) {
        setEmptyFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
      }
    }
  });

  // ========================================
  // Filtering and Search State
  // ========================================
  const [searchTerm, setSearchTerm] = useState('');

  const { filteredMaps, groupedMaps, visibleFolders } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    const workspaceMaps = currentWorkspaceId
      ? mindMaps.filter(map => map.mapIdentifier.workspaceId === currentWorkspaceId)
      : mindMaps;

    const filtered = workspaceMaps.filter(map => {
      const titleMatch = map.title.toLowerCase().includes(searchLower);

      let categoryMatch = false;
      if (map.category) {
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

    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        return a.title.localeCompare(b.title, 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
      });
    });

    let foldersToShow = new Set<string>();

    if (searchTerm) {
      Object.keys(grouped).forEach(category => {
        foldersToShow.add(category);
        extractParentPaths(category).forEach(parentPath => foldersToShow.add(parentPath));
      });

      Array.from(emptyFolders).forEach(folder => {
        const cleanFolderPath = extractCategory(folder) || folder;
        if (cleanFolderPath && cleanFolderPath.toLowerCase().includes(searchLower)) {
          foldersToShow.add(folder);
          extractParentPaths(folder).forEach(parentPath => foldersToShow.add(parentPath));
        }
      });
    } else {
      foldersToShow = new Set([...Object.keys(grouped), ...Array.from(emptyFolders)]);

      const addAncestors = (path: string) => {
        extractParentPaths(path).forEach(parentPath => foldersToShow.add(parentPath));
      };
      Object.keys(grouped).forEach(addAncestors);
      Array.from(emptyFolders).forEach(addAncestors);
    }

    const sortedFolders = Array.from(foldersToShow).sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');

      const minLength = Math.min(partsA.length, partsB.length);
      for (let i = 0; i < minLength; i++) {
        const comparison = partsA[i].localeCompare(partsB[i], 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
        if (comparison !== 0) return comparison;
      }

      return partsA.length - partsB.length;
    });

    return {
      filteredMaps: filtered,
      groupedMaps: grouped,
      visibleFolders: sortedFolders
    };
  }, [mindMaps, searchTerm, emptyFolders, currentWorkspaceId, extractCategory]);

  // ========================================
  // Explorer Tree State
  // ========================================
  const [explorerCollapsed, setExplorerCollapsed] = useState<Record<string, boolean>>({});

  const enhancedExplorerTree = useMemo(() => {
    if (!explorerTree) return null;
    if (emptyFolders.size === 0 || !currentWorkspaceId) return explorerTree;

    const clonedTree: ExplorerItem = JSON.parse(JSON.stringify(explorerTree));

    const workspaceNode = clonedTree.children?.find(
      child => child.path === `/${currentWorkspaceId}` || child.path === currentWorkspaceId
    );

    if (!workspaceNode) {
      console.warn('useSidebar: Workspace node not found in tree');
      return clonedTree;
    }

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

  // ========================================
  // Context Menu State and Logic
  // ========================================
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    targetPath: null,
    targetType: null,
    mapData: null
  });

  const closeContextMenu = useStableCallback(() => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      targetPath: null,
      targetType: null,
      mapData: null
    });
  });

  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const { targetPath, targetType, mapData } = contextMenu;

    if (targetType === 'folder') {
      const mapsInFolder = targetPath ? mindMaps.filter(map => map.category === targetPath) : [];
      const mapsInSubfolders = targetPath ? mindMaps.filter(map =>
        map.category && map.category.startsWith(targetPath + '/')
      ) : [];

      const totalMaps = mapsInFolder.length + mapsInSubfolders.length;
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
          icon: <Workflow size={14} />,
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

  // ========================================
  // Return consolidated API
  // ========================================
  return {
    // Folder operations
    emptyFolders,
    setEmptyFolders,
    collapsedCategories,
    extractCategory,
    toggleCategoryCollapse,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder,

    // Map operations
    editingMapId,
    editingTitle,
    setEditingTitle,
    handleStartRename,
    handleCancelRename,
    handleCreateMap,

    // Filtering
    searchTerm,
    setSearchTerm,
    filteredMaps,
    groupedMaps,
    visibleFolders,

    // Explorer tree
    enhancedExplorerTree,
    explorerCollapsed,
    setExplorerCollapsed,

    // Context menu
    contextMenu,
    contextMenuItems,
    setContextMenu,
    closeContextMenu
  };
};
