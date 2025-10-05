// moved to layout/overlay
import React from 'react';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
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

  const items: ContextMenuItem[] = [
    {
      label: 'Delete',
      onClick: () => onDelete(selectedNode.id),
    },
    {
      label: 'Add Link',
      onClick: () => onAddLink(selectedNode.id),
    },
    {
      label: 'Copy',
      onClick: () => onCopyNode(selectedNode.id),
    },
    {
      label: 'Paste',
      onClick: () => void onPasteNode(selectedNode.id),
    },
  ];

  if (onAIGenerate) {
    items.push({
      label: 'AI Generate',
      onClick: () => onAIGenerate(selectedNode),
    });
  }

  if (onMarkdownNodeType) {
    items.push({ separator: true });
    items.push({
      label: 'Heading',
      onClick: () => onMarkdownNodeType(selectedNode.id, 'heading'),
    });
    items.push({
      label: 'Unordered List',
      onClick: () => onMarkdownNodeType(selectedNode.id, 'unordered-list'),
    });
    items.push({
      label: 'Ordered List',
      onClick: () => onMarkdownNodeType(selectedNode.id, 'ordered-list'),
    });
  }

  return (
    <ContextMenu
      isVisible={visible}
      position={position}
      items={items}
      onClose={onClose}
    />
  );
};

export default MindMapContextMenuOverlay;
