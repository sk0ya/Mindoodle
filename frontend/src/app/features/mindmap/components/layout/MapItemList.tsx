import React, { useCallback } from 'react';
import { Workflow } from 'lucide-react';
import type { MindMapData, MindMapNode } from '@shared/types';
import { highlightSearchTerm } from '../../../../shared/utils/highlightUtils';

interface MapItemListProps {
  maps: MindMapData[];
  categoryPath: string;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  searchTerm: string;
  onSelectMap: (mapId: string) => void;
  onOpenMapData?: (map: MindMapData) => void;
  onFinishRename: (mapId: string) => void;
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
  onOpenMapData,
  onFinishRename,
  onCancelRename,
  onEditingTitleChange,
  onDragStart,
  onContextMenu
}) => {
  const handleKeyPress = useCallback((e: React.KeyboardEvent, mapId: string) => {
    if (e.key === 'Enter') {
      onFinishRename(mapId);
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  }, [onFinishRename, onCancelRename]);

  return (
    <>
      {maps.map((map) => (
        <div
          key={map.id}
          className={`map-item ${currentMapId === map.id ? 'active' : ''}`}
          data-map-id={map.id}
          onClick={() => {
            try { console.info('[MapItemList] click', map.id, map.title); } catch {}
            if (onOpenMapData) {
              onOpenMapData(map);
            } else {
              onSelectMap(map.id);
            }
            try {
              // Fallback event for any consumers listening globally
              window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail: { mapId: map.id } }));
            } catch {}
          }}
          onContextMenu={(e) => onContextMenu && onContextMenu(e, categoryPath, 'map', map)}
          draggable={false}
        >
          {editingMapId === map.id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onBlur={() => onFinishRename(map.id)}
              onKeyDown={(e) => handleKeyPress(e, map.id)}
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
