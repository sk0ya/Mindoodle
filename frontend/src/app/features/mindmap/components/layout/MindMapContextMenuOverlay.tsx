import React from 'react';
import ContextMenu from '../../../../shared/components/ui/ContextMenu';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode } from '@shared/types';

type Props = {
  visible: boolean;
  position: { x: number; y: number };
  dataRoot: MindMapNode | null;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onAddLink: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (parentId: string) => Promise<void>;
  onAIGenerate?: (node: MindMapNode) => void;
  onClose: () => void;
  nodeId: string | null;
};

const MindMapContextMenuOverlay: React.FC<Props> = ({
  visible,
  position,
  dataRoot,
  onDelete,
  onCustomize,
  onAddLink,
  onCopyNode,
  onPasteNode,
  onAIGenerate,
  onClose,
  nodeId,
}) => {
  if (!visible || !nodeId || !dataRoot) return null;
  const selectedNode = findNodeById(dataRoot, nodeId);
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
      onClose={onClose}
    />
  );
};

export default MindMapContextMenuOverlay;

