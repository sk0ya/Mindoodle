import React from 'react';
import MindMapWorkspaceContainer from '../MindMapWorkspaceContainer';
import type { MindMapData, MindMapNode } from '@shared/types';

interface Props {
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
  onShowLinkActionMenu: (...args: any[]) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout: () => void;
  availableMaps: Array<{ id: string; title: string }>;
  currentMapData: MindMapData | null;
  onLinkNavigate: (link: any) => void;
  zoom: number;
  setZoom: (z: number) => void;
  pan: { x: number; y: number };
  setPan: (p: any) => void;
  onToggleLinkList: (nodeId: string) => void;
  onLoadRelativeImage: (path: string) => Promise<string | null>;
  onImageClick: (url: string, alt?: string) => void;
}

const MindMapWorkspacePane: React.FC<Props> = (props) => {
  return <MindMapWorkspaceContainer {...props} />;
};

export default MindMapWorkspacePane;
