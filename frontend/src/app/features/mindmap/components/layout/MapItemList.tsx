import React, { useCallback } from 'react';
import { Workflow } from 'lucide-react';
import type { MindMapData, MindMapNode, MapIdentifier } from '@shared/types';
import { highlightSearchTerm } from '../../../../shared/utils/highlightUtils';

interface MapItemListProps {
  maps: MindMapData[];
  categoryPath: string;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  searchTerm: string;
  onSelectMap: (id: MapIdentifier) => void;
  onFinishRename: (id: MapIdentifier) => void;
  onCancelRename: () => void;
  onEditingTitleChange: (title: string) => void;
  onDragStart: (e: React.DragEvent, map: MindMapData) => void;
  onContextMenu?: (e: React.MouseEvent, targetPath: string | null, targetType: 'folder' | 'empty' | 'map', mapData?: MindMapData) => void;
}

// ユーティリティ関数
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '無効な日付';
  }
};

const getNodeCount = (rootNode?: MindMapNode): number => {
  if (!rootNode) return 0;
  
  const countNodes = (node: MindMapNode): number => {
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };
  
  return countNodes(rootNode);
};

const MapItemList: React.FC<MapItemListProps> = ({
  maps,
  categoryPath,
  currentMapId,
  editingMapId,
  editingTitle,
  searchTerm,
  onSelectMap,
  onFinishRename,
  onCancelRename,
  onEditingTitleChange,
  onDragStart,
  onContextMenu
}) => {
  const handleKeyPress = useCallback((e: React.KeyboardEvent, mapId: string) => {
    if (e.key === 'Enter') {
      const ws = (maps.find(m => m.mapIdentifier.mapId === mapId) as any)?.mapIdentifier?.workspaceId as string;
      onFinishRename({ mapId, workspaceId: ws });
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  }, [onFinishRename, onCancelRename, maps]);

  return (
    <>
      {maps.map((map) => (
        <div
          key={map.mapIdentifier.mapId}
          className={`map-item ${currentMapId === map.mapIdentifier.mapId ? 'active' : ''}`}
          onClick={() => onSelectMap({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId })}
          onContextMenu={(e) => onContextMenu && onContextMenu(e, categoryPath, 'map', map)}
          draggable
          onDragStart={(e) => onDragStart(e, map)}
        >
          {editingMapId === map.mapIdentifier.mapId ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onBlur={() => onFinishRename({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId })}
              onKeyDown={(e) => handleKeyPress(e, map.mapIdentifier.mapId)}
              autoFocus
              className="title-input"
            />
          ) : (
            <div className="map-info">
              <span className="map-file-icon"><Workflow size={16} /></span>
              <div className="map-details">
                <div className="map-title">{highlightSearchTerm(map.title, searchTerm)}</div>
                <div className="map-meta">
                  <span className="node-count">
                    {getNodeCount(map.rootNode)} ノード
                  </span>
                  <span className="update-date">
                    {formatDate(map.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
};

export default MapItemList;
