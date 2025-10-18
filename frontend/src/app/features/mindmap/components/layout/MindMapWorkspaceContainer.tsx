import React from 'react';
import MindMapWorkspace from './MindMapWorkspace';
import type { NodeLink, Position, MindMapData, MindMapNode } from '@shared/types';

type Props = {
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;

  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  availableMaps: Array<{ id: string; title: string }>;
  currentMapData: MindMapData | null;
  onLinkNavigate: (link: NodeLink) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: Position;
  setPan: (pan: Position | ((prev: Position) => Position)) => void;
  onToggleLinkList: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
  onImageClick?: (imageUrl: string) => void;
};

const MindMapWorkspaceContainer: React.FC<Props> = (props) => {
  return <MindMapWorkspace {...props} />;
};

export default React.memo(MindMapWorkspaceContainer);
