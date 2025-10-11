import React, { memo } from 'react';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import MindMapCanvas from './MindMapCanvas';
import type { MindMapData, Position, NodeLink } from '@shared/types';

interface MindMapWorkspaceProps {
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  
  onToggleCollapse: (nodeId: string) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<import('@shared/types').MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  
  availableMaps?: { id: string; title: string }[];
  currentMapData?: import('@shared/types').MindMapData | null;
  
  
  onLinkNavigate?: (link: NodeLink) => void;
  
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: Position;
  setPan: (pan: Position | ((prev: Position) => Position)) => void;
  
  
  onToggleLinkList?: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
  onImageClick?: (imageUrl: string) => void;
}

const MindMapWorkspace: React.FC<MindMapWorkspaceProps> = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  
  onToggleCollapse,
  onShowLinkActionMenu,
  onAddLink,
  onUpdateNode,
  onAutoLayout,
  availableMaps,
  currentMapData,
  onLinkNavigate,
  zoom,
  setZoom,
  pan,
  setPan,
  onToggleLinkList,
  onLoadRelativeImage,
  onImageClick
}) => {
  
  return (
    <ErrorBoundary>
      <MindMapCanvas
        data={data}
        selectedNodeId={selectedNodeId}
        editingNodeId={editingNodeId}
        editText={editText}
        setEditText={setEditText}
        onSelectNode={onSelectNode}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        
        onToggleCollapse={onToggleCollapse}
        
        onShowLinkActionMenu={onShowLinkActionMenu}
        onAddLink={onAddLink}
        onUpdateNode={onUpdateNode}
        onAutoLayout={onAutoLayout}
        availableMaps={availableMaps}
        currentMapData={currentMapData ? { id: currentMapData.mapIdentifier.mapId, rootNodes: currentMapData.rootNodes, mapIdentifier: currentMapData.mapIdentifier as unknown as Record<string, unknown> } : undefined}
        onLinkNavigate={onLinkNavigate}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
        onToggleLinkList={onToggleLinkList}
        onLoadRelativeImage={onLoadRelativeImage}
        onImageClick={onImageClick}
      />
    </ErrorBoundary>
  );
};

export default memo(MindMapWorkspace);
