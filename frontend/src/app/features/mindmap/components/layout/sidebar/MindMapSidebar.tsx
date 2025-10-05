// moved to layout/sidebar
import React, { memo } from 'react';
import { Workflow } from 'lucide-react';
import SidebarHeader from './SidebarHeader';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from '../../../styles/SidebarStyles';
import ContextMenu from '../overlay/ContextMenu';
import { ExplorerView } from './ExplorerView';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';

// Custom hooks
import { useSidebarFolderOps } from '../../../hooks/sidebar.folderOps';
import { useSidebarMapOps } from '../../../hooks/sidebar.mapOps';
import { useSidebarFiltering } from '../../../hooks/sidebar.filtering';
import { useSidebarExplorerTree } from '../../../hooks/sidebar.explorerTree';
import { useSidebarContextMenu } from '../../../hooks/sidebar.contextMenu';

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
  // Folder operations hook
  const {
    emptyFolders,
    setEmptyFolders,
    collapsedCategories,
    extractCategory,
    toggleCategoryCollapse,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder
  } = useSidebarFolderOps({
    mindMaps,
    currentWorkspaceId,
    onChangeCategory,
    onCreateFolder
  });

  // Map operations hook
  const {
    editingMapId,
    editingTitle,
    setEditingTitle,
    handleStartRename,
    handleCancelRename,
    handleCreateMap
  } = useSidebarMapOps({
    mindMaps,
    currentWorkspaceId,
    onCreateMap,
    extractCategory,
    setEmptyFolders
  });

  // Filtering hook
  const {
    searchTerm,
    setSearchTerm,
    filteredMaps
  } = useSidebarFiltering({
    mindMaps,
    emptyFolders,
    currentWorkspaceId,
    extractCategory
  });

  // Explorer tree hook
  const {
    enhancedExplorerTree,
    explorerCollapsed,
    setExplorerCollapsed
  } = useSidebarExplorerTree({
    explorerTree,
    emptyFolders,
    currentWorkspaceId
  });

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
  }, [explorerTree, enhancedExplorerTree, setExplorerCollapsed]);

  // Context menu hook
  const {
    contextMenu,
    contextMenuItems,
    setContextMenu,
    closeContextMenu
  } = useSidebarContextMenu({
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
  });

  if (isCollapsed) {
    return <SidebarCollapsed onToggleCollapse={onToggleCollapse} />;
  }

  return (
    <div className="mind-map-sidebar">
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

export default memo(MindMapSidebar);
