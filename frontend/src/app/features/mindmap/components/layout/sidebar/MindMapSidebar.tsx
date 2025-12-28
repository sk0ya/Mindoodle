
import React, { memo } from 'react';
import { Workflow, Cloud, CloudOff } from 'lucide-react';
import SidebarHeader from './SidebarHeader';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from '../../../styles/SidebarStyles';
import ContextMenu from '../overlay/ContextMenu';
import { ExplorerView } from './ExplorerView';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';
import { useSidebar } from '../../../hooks/useSidebar';
import { useCloudWorkspace } from '../../../hooks/useCloudWorkspace';
import { flexStyles, flexRow, combineStyles } from '../../shared/commonStyles';

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
  const { isCloudConnected, handleToggleCloud } = useCloudWorkspace(workspaces);

  const sidebar = useSidebar({
    mindMaps,
    currentWorkspaceId,
    onSelectMap,
    onCreateMap,
    onDeleteMap,
    onChangeCategory,
    onCreateFolder,
    explorerTree
  });

  
  const {
    
    editingMapId,
    editingTitle,
    setEditingTitle,
    handleCancelRename,
    
    searchTerm,
    setSearchTerm,
    filteredMaps,
    
    enhancedExplorerTree,
    explorerCollapsed,
    setExplorerCollapsed,
    
    contextMenu,
    contextMenuItems,
    setContextMenu,
    closeContextMenu
  } = sidebar;

  // Track the last processed tree to avoid infinite loops
  const lastProcessedTreeRef = React.useRef<string>('');

  // Initialize collapsed state for all folders in the explorer tree
  React.useEffect(() => {
    const tree = enhancedExplorerTree;
    if (!tree) return;

    // Create a stable identifier for the tree structure to detect actual changes
    const treeSignature = JSON.stringify({
      explorerTree: explorerTree?.path,
      children: explorerTree?.children?.length,
      treeHash: JSON.stringify(tree).slice(0, 100) // Simple hash to detect structural changes
    });

    // Skip if we've already processed this exact tree structure
    if (lastProcessedTreeRef.current === treeSignature) {
      return;
    }

    const isWorkspaceRoot = (p: string): boolean => /^\/?(?:ws_[^/]+|cloud)\/?$/.test(p || '');
    const visit = (item: ExplorerItem, acc: Record<string, boolean>) => {
      if (!item) return;
      if (item.type === 'folder') {
        const path = item.path || '';
        const defaultCollapsed = isWorkspaceRoot(path) ? false : true;
        if (!(path in acc)) acc[path] = defaultCollapsed;
        if (Array.isArray(item.children)) {
          item.children.forEach((ch) => visit(ch, acc));
        }
      }
    };

    const newPaths: Record<string, boolean> = {};
    visit(tree, newPaths);

    // Only update if there are actually new paths
    setExplorerCollapsed((prev) => {
      const hasChanges = Object.keys(newPaths).some(path => !(path in prev));
      if (!hasChanges) return prev;
      return { ...prev, ...newPaths };
    });

    // Mark this tree as processed
    lastProcessedTreeRef.current = treeSignature;
  }, [explorerTree, enhancedExplorerTree, setExplorerCollapsed]);

  if (isCollapsed) {
    return <SidebarCollapsed onToggleCollapse={onToggleCollapse} />;
  }

  return (
    <div className="mind-map-sidebar">
      <div className="workspaces-header" style={{ padding: '8px 8px 4px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={flexStyles.spaceBetween}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>workspaces</div>
          <button
            onClick={handleToggleCloud}
            title={isCloudConnected ? "Disconnect from cloud" : "Connect to cloud"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: isCloudConnected ? 'var(--accent-color)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            {isCloudConnected ? <Cloud size={14} /> : <CloudOff size={14} />}
          </button>
        </div>
        <div style={combineStyles(flexRow(6), { marginTop: 6, flexWrap: 'wrap' })}>
          {workspaces && workspaces.length > 0 ? (
            <>
              {workspaces.map((ws) => (
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
                  {}
                  {onRemoveWorkspace && ws.id !== 'cloud' && <button onClick={(e) => {
                    e.stopPropagation();
                    onRemoveWorkspace(ws.id);
                  }} style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}>×</button>}
                </span>
              ))}
              <button
                className="workspace-chip"
                onClick={() => onAddWorkspace && onAddWorkspace()}
                title="Add workspace"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)'
                }}
              >
                ＋
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No workspace.</span>
              <button
                className="workspace-chip"
                onClick={() => onAddWorkspace && onAddWorkspace()}
                title="Add workspace"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--accent-color)',
                  marginLeft: 4
                }}
              >
                ＋
              </button>
            </>
          )}
        </div>
      </div>
      <SidebarHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleCollapse={onToggleCollapse}
      />
      {(() => {
        const hasTree = !!enhancedExplorerTree && ((enhancedExplorerTree.children?.length ?? 0) > 0);
        if (hasTree) {
          return (
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
          );
        }
        if (filteredMaps.length === 0) {
          const isEmptyWorkspace = mindMaps.length === 0;
          return (
            <div className="empty-state">
              <div className="empty-icon"><Workflow size={32} /></div>
              <div className="empty-title">
                {isEmptyWorkspace ? 'このワークスペースにはマインドマップがありません' : '検索結果が見つかりません'}
              </div>
              <div className="empty-description">
                {isEmptyWorkspace
                  ? '「＋」ボタンからローカルフォルダをワークスペースとして追加し、マインドマップやフォルダを作成できます。'
                  : '検索条件を調整して再度お試しください。'
                }
              </div>
            </div>
          );
        }
        return <div>No content available</div>;
      })()}

      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />

      <SidebarStyles />
      <style>{`
        .workspace-chip button:hover {
          color: var(--text-primary);
        }
        .workspaces-header > div > button:hover {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }
      `}</style>
    </div>
  );
};

export default memo(MindMapSidebar);
