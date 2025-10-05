import React from 'react';
import ContextMenu from '../ContextMenu';
import { findNodeInRoots } from '@mindmap/utils';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';

type Props = {
  dataRoot: MindMapNode | null;
  dataRoots?: MindMapNode[];
  onDelete: (nodeId: string) => void;
  onAddLink: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (parentId: string) => Promise<void>;
  onAIGenerate?: (node: MindMapNode) => void;
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onClose: () => void;
};

const MindMapContextMenuOverlay: React.FC<Props> = ({
  dataRoot,
  dataRoots,
  onDelete,
  onAddLink,
  onCopyNode,
  onPasteNode,
  onAIGenerate,
  onMarkdownNodeType,
  onClose,
}) => {
  const store = useMindMapStore();
  const ui = store.ui;
  const visible = ui.showContextMenu;
  const position = ui.contextMenuPosition;
  const nodeId = store.selectedNodeId;

  const roots = (dataRoots && dataRoots.length > 0)
    ? dataRoots
    : (dataRoot ? [dataRoot] : []);

  if (!visible || !nodeId || roots.length === 0) return null;
  const selectedNode = findNodeInRoots(roots, nodeId);
  if (!selectedNode) return null;
  return (
    <ContextMenu
      visible={visible}
      position={position}
      selectedNode={selectedNode}
      onDelete={onDelete}
      onAddLink={onAddLink}
      onCopy={(node) => onCopyNode(node.id)}
      onPaste={onPasteNode}
      onAIGenerate={onAIGenerate}
      onMarkdownNodeType={onMarkdownNodeType}
      onClose={onClose}
    />
  );
};

export default MindMapContextMenuOverlay;
