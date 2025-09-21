import React, { useState, useCallback, useMemo, memo } from 'react';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import SidebarHeader from './SidebarHeader';
import CategoryGroup from './CategoryGroup';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from './SidebarStyles';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { createChildFolderPath } from '../../../../shared/utils/folderUtils';
import { logger } from '../../../../shared/utils/logger';
import { useDragAndDrop } from '../../../../shared/hooks/useDragAndDrop';
import { highlightSearchTerm } from '../../../../shared/utils/highlightUtils';
import type { ExplorerItem } from '../../../../core/storage/types';

interface NodeViewProps {
  item: ExplorerItem;
  searchTerm?: string;
  collapsed?: Record<string, boolean>;
  onTogglePath?: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, path: string, type: 'explorer-folder' | 'explorer-file') => void;
  currentMapId?: string | null;
  currentWorkspaceId?: string | null;
  dragOverPath?: string | null;
  setDragOverPath?: (path: string | null) => void;
  editingMapId?: string | null;
  editingTitle?: string;
  onCancelRename?: () => void;
  onEditingTitleChange?: (title: string) => void;
}

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
  availableCategories: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  explorerTree?: ExplorerItem;
  onCreateFolder?: (path: string) => Promise<void> | void;
}

const MindMapSidebar: React.FC<MindMapSidebarProps> = ({ 
  mindMaps, 
  currentMapId,
  currentWorkspaceId,
  onSelectMap, 
  onCreateMap, 
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  onChangeCategoryBulk,
  isCollapsed,
  onToggleCollapse,
  workspaces = [],
  onAddWorkspace,
  onRemoveWorkspace,
  explorerTree,
  onCreateFolder
}) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  // Explorer collapsed state mapping: path -> collapsed?
  const [explorerCollapsed, setExplorerCollapsed] = useState<Record<string, boolean>>({});
  
  // Drag & Drop フック
  const {
    draggedMap,
    draggedFolder,
    dragOverCategory,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFolderDragStart,
    handleFolderDrop,
    handleRootDrop
  } = useDragAndDrop({
    mindMaps,
    onChangeCategory,
    onChangeCategoryBulk,
    setEmptyFolders,
    setCollapsedCategories
  });
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

  const handleFinishRename = useCallback((mapIdentifier: MapIdentifier) => {
    if (editingTitle.trim() && editingTitle.trim() !== '') {
      onRenameMap(mapIdentifier, editingTitle.trim());
    }
    setEditingMapId(null);
    setEditingTitle('');
  }, [editingTitle, onRenameMap]);

  const handleCancelRename = useCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  }, []);

  const toggleCategoryCollapse = useCallback((category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  }, [collapsedCategories]);




  // フォルダ選択ハンドラー
  const handleFolderSelect = useCallback((folderPath: string) => {
    setSelectedFolder(prev => prev === folderPath ? null : folderPath);
  }, []);

  // コンテキストメニューハンドラー
  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string | null, targetType: 'folder' | 'empty' | 'map', mapData?: MindMapData) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      targetPath,
      targetType,
      mapData: mapData || null
    });
  }, []);

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
        const wsMatch = parentPath.match(/^\/?(ws_[^/]+)\/?(.*)$/);
        if (wsMatch) {
          workspaceId = wsMatch[1];
          cleanParentPath = wsMatch[2] || null;
        } else {
          // ワークスペース情報が含まれていない場合、現在のワークスペースを使用
          workspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : 'default');
          cleanParentPath = parentPath;
        }
      } else {
        // parentPathがnullの場合、適切なワークスペースを決定
        workspaceId = currentWorkspaceId || (mindMaps.length > 0 ? mindMaps[0].mapIdentifier.workspaceId : 'default');
      }

      const newFolderPath = createChildFolderPath(cleanParentPath, newFolderName.trim());


      if (onCreateFolder) {
        // onCreateFolderを修正してworkspaceIdを受け取れるようにする必要がある
        // 現在は暫定的にフルパスで渡す
        const fullPath = `/${workspaceId}/${newFolderPath}`;
        Promise.resolve(onCreateFolder(fullPath)).catch(() => {});
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

    // workspaceIdのパターンにマッチするかチェック
    const wsMatch = fullPath.match(/^\/?(ws_[^/]+)\/?(.*)$/);
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
      console.log('handleCreateMap: Original parentPath:', parentPath);
      console.log('handleCreateMap: Extracted category:', category);

      // parentPathからworkspaceIdを抽出
      const wsMatch = parentPath?.match(/^\/?(ws_[^/]+)/);
      let workspaceId = wsMatch ? wsMatch[1] : null;

      // parentPathがnullの場合、現在のワークスペースまたは利用可能な最初のワークスペースを使用
      if (!workspaceId) {
        if (currentWorkspaceId) {
          workspaceId = currentWorkspaceId;
        } else if (mindMaps.length > 0) {
          // 既存のマップから最初のワークスペースIDを取得
          workspaceId = mindMaps[0].mapIdentifier.workspaceId;
        } else {
          workspaceId = 'default';
        }
      }

      console.log('handleCreateMap: Extracted workspaceId:', workspaceId, 'from parentPath:', parentPath);

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

  // 新しいボタン用のハンドラー
  const handleAddMap = useCallback(() => {
    handleCreateMap(null);
  }, [handleCreateMap]);

  const handleAddFolder = useCallback(() => {
    handleCreateFolder(null);
  }, [handleCreateFolder]);

  const handleExpandAll = useCallback(() => {
    // Legacy maps view
    setCollapsedCategories(new Set());
    // Explorer view
    setExplorerCollapsed({}); // all expanded
  }, []);

  const handleCollapseAll = useCallback(() => {
    // すべてのカテゴリを取得してから折りたたみ状態にする
    const allFolders = new Set([...Object.keys(mindMaps.reduce((groups: { [key: string]: any[] }, map) => {
      const category = map.category || '';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
      return groups;
    }, {})), ...Array.from(emptyFolders)]);
    setCollapsedCategories(allFolders);
    // Explorer view: build list from explorerTree
    const markAllCollapsed = (node: ExplorerItem | undefined, acc: Record<string, boolean>) => {
      if (!node) return acc;
      if (node.type === 'folder') {
        if (node.path) acc[node.path] = true;
        (node.children || []).forEach(child => markAllCollapsed(child, acc));
      }
      return acc;
    };
    // @ts-ignore explorerTree may be undefined
    const tree: ExplorerItem | undefined = (explorerTree as any) || undefined;
    if (tree) {
      const next = markAllCollapsed(tree, {});
      setExplorerCollapsed(next);
    }
  }, [mindMaps, emptyFolders, explorerTree]);

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
    const currentName = oldPath.split('/').pop() || oldPath;
    // eslint-disable-next-line no-alert
    const newName = window.prompt(`フォルダ名を変更:`, currentName);
    
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const pathParts = oldPath.split('/');
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
  const { filteredMaps, groupedMaps, visibleFolders } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    // マップのタイトルまたはカテゴリ名で検索（workspaceフォルダは除外）
    const filtered = mindMaps.filter(map => {
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
  }, [mindMaps, searchTerm, emptyFolders]);

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
              <span key={ws.id} className="workspace-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 999, fontSize: 12 }}>
                <span>{ws.name}</span>
                {onRemoveWorkspace && <button onClick={() => onRemoveWorkspace(ws.id)} style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}>×</button>}
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
        onAddMap={handleAddMap}
        onAddFolder={handleAddFolder}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      {explorerTree ? (
        <div className="maps-content-wrapper">
          <ExplorerView
            tree={explorerTree}
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
            {mindMaps.length === 0 ? 'マインドマップがありません' : '検索結果が見つかりません'}
          </div>
          <div className="empty-description">
            {mindMaps.length === 0 
              ? '上の「+」ボタンから新しいマインドマップを作成してください。' 
              : '検索条件を変更してみてください。'
            }
          </div>
        </div>
      ) : (
        <div 
          className={`maps-content-wrapper ${dragOverCategory === '__root__' ? 'drag-over-root' : ''}`}
          onContextMenu={(e) => handleContextMenu(e, null, 'empty')}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedFolder || draggedMap) {
              handleDragOver(e, '__root__');
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleRootDrop(e)}
        >
          <CategoryGroup
            categories={visibleFolders}
            groupedMaps={groupedMaps}
            collapsedCategories={collapsedCategories}
            selectedFolder={selectedFolder}
            currentMapId={currentMapId}
            editingMapId={editingMapId}
            editingTitle={editingTitle}
            dragOverCategory={dragOverCategory}
            searchTerm={searchTerm}
            onToggleCategoryCollapse={toggleCategoryCollapse}
            onFolderSelect={handleFolderSelect}
            onContextMenu={handleContextMenu}
            onSelectMap={onSelectMap}
            onFinishRename={(id) => handleFinishRename(id)}
            onCancelRename={handleCancelRename}
            onEditingTitleChange={setEditingTitle}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFolderDragStart={handleFolderDragStart}
            onFolderDrop={handleFolderDrop}
          />
        </div>
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
    const wsMatch = path.match(/^\/?(ws_[^/]+)\/?(.*)$/);
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

  // Apply search filtering
  const filteredTree = searchTerm ? filterTree(tree, searchTerm.toLowerCase()) : tree;

  const NodeView: React.FC<NodeViewProps> = ({
    item,
    searchTerm,
    collapsed = {},
    onTogglePath,
    onContextMenu,
    currentMapId = null,
    currentWorkspaceId = null,
    dragOverPath = null,
    setDragOverPath,
    editingMapId = null,
    editingTitle = '',
    onCancelRename,
    onEditingTitleChange
  }) => {
    const isFile = item.type === 'file';
    const isMarkdown = isFile && item.isMarkdown;
    const isCollapsed = collapsed[item.path] || false;

    // Map ID extraction and matching
    const workspaceId = item.path.startsWith('/ws_') ? item.path.split('/')[1] : undefined;
    const mapId = isMarkdown ? item.path.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '') : null;
    const isActive = isMarkdown && mapId && currentMapId === mapId && (
      currentWorkspaceId ? (workspaceId === currentWorkspaceId) : true
    );

    const handleClick = () => {
      if (isMarkdown && mapId) {
        window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', {
          detail: { mapId, workspaceId }
        }));
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (onContextMenu) {
        onContextMenu(e, item.path, isFile ? 'explorer-file' : 'explorer-folder');
      }
    };

    const handleDragStart = (e: React.DragEvent) => {
      if (isMarkdown) {
        // For moving files within explorer (folder structure)
        e.dataTransfer.setData('mindoodle/path', item.path);

        // For dragging maps to mindmap nodes (original functionality)
        if (mapId && workspaceId) {
          e.dataTransfer.setData('mindoodle/mapId', mapId);
          e.dataTransfer.setData('mindoodle/workspaceId', workspaceId);
          e.dataTransfer.setData('text/plain', item.name || '');
        }

        e.dataTransfer.effectAllowed = 'move';
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      if (item.type === 'folder') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (setDragOverPath) {
          setDragOverPath(item.path);
        }
      }
    };

    const handleDragLeave = () => {
      if (setDragOverPath) {
        setDragOverPath(null);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      if (item.type === 'folder') {
        try {
          e.preventDefault();
          const sourcePath = e.dataTransfer.getData('mindoodle/path');
          if (sourcePath && sourcePath !== item.path) {
            window.dispatchEvent(new CustomEvent('mindoodle:moveItem', {
              detail: { sourcePath, targetFolderPath: item.path }
            }));
          }
        } finally {
          if (setDragOverPath) {
            setDragOverPath(null);
          }
        }
      }
    };

    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onTogglePath) {
        onTogglePath(item.path);
      }
    };

    if (item.type === 'folder') {
      return (
        <div className={`explorer-folder ${dragOverPath === item.path ? 'drag-over' : ''}`}>
          <div
            className="folder-header"
            onClick={handleToggle}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="category-expand-icon">
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="category-folder-icon">
              {isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
            </span>
            <span className="category-name">
              {searchTerm ? highlightSearchTerm(item.name || '(root)', searchTerm) : (item.name || '(root)')}
            </span>
          </div>
          {!isCollapsed && item.children && item.children.length > 0 && (
            <div className="folder-content" style={{ marginLeft: 16 }}>
              {item.children.map((child, index) => (
                <NodeView
                  key={child.path || index}
                  item={child}
                  searchTerm={searchTerm}
                  collapsed={collapsed}
                  onTogglePath={onTogglePath}
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
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`explorer-file ${isMarkdown ? 'markdown-file' : ''} ${isActive ? 'current' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        draggable={isMarkdown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          cursor: 'pointer',
          border: isActive ? '1px solid #007acc' : '1px solid transparent',
          background: isActive ? 'rgba(0, 122, 204, 0.1)' : 'transparent',
          borderRadius: '4px',
          color: isActive ? '#007acc' : 'inherit'
        }}
      >
        <FileText className="file-icon" size={16} />
        {isMarkdown && editingMapId === mapId ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onEditingTitleChange && onEditingTitleChange(e.target.value)}
            onBlur={onCancelRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Send rename event
                const newTitle = editingTitle.trim();
                if (newTitle && newTitle !== item.name) {
                  window.dispatchEvent(new CustomEvent('mindoodle:renameMap', {
                    detail: { mapId, newTitle }
                  }));
                }
                if (onEditingTitleChange) onEditingTitleChange('');
              } else if (e.key === 'Escape') {
                if (onCancelRename) onCancelRename();
              }
            }}
            autoFocus
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'inherit',
              flex: 1,
              fontSize: 'inherit'
            }}
          />
        ) : (
          <span className="file-name">
            {searchTerm ? highlightSearchTerm(item.name || '', searchTerm) : item.name}
          </span>
        )}
      </div>
    );
  };

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
          <NodeView
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
        <NodeView
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
