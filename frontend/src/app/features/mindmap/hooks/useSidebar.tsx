import { useState, useEffect, useMemo } from 'react';
import { useNotification, useStableCallback } from '@shared/hooks';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen } from 'lucide-react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';
import type { ContextMenuItem } from '../components/layout/overlay/ContextMenu';
import { logger, getLastPathSegment, splitPath } from '@shared/utils';
import { generateUniqueFileName } from '../utils/fileNameUtils';
import {
  parseWorkspacePath,
  buildChildPath,
  buildWorkspacePath,
  extractParentPaths,
  normalizePathSeparators,
  resolveWorkspaceId
} from '@shared/utils/pathOperations';

const DEFAULT_MAP_NAME = '新しいマップ';

interface UseSidebarOptions {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  currentWorkspaceId: string | null;
  workspaces?: Array<{ id: string; name: string }>;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => Promise<unknown> | void;
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

interface FocusedExplorerState {
  path: string;
  type: 'explorer-folder' | 'explorer-file';
}

interface CreateMapDialogState {
  isOpen: boolean;
  workspaceId: string | null;
  initialPath: string;
  initialName: string;
}

export const useSidebar = ({
  mindMaps,
  currentMapId,
  currentWorkspaceId,
  workspaces = [],
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onChangeCategory,
  onCreateFolder,
  explorerTree
}: UseSidebarOptions) => {
  const { showNotification } = useNotification();
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [focusedExplorer, setFocusedExplorer] = useState<FocusedExplorerState | null>(null);
  const [createMapDialog, setCreateMapDialog] = useState<CreateMapDialogState>({
    isOpen: false,
    workspaceId: null,
    initialPath: '',
    initialName: DEFAULT_MAP_NAME
  });

  useEffect(() => {
    setEmptyFolders(new Set());
  }, [currentWorkspaceId]);

  const extractCategory = useStableCallback((fullPath: string | null): string | undefined => {
    if (!fullPath) return undefined;
    const { workspaceId, relativePath } = parseWorkspacePath(fullPath);
    if (workspaceId) {
      return relativePath || undefined;
    }
    return normalizePathSeparators(fullPath) || undefined;
  });

  const toRelativePath = useStableCallback((path: string | null): string => {
    if (!path) return '';
    const { workspaceId, relativePath } = parseWorkspacePath(path);
    if (workspaceId) {
      return normalizePathSeparators(relativePath || '');
    }
    return normalizePathSeparators(path);
  });

  const getParentPath = useStableCallback((path: string): string => {
    const normalizedPath = normalizePathSeparators(path);
    if (!normalizedPath) return '';
    const parts = normalizedPath.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  });

  const getCurrentMapBasePath = useStableCallback((): string => {
    if (!currentMapId) return '';
    return getParentPath(currentMapId);
  });

  const resolveCreateMapDefaults = useStableCallback((
    sourcePath: string | null,
    sourceType: ContextMenuState['targetType'] | 'button' = 'button'
  ): { workspaceId: string | null; path: string } => {
    const fallbackWorkspaceId = currentWorkspaceId
      || workspaces[0]?.id
      || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : null);

    let effectivePath = sourcePath;
    let effectiveType = sourceType;

    if (!effectivePath && focusedExplorer) {
      effectivePath = focusedExplorer.path;
      effectiveType = focusedExplorer.type;
    }

    const workspaceId = effectivePath
      ? resolveWorkspaceId(effectivePath, fallbackWorkspaceId, '')
      : fallbackWorkspaceId;

    if (!effectivePath) {
      return {
        workspaceId,
        path: getCurrentMapBasePath()
      };
    }

    const relativePath = toRelativePath(effectivePath);
    return {
      workspaceId,
      path: effectiveType === 'explorer-file' ? getParentPath(relativePath) : relativePath
    };
  });

  const closeCreateMapDialog = useStableCallback(() => {
    setCreateMapDialog({
      isOpen: false,
      workspaceId: null,
      initialPath: '',
      initialName: DEFAULT_MAP_NAME
    });
  });

  const toggleCategoryCollapse = useStableCallback((category: string) => {
    setCollapsedCategories(prev => {
      if (prev.has(category)) {
        if (prev.size === 1) {
          return new Set<string>();
        }
        const next = new Set(prev);
        next.delete(category);
        return next;
      }
      const next = new Set(prev);
      next.add(category);
      return next;
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
            const next = new Set(prev);
            next.delete(newFolderPath);
            return next;
          });
        }).catch((err) => {
          logger.error('useSidebar: onCreateFolder failed:', err);
        });
      } else {
        setEmptyFolders(prev => new Set([...prev, newFolderPath]));
        setCollapsedCategories(prev => {
          const next = new Set(prev);
          next.delete(newFolderPath);
          return next;
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
      alert(`「${folderPath}」またはその子フォルダにマップが含まれているため削除できません。先にマップを移動または削除してください。`);
      return;
    }

    if (window.confirm(`空のフォルダ「${folderPath}」を削除しますか？`)) {
      setEmptyFolders(prev => {
        const next = new Set(prev);
        Array.from(prev).forEach(folder => {
          if (folder === folderPath || folder.startsWith(folderPath + '/')) {
            next.delete(folder);
          }
        });
        return next;
      });

      setCollapsedCategories(prev => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });

      logger.info(`空のフォルダ「${folderPath}」を削除しました`);
    }
  });

  const handleRenameFolder = useStableCallback((oldPath: string) => {
    const currentName = getLastPathSegment(oldPath) || oldPath;
    const newName = window.prompt('フォルダ名を変更:', currentName);

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
        const next = new Set<string>();
        Array.from(prev).forEach(folder => {
          if (folder === oldPath) {
            next.add(newPath);
          } else if (folder.startsWith(oldPath + '/')) {
            next.add(folder.replace(oldPath, newPath));
          } else {
            next.add(folder);
          }
        });
        return next;
      });

      setCollapsedCategories(prev => {
        const next = new Set<string>();
        Array.from(prev).forEach(category => {
          if (category === oldPath) {
            next.add(newPath);
          } else if (category.startsWith(oldPath + '/')) {
            next.add(category.replace(oldPath, newPath));
          } else {
            next.add(category);
          }
        });
        return next;
      });

      logger.info(`フォルダ名を「${oldPath}」から「${newPath}」に変更しました`);
    }
  });

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

  const handleFocusExplorerPath = useStableCallback((path: string, type: 'explorer-folder' | 'explorer-file') => {
    setFocusedExplorer({ path, type });
  });

  const handleCreateMap = useStableCallback((
    parentPath: string | null,
    sourceType: ContextMenuState['targetType'] | 'button' = 'button'
  ) => {
    const { workspaceId, path } = resolveCreateMapDefaults(parentPath, sourceType);
    if (!workspaceId && workspaces.length === 0) {
      showNotification('warning', 'マップを作成するワークスペースを選択してください');
      return;
    }

    const initialWorkspaceId = workspaceId || null;

    const siblingNames = new Set(
      mindMaps
        .filter(map =>
          map.mapIdentifier.workspaceId === initialWorkspaceId &&
          (map.category || '') === path
        )
        .map(map => map.mapIdentifier.mapId.split('/').pop() || map.title)
    );

    setCreateMapDialog({
      isOpen: true,
      workspaceId: initialWorkspaceId,
      initialPath: path,
      initialName: generateUniqueFileName(DEFAULT_MAP_NAME, siblingNames)
    });
  });

  const handleSubmitCreateMap = useStableCallback(async ({
    name,
    path,
    workspaceId
  }: {
    name: string;
    path: string;
    workspaceId: string;
  }) => {
    try {
      await Promise.resolve(onCreateMap(name.trim(), workspaceId, path || undefined));

      if (path) {
        setEmptyFolders(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }

      closeCreateMapDialog();
    } catch (error) {
      logger.error('useSidebar: failed to create map', error);
      throw error;
    }
  });

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
      grouped[category].sort((a, b) => a.title.localeCompare(b.title, 'ja', {
        numeric: true,
        sensitivity: 'base'
      }));
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
      for (let index = 0; index < minLength; index++) {
        const comparison = partsA[index].localeCompare(partsB[index], 'ja', {
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

  const [explorerCollapsed, setExplorerCollapsed] = useState<Record<string, boolean>>({});

  const enhancedExplorerTree = useMemo(() => {
    if (!explorerTree) return null;
    if (emptyFolders.size === 0 || !currentWorkspaceId) return explorerTree;

    const clonedTree: ExplorerItem = JSON.parse(JSON.stringify(explorerTree));

    const workspaceNode = clonedTree.children?.find(
      child => child.path === `/${currentWorkspaceId}` || child.path === currentWorkspaceId
    );

    if (!workspaceNode) {
      logger.warn('useSidebar: Workspace node not found in tree');
      return clonedTree;
    }

    emptyFolders.forEach(folderPath => {
      const parts = folderPath.split('/').filter(p => p.trim());
      let current = workspaceNode;

      parts.forEach(part => {
        if (!current.children) current.children = [];

        let folder: ExplorerItem | undefined;
        for (const child of current.children) {
          if (child.type === 'folder' && child.name === part) {
            folder = child;
            break;
          }
        }

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
          onClick: () => handleCreateMap(targetPath, 'folder')
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
    }

    if (targetType === 'map' && mapData) {
      const mapCategory = mapData.category || '';
      return [
        {
          label: '同じフォルダにマップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(mapCategory, 'map')
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
            if (window.confirm(`「${mapData.title}」を削除しますか？`)) {
              onDeleteMap(mapData.mapIdentifier);
            }
          }
        }
      ];
    }

    if (targetType === 'empty') {
      return [
        {
          label: 'マップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(null, 'empty')
        },
        {
          label: 'フォルダを作成',
          icon: <Folder size={14} />,
          onClick: () => handleCreateFolder(null)
        }
      ];
    }

    if (targetType === 'explorer-folder') {
      const isRoot = targetPath === '';
      const isCollapsed = !!(targetPath && collapsedCategories.has(targetPath));
      const baseItems: ContextMenuItem[] = [
        {
          label: 'マップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(targetPath, 'explorer-folder')
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
              window.dispatchEvent(new CustomEvent('mindoodle:renameItem', {
                detail: { oldPath: targetPath, newName: newName.trim(), newPath }
              }));
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
    }

    if (targetType === 'explorer-file') {
      return [
        {
          label: '同じフォルダにマップを作成',
          icon: <Workflow size={14} />,
          onClick: () => handleCreateMap(targetPath, 'explorer-file')
        },
        { separator: true },
        {
          label: '開く',
          icon: <BookOpen size={14} />,
          onClick: () => {
            if (!targetPath) return;
            if (/\.md$/i.test(targetPath)) {
              const wsRe = /^\/((ws_[^/]+|cloud))\//;
              const wsMatch = wsRe.exec(targetPath);
              const workspaceId = wsMatch ? wsMatch[1] : undefined;
              const mapId = targetPath.replace(/^\/(ws_[^/]+|cloud)\//, '').replace(/\.md$/i, '');
              window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail: { mapId, workspaceId } }));
              return;
            }
            if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(targetPath)) {
              window.dispatchEvent(new CustomEvent('mindoodle:openImageFile', { detail: { path: targetPath } }));
            }
          }
        },
        {
          label: '名前を変更',
          icon: <Edit3 size={14} />,
          onClick: () => {
            if (!targetPath) return;
            const fileName = targetPath.split('/').pop() || targetPath;
            const isMarkdownFile = /\.md$/i.test(fileName);
            const extMatch = /(\.[^./\\]+)$/.exec(fileName);
            const originalExt = extMatch ? extMatch[1] : '';
            let baseName = fileName;
            if (isMarkdownFile) {
              baseName = fileName.replace(/\.md$/i, '');
            } else if (originalExt) {
              baseName = fileName.slice(0, -originalExt.length);
            }
            const promptLabel = isMarkdownFile ? '新しいファイル名（拡張子なし）' : '新しいファイル名';
            const newNameInput = window.prompt(promptLabel, baseName);
            if (newNameInput && newNameInput.trim()) {
              let normalizedName = newNameInput.trim();
              if (isMarkdownFile) {
                normalizedName = normalizedName.replace(/\.md$/i, '');
              } else if (originalExt && !/\.[^./\\]+$/.test(normalizedName)) {
                normalizedName = `${normalizedName}${originalExt}`;
              }
              const parent = targetPath.split('/').slice(0, -1).join('/');
              const newPath = `${parent}/${normalizedName}`;
              window.dispatchEvent(new CustomEvent('mindoodle:renameItem', {
                detail: { oldPath: targetPath, newName: normalizedName, newPath }
              }));
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

  const createMapExistingMapIdsByWorkspace = mindMaps.reduce<Record<string, string[]>>((acc, map) => {
    const workspaceId = map.mapIdentifier.workspaceId;
    if (!acc[workspaceId]) {
      acc[workspaceId] = [];
    }
    acc[workspaceId].push(map.mapIdentifier.mapId);
    return acc;
  }, {});
  const createMapFolderSuggestionsByWorkspace = useMemo(() => {
    const suggestions = new Map<string, Set<string>>();

    const addSuggestion = (workspaceId: string | null, folderPath: string | null | undefined) => {
      if (!workspaceId || !folderPath) {
        return;
      }

      const normalizedPath = normalizePathSeparators(folderPath);
      if (!normalizedPath) {
        return;
      }

      let bucket = suggestions.get(workspaceId);
      if (!bucket) {
        bucket = new Set<string>();
        suggestions.set(workspaceId, bucket);
      }

      bucket.add(normalizedPath);
      extractParentPaths(normalizedPath).forEach(parentPath => {
        const normalizedParentPath = normalizePathSeparators(parentPath);
        if (normalizedParentPath) {
          bucket?.add(normalizedParentPath);
        }
      });
    };

    mindMaps.forEach(map => {
      addSuggestion(map.mapIdentifier.workspaceId, map.category);
    });

    const tree = enhancedExplorerTree || explorerTree;
    const visit = (item: ExplorerItem) => {
      if (item.type !== 'folder') {
        return;
      }

      const { workspaceId, relativePath } = parseWorkspacePath(item.path);
      addSuggestion(workspaceId, relativePath);

      if (Array.isArray(item.children)) {
        item.children.forEach(visit);
      }
    };

    visit(tree);

    return Array.from(suggestions.entries()).reduce<Record<string, string[]>>((acc, [workspaceId, paths]) => {
      acc[workspaceId] = Array.from(paths).sort((a, b) => {
        const depthDiff = a.split('/').length - b.split('/').length;
        if (depthDiff !== 0) {
          return depthDiff;
        }
        return a.localeCompare(b, 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
      });
      return acc;
    }, {});
  }, [mindMaps, enhancedExplorerTree, explorerTree]);
  const currentCreateMapDefaults = resolveCreateMapDefaults(null, 'button');

  return {
    emptyFolders,
    setEmptyFolders,
    collapsedCategories,
    extractCategory,
    toggleCategoryCollapse,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder,

    editingMapId,
    editingTitle,
    setEditingTitle,
    handleStartRename,
    handleCancelRename,
    handleCreateMap,
    handleSubmitCreateMap,
    closeCreateMapDialog,
    createMapDialog,
    createMapExistingMapIdsByWorkspace,
    createMapFolderSuggestionsByWorkspace,
    handleFocusExplorerPath,
    canCreateMap: !!currentCreateMapDefaults.workspaceId || workspaces.length > 0,

    searchTerm,
    setSearchTerm,
    filteredMaps,
    groupedMaps,
    visibleFolders,

    enhancedExplorerTree,
    explorerCollapsed,
    setExplorerCollapsed,

    contextMenu,
    contextMenuItems,
    setContextMenu,
    closeContextMenu
  };
};
