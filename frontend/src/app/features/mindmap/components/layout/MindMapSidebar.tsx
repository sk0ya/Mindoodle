import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen } from 'lucide-react';
import SidebarHeader from './SidebarHeader';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from '../../styles/SidebarStyles';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { ExplorerNodeView } from './ExplorerNodeView';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { createChildFolderPath } from '@shared/utils';
import { logger } from '@shared/utils';
import { getLastPathSegment, splitPath } from '@shared/utils';
import type { ExplorerItem } from '@core/types';

interface MindMapSidebarProps {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  currentWorkspaceId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => void;
  onDeleteMap: (id: MapIdentifier) => void;
  onRenameMap: (id: MapIdentifier, newTitle: string) => void;
  onChangeCategory: (id: MapIdentifier, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  onSwitchWorkspace?: (workspaceId: string | null) => void;
  explorerTree: ExplorerItem;
  onCreateFolder?: (path: string) => Promise<void> | void;
}

const MindMapSidebar: React.FC<MindMapSidebarProps> = ({
  mindMaps,
  currentMapId,
  currentWorkspaceId,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onChangeCategory,
  isCollapsed,
  onToggleCollapse,
  workspaces = [],
  onAddWorkspace,
  onRemoveWorkspace,
  onSwitchWorkspace,
  explorerTree,
  onCreateFolder
}) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  // Explorer collapsed state mapping: path -> collapsed?
  const [explorerCollapsed, setExplorerCollapsed] = useState<Record<string, boolean>>({});

  // Clear emptyFolders when workspace changes
  useEffect(() => {
    setEmptyFolders(new Set());
  }, [currentWorkspaceId]);


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

  // Initialize default collapsed state: collapse all folders except workspace roots
  React.useEffect(() => {
    const tree = enhancedExplorerTree;
    if (!tree) return;

    const isWorkspaceRoot = (p: string): boolean => /^\/?(?:ws_[^/]+|cloud)\/?$/.test(p || '');
    const visit = (item: ExplorerItem, acc: Record<string, boolean>) => {
      if (!item) return;
      if (item.type === 'folder') {
        const path = item.path || '';
        const defaultCollapsed = isWorkspaceRoot(path) ? false : true;
        if (acc[path] === undefined) acc[path] = defaultCollapsed;
        if (Array.isArray(item.children)) {
          item.children.forEach((ch) => visit(ch, acc));
        }
      }
    };

    setExplorerCollapsed((prev) => {
      const next = { ...prev };
      visit(tree, next);
      return next;
    });
  }, [explorerTree]);
  
  // Drag & Drop フック
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    targetPath: string | null;
    targetType: 'folder' | 'empty' | 'map' | 'explorer-folder' | 'explorer-file' | null;
    mapData?: MindMapData | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    targetPath: null,
    targetType: null,
    mapData: null
  });

  // Keep explorer selection in sync with current map (when switching via keyboard etc.)
  // Helper to check if a path exists in explorer tree
  const explorerHasPath = React.useCallback((tree: any, target: string): boolean => {
    if (!tree) return false;
    if (tree.path === target) return true;
    if (Array.isArray(tree.children)) {
      for (const child of tree.children) {
        if (explorerHasPath(child, target)) return true;
      }
    }
    return false;
  }, []);

  // Note: Do not synthesize paths for selection; highlighting is handled by mapIdentifier match in ExplorerView

  // イベントハンドラー
  const handleStartRename = useCallback((mapIdentifier: MapIdentifier, currentTitle: string) => {
    setEditingMapId(mapIdentifier.mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  }, []);

  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      return prev.has(category)
        ? (prev.size === 1 ? new Set<string>() : (() => { const s = new Set(prev); s.delete(category); return s; })())
        : (() => { const s = new Set(prev); s.add(category); return s; })();
    });
  }, []);




  // フォルダ選択ハンドラー

  // コンテキストメニューハンドラー

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      targetPath: null,
      targetType: null,
      mapData: null
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

  // 旧: 追加/展開系ボタンのハンドラーは削除しました

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
  }, [mindMaps, setEmptyFolders]);

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
    }
  }, [mindMaps, onChangeCategory, setEmptyFolders]);

  // フィルタリングとグループ化（階層フォルダ対応）
  const { filteredMaps } = useMemo(() => {
    // Filter maps by current workspace
    const workspaceMaps = currentWorkspaceId
      ? mindMaps.filter(m => m.mapIdentifier?.workspaceId === currentWorkspaceId)
      : mindMaps;

    const searchLower = searchTerm.toLowerCase();

    // マップのタイトルまたはカテゴリ名で検索（workspaceフォルダは除外）
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
  }, [mindMaps, searchTerm, emptyFolders, currentWorkspaceId]);

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
            const currentName = targetPath.split('/').pop() || targetPath;
            const base = currentName.replace(/\.md$/i, '');
            const newName = window.prompt('新しいファイル名', base);
            if (newName && newName.trim()) {
              window.dispatchEvent(new CustomEvent('mindoodle:renameItem', { detail: { oldPath: targetPath, newName: newName.trim() } }));
            }
          }
        },
        {
          label: '削除',
          icon: <Trash2 size={14} />,
          onClick: () => {
            if (targetPath) {
              // Display only filename for user-friendly message
              const fileName = targetPath.split('/').pop() || targetPath;
              if (window.confirm(`ファイル「${fileName}」を削除しますか？`)) {
                window.dispatchEvent(new CustomEvent('mindoodle:deleteItem', { detail: { path: targetPath } }));
              }
            }
          }
        },
        { separator: true },
        {
          label: '再読み込み',
          icon: <Workflow size={14} />,
          onClick: () => window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'))
        }
      ];
    }
    
    return [];
  }, [contextMenu, handleCreateMap, handleCreateFolder, toggleCategoryCollapse, onSelectMap, onDeleteMap, handleStartRename, handleRenameFolder, handleDeleteFolder, mindMaps]);

  // 折りたたみ状態の場合
  if (isCollapsed) {
    return (
      <>
        <SidebarCollapsed 
          onToggleCollapse={onToggleCollapse}
        />
        <SidebarStyles />
      </>
    );
  }

  // 展開状態
  return (
    <div className="mindmap-sidebar">
      <div className="workspaces-header" style={{ padding: '8px 8px 4px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>workspaces</div>
          <div>
            <button className="maps-action-button" onClick={() => onAddWorkspace && onAddWorkspace()} title="Add workspace">＋</button>
          </div>
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {workspaces && workspaces.length > 0 ? (
            workspaces.map((ws) => (
              <span key={ws.id}
                className={`workspace-chip ${ws.id === currentWorkspaceId ? 'active' : ''}`}
                onClick={() => onSwitchWorkspace && onSwitchWorkspace(ws.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 6px',
                  border: ws.id === currentWorkspaceId ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: 'pointer',
                  backgroundColor: ws.id === currentWorkspaceId ? 'rgba(0, 122, 204, 0.1)' : 'transparent'
                }}>
                <span>{ws.name}</span>
                {/* Cloud workspaceはxボタンを表示しない */}
                {onRemoveWorkspace && ws.id !== 'cloud' && <button onClick={(e) => {
                  e.stopPropagation();
                  onRemoveWorkspace(ws.id);
                }} style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}>×</button>}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No workspace. Click ＋ to add.</span>
          )}
        </div>
      </div>
      <SidebarHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleCollapse={onToggleCollapse}
      />
      {enhancedExplorerTree && (enhancedExplorerTree.children?.length ?? 0) > 0 ? (
        <div className="maps-content-wrapper">
          <ExplorerView
            tree={enhancedExplorerTree}
            searchTerm={searchTerm}
            collapsed={explorerCollapsed}
            onTogglePath={(path: string) => setExplorerCollapsed(prev => ({ ...prev, [path]: !prev[path] }))}
            currentMapId={currentMapId}
            currentWorkspaceId={currentWorkspaceId}
            editingMapId={editingMapId}
            editingTitle={editingTitle}
            onCancelRename={handleCancelRename}
            onEditingTitleChange={setEditingTitle}
            onContextMenu={(e, path, type) => {
              e.preventDefault();
              setContextMenu({
                isVisible: true,
                position: { x: e.clientX, y: e.clientY },
                targetPath: path,
                targetType: type,
                mapData: null
              });
            }}
          />
        </div>
      ) : filteredMaps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Workflow size={32} /></div>
          <div className="empty-title">
            {mindMaps.length === 0 ? 'このワークスペースにはマインドマップがありません' : '検索結果が見つかりません'}
          </div>
          <div className="empty-description">
            {mindMaps.length === 0 
              ? '「＋」ボタンからローカルフォルダをワークスペースとして追加し、マインドマップやフォルダを作成できます。' 
              : '検索条件を調整して再度お試しください。'
            }
          </div>
        </div>
      ) : (
        <div>No content available</div>
      )}

      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />

      <SidebarStyles />
      <style>{`
        .workspace-chip button:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
};

const ExplorerView: React.FC<{
  tree: ExplorerItem,
  searchTerm?: string,
  collapsed?: Record<string, boolean>,
  onTogglePath?: (path: string) => void,
  onContextMenu?: (e: React.MouseEvent, path: string, type: 'explorer-folder' | 'explorer-file') => void,
  currentMapId?: string | null,
  currentWorkspaceId?: string | null,
  editingMapId?: string | null,
  editingTitle?: string,
  onCancelRename?: () => void,
  onEditingTitleChange?: (title: string) => void
}> = ({ tree, searchTerm = '', collapsed = {}, onTogglePath, onContextMenu, currentMapId = null, currentWorkspaceId = null, editingMapId = null, editingTitle = '', onCancelRename, onEditingTitleChange }) => {
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

export default memo(MindMapSidebar);
