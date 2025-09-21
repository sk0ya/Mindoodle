import React, { memo } from 'react';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import MindMapCanvas from './MindMapCanvas';
import type { MindMapData, Position, NodeLink } from '@shared/types';

interface MindMapWorkspaceProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onMoveNode: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<import('@shared/types').MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  // Link display data
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
  
  // Link navigation
  onLinkNavigate?: (link: NodeLink) => void;
  
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: Position;
  setPan: (pan: Position | ((prev: Position) => Position)) => void;
  
  // Icon toggle handlers
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
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
  onMoveNode,
  onChangeSiblingOrder,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
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
  onToggleAttachmentList,
  onToggleLinkList,
  onLoadRelativeImage
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
        onChangeParent={onMoveNode}
        onChangeSiblingOrder={onChangeSiblingOrder}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onDeleteNode={onDeleteNode}
        onRightClick={onRightClick}
        onToggleCollapse={onToggleCollapse}
        onNavigateToDirection={(_direction: 'up' | 'down' | 'left' | 'right') => {}}
        onShowLinkActionMenu={onShowLinkActionMenu}
        onAddLink={onAddLink}
        onUpdateNode={onUpdateNode}
        onAutoLayout={onAutoLayout}
        availableMaps={availableMaps}
        currentMapData={currentMapData}
        onLinkNavigate={onLinkNavigate}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
        onToggleAttachmentList={onToggleAttachmentList}
        onToggleLinkList={onToggleLinkList}
        onLoadRelativeImage={onLoadRelativeImage}
      />
    </ErrorBoundary>
  );
};

export default memo(MindMapWorkspace);
