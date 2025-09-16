import React from 'react';
import MindMapWorkspace from './MindMapWorkspace';
import type { FileAttachment, NodeLink, Position } from '@shared/types';

type Props = {
  data: any;
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
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: any) => void;
  onAutoLayout?: () => void;
  availableMaps: Array<{ id: string; title: string }>;
  currentMapData: any;
  onLinkNavigate: (link: NodeLink) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: Position;
  setPan: (pan: Position | ((prev: Position) => Position)) => void;
  onToggleAttachmentList: (nodeId: string) => void;
  onToggleLinkList: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
};

const MindMapWorkspaceContainer: React.FC<Props> = (props) => {
  return <MindMapWorkspace {...props} />;
};

export default MindMapWorkspaceContainer;
