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
  const handleKeyPress = useCallback((e: React.KeyboardEvent, mapIdentifier: MapIdentifier) => {
    if (e.key === 'Enter') {
      onFinishRename(mapIdentifier);
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  }, [onFinishRename, onCancelRename]);

  // ダブルクリック防止のためのデバウンス
  const handleMapClick = useCallback((mapIdentifier: MapIdentifier) => {
    // 同じマップが既に選択されている場合は早期リターン
    if (currentMapId === mapIdentifier.mapId) {
      console.log('🔄 Same map clicked, skipping:', mapIdentifier.mapId);
      return;
    }
    onSelectMap(mapIdentifier);
  }, [onSelectMap, currentMapId]);

  return (
    <>
      {maps.map((map) => (
        <div
          key={map.mapIdentifier.mapId}
          className={`map-item ${currentMapId === map.mapIdentifier.mapId ? 'active' : ''}`}
          onClick={() => handleMapClick(map.mapIdentifier)}
          onDoubleClick={(e) => {
            e.preventDefault();
            // ダブルクリック時は何もしない（シングルクリックのみで十分）
          }}
          onContextMenu={(e) => onContextMenu && onContextMenu(e, categoryPath, 'map', map)}
          draggable
          onDragStart={(e) => onDragStart(e, map)}
        >
          {editingMapId === map.mapIdentifier.mapId ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onBlur={() => onFinishRename(map.mapIdentifier)}
              onKeyDown={(e) => handleKeyPress(e, map.mapIdentifier)}
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
                    {map.rootNodes?.reduce((total, root) => total + getNodeCount(root), 0) || 0} ノード
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
