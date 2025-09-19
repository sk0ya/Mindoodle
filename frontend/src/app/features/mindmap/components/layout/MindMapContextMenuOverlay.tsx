import React from 'react';
import ContextMenu from '../../../../shared/components/ui/ContextMenu';
import { findNodeById, findNodeInRoots } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode } from '@shared/types';

type Props = {
  visible: boolean;
  position: { x: number; y: number };
  dataRoot: MindMapNode | null;
  dataRoots?: MindMapNode[];
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onAddLink: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (parentId: string) => Promise<void>;
  onAIGenerate?: (node: MindMapNode) => void;
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onClose: () => void;
  nodeId: string | null;
};

const MindMapContextMenuOverlay: React.FC<Props> = ({
  visible,
  position,
  dataRoot,
  dataRoots,
  onDelete,
  onCustomize,
  onAddLink,
  onCopyNode,
  onPasteNode,
  onAIGenerate,
  onMarkdownNodeType,
  onClose,
  nodeId,
}) => {
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
      onCustomize={onCustomize}
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
