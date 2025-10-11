
import React from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { highlightSearchTerm } from '@shared/utils';
import type { ExplorerItem } from '@core/types';

export interface ExplorerNodeViewProps {
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

export const ExplorerNodeView: React.FC<ExplorerNodeViewProps> = ({
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

  
  let workspaceId: string | null = null;
  let mapId: string | null = null;

  if (isMarkdown) {
    
    const re = /^\/(ws_[^/]+|cloud)\/(.+)$/;
    const pathMatch = re.exec(item.path);
    if (pathMatch) {
      workspaceId = pathMatch[1];
      mapId = pathMatch[2].replace(/\.md$/i, '');
    } else {
      // Fallback for other patterns
      workspaceId = item.path.startsWith('/ws_') ? item.path.split('/')[1] : null;
      mapId = item.path.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '');
    }
  }
  const isActive = isMarkdown && mapId && currentMapId === mapId && (
    currentWorkspaceId ? (workspaceId === currentWorkspaceId) : true
  );

  const handleClick = () => {
    if (isMarkdown && mapId) {
      // 同じマップが既に選択されている場合は早期リターン
      if (currentMapId === mapId &&
          currentWorkspaceId === workspaceId) {
        return;
      }
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
    
    
    const relativePath = item.path.startsWith('/ws_')
      ? item.path.replace(/^\/ws_[^/]+\//, '')
      : item.path.replace(/^\/cloud\//, '');

    // Set the relative path for file system operations (without workspaceId prefix)
    e.dataTransfer.setData('mindoodle/path', relativePath);
    e.dataTransfer.setData('mindoodle/type', item.type);
    e.dataTransfer.setData('mindoodle/workspaceId', workspaceId || '');

    // For markdown files only: set additional data for dragging to mindmap nodes
    if (isMarkdown && mapId) {
      e.dataTransfer.setData('mindoodle/mapId', mapId);
      e.dataTransfer.setData('text/plain', item.name || '');
    }

    e.dataTransfer.effectAllowed = 'move';
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
        const sourceWorkspaceId = e.dataTransfer.getData('mindoodle/workspaceId');

        
        
        const targetRelativePath = item.path.startsWith('/ws_')
          ? item.path.replace(/^\/ws_[^/]+\//, '')
          : item.path.replace(/^\/cloud\//, '');

        if (sourcePath && sourcePath !== targetRelativePath) {

          window.dispatchEvent(new CustomEvent('mindoodle:moveItem', {
            detail: {
              sourcePath,
              targetFolderPath: targetRelativePath,
              workspaceId: sourceWorkspaceId || workspaceId
            }
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
    
    if (!item.name || item.name.trim() === '') {
      return (
        <>
          {item.children && item.children.map((child, index) => (
            <ExplorerNodeView
              key={child.path || index}
              item={child}
              searchTerm={searchTerm}
              collapsed={collapsed}
              onTogglePath={onTogglePath}
              onContextMenu={onContextMenu}
              currentMapId={currentMapId}
              currentWorkspaceId={currentWorkspaceId}
            />
          ))}
        </>
      );
    }

    // cloudワークスペースの場合は🌐アイコンを使用
    const isCloudWorkspace = item.path === '/cloud' || item.path === 'cloud';

    return (
      <div className={`explorer-folder ${dragOverPath === item.path ? 'drag-over' : ''}`}>
        <div
          className="folder-header"
          onClick={handleToggle}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          draggable={true}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span className="category-expand-icon">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className="category-folder-icon">
            {isCloudWorkspace ? '🌐' : (isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />)}
          </span>
          <span className="category-name">
            {searchTerm ? highlightSearchTerm(item.name || '', searchTerm) : (item.name || '')}
          </span>
        </div>
        {!isCollapsed && item.children && item.children.length > 0 && (
          <div className="folder-content" style={{ marginLeft: 16 }}>
            {item.children.map((child, index) => (
              <ExplorerNodeView
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
      draggable={true}
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
