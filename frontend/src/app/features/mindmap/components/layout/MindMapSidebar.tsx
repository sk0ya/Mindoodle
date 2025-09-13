import React, { useState, useCallback, useMemo, memo } from 'react';
import { Workflow, Folder, FolderOpen, Edit3, Trash2, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';
import SidebarHeader from './SidebarHeader';
import CategoryGroup from './CategoryGroup';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from './SidebarStyles';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import type { MindMapData } from '@shared/types';
import { createChildFolderPath } from '../../../../shared/utils/folderUtils';
import { logger } from '../../../../shared/utils/logger';
import { useDragAndDrop } from '../../../../shared/hooks/useDragAndDrop';
import type { ExplorerItem } from '../../../../core/storage/types';

interface MindMapSidebarProps {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onDeleteMap: (mapId: string) => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  availableCategories: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  explorerTree?: ExplorerItem;
  onCreateFolder?: (path: string) => Promise<void> | void;
}

const MindMapSidebar: React.FC<MindMapSidebarProps> = ({ 
  mindMaps, 
  currentMapId, 
  onSelectMap, 
  onCreateMap, 
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  onChangeCategoryBulk,
  isCollapsed,
  onToggleCollapse,
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
  const [explorerSelectedPath, setExplorerSelectedPath] = useState<string | null>(null);

  // イベントハンドラー
  const handleStartRename = useCallback((mapId: string, currentTitle: string) => {
    setEditingMapId(mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleFinishRename = useCallback((mapId: string) => {
    if (editingTitle.trim() && editingTitle.trim() !== '') {
      onRenameMap(mapId, editingTitle.trim());
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
      const newFolderPath = createChildFolderPath(parentPath, newFolderName.trim());
      if (onCreateFolder) {
        Promise.resolve(onCreateFolder(newFolderPath)).catch(() => {});
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
  }, [onCreateFolder]);

  const handleCreateMap = useCallback((parentPath: string | null) => {
    const parentInfo = parentPath ? ` (${parentPath} 内)` : '';
    // eslint-disable-next-line no-alert
    const mapName = window.prompt(`新しいマインドマップの名前を入力してください${parentInfo}:`, '新しいマインドマップ');
    if (mapName && mapName.trim()) {
      onCreateMap(mapName.trim(), parentPath || undefined);
      
      // マップが作成されたフォルダを空フォルダリストから削除
      if (parentPath) {
        setEmptyFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
      }
    }
  }, [onCreateMap, setEmptyFolders]);

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
          onChangeCategory(map.id, updatedCategory);
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
    
    // マップのタイトルまたはカテゴリ名で検索
    const filtered = mindMaps.filter(map => {
      const titleMatch = map.title.toLowerCase().includes(searchLower);
      const categoryMatch = map.category && map.category.toLowerCase().includes(searchLower);
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
      
      // フォルダ名が検索条件にマッチするフォルダも追加
      Array.from(emptyFolders).forEach(folder => {
        if (folder.toLowerCase().includes(searchLower)) {
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
          onClick: () => onSelectMap(mapData.id)
        },
        {
          label: '名前を変更',
          icon: <Edit3 size={14} />,
          onClick: () => handleStartRename(mapData.id, mapData.title)
        },
        {
          label: 'マップを削除',
          icon: <Trash2 size={14} />,
          onClick: () => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`「${mapData.title}」を削除しますか？`)) {
              onDeleteMap(mapData.id);
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
      const isCollapsed = !!(targetPath && collapsedCategories.has(targetPath));
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
            if (targetPath && window.confirm(`フォルダ「${targetPath}」を削除しますか？（中身も削除されます）`)) {
              window.dispatchEvent(new CustomEvent('mindoodle:deleteItem', { detail: { path: targetPath } }));
            }
          }
        },
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
    } else if (targetType === 'explorer-file') {
      return [
        {
          label: '開く',
          icon: <BookOpen size={14} />,
          onClick: () => {
            if (targetPath && /\.md$/i.test(targetPath)) {
              const mapId = targetPath.replace(/\.md$/i, '');
              window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail: { mapId } }));
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
            if (targetPath && window.confirm(`ファイル「${targetPath}」を削除しますか？`)) {
              window.dispatchEvent(new CustomEvent('mindoodle:deleteItem', { detail: { path: targetPath } }));
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
            selectedPath={explorerSelectedPath}
            onSelectPath={setExplorerSelectedPath}
            collapsed={explorerCollapsed}
            onTogglePath={(path: string) => setExplorerCollapsed(prev => ({ ...prev, [path]: !prev[path] }))}
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
            onFinishRename={handleFinishRename}
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
    </div>
  );
};

const ExplorerView: React.FC<{ tree: ExplorerItem, selectedPath?: string | null, onSelectPath?: (p: string) => void, onContextMenu?: (e: React.MouseEvent, path: string, type: 'explorer-folder' | 'explorer-file') => void, collapsed?: Record<string, boolean>, onTogglePath?: (path: string) => void }> = ({ tree, selectedPath, onSelectPath, onContextMenu, collapsed = {}, onTogglePath }) => {
  const toggle = (path: string) => onTogglePath && onTogglePath(path);
  const [dragOverPath, setDragOverPath] = React.useState<string | null>(null);

  const NodeView: React.FC<{ item: ExplorerItem }> = ({ item }) => {
    if (item.type === 'folder') {
      const isCollapsed = collapsed[item.path] ?? false;
      return (
        <div className="explorer-folder" key={item.path}>
          <div className={`category-header ${selectedPath === item.path ? 'selected' : ''} ${dragOverPath === item.path ? 'drag-over' : ''}`}
            onClick={() => onSelectPath && onSelectPath(item.path)}
            onDoubleClick={(e) => { e.preventDefault(); toggle(item.path); }}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, item.path, 'explorer-folder')}
            onDragOver={(e) => { e.preventDefault(); setDragOverPath(item.path); }}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => {
              try {
                e.preventDefault();
                const dt = e.dataTransfer;
                const src = dt ? dt.getData('mindoodle/path') : '';
                if (src) {
                  window.dispatchEvent(new CustomEvent('mindoodle:moveItem', { detail: { sourcePath: src, targetFolderPath: item.path } }));
                }
              } finally {
                setDragOverPath(null);
              }
            }}
          >
            <span className="category-expand-icon" onClick={(e) => { e.stopPropagation(); toggle(item.path); }}>
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="category-folder-icon">{isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}</span>
            <span className="category-name">{item.name || '(root)'}</span>
          </div>
          {!isCollapsed && item.children && (
            <div style={{ marginLeft: 16 }}>
              {item.children.map(child => (
                <NodeView key={child.path} item={child} />
              ))}
            </div>
          )}
        </div>
      );
    }
    const isMd = !!item.isMarkdown;
    const mapId = isMd ? item.path.replace(/\.md$/i, '') : null;
    const onClick = () => {
      if (isMd && mapId) {
        const ev = new CustomEvent('mindoodle:selectMapById', { detail: { mapId } });
        window.dispatchEvent(ev);
      }
      if (onSelectPath) onSelectPath(item.path);
    };
    return (
      <div className={`explorer-file ${isMd ? 'is-md' : 'is-file'} ${selectedPath === item.path ? 'selected' : ''}`}
        key={item.path}
        onClick={onClick}
        onContextMenu={(e) => onContextMenu && onContextMenu(e, item.path, 'explorer-file')}
        draggable={isMd}
        onDragStart={(e) => { e.dataTransfer.setData('mindoodle/path', item.path); e.dataTransfer.effectAllowed = 'move'; }}
        style={{ cursor: isMd ? 'pointer' : 'default' }}>
        <span className="file-icon">{isMd ? <BookOpen size={14} /> : <Workflow size={14} />}</span>
        <span className="file-name">{item.name}</span>
      </div>
    );
  };

  return (
    <div className="explorer-root"
      onDragOver={(e) => { e.preventDefault(); setDragOverPath(''); }}
      onDrop={(e) => { 
        try {
          e.preventDefault(); 
          const dt = e.dataTransfer; 
          const src = dt ? dt.getData('mindoodle/path') : ''; 
          if (src) window.dispatchEvent(new CustomEvent('mindoodle:moveItem', { detail: { sourcePath: src, targetFolderPath: '' } })); 
        } finally {
          setDragOverPath(null); 
        }
      }}
    >
      {tree.children?.map(child => <NodeView key={child.path} item={child} />)}
    </div>
  );
};

export default memo(MindMapSidebar);
