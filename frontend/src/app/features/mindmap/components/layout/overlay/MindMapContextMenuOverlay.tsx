// moved to layout/overlay
import React from 'react';
import { Copy, Link, Trash2, Sparkles, Table } from 'lucide-react';
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
  onEditTable?: (nodeId: string) => void;
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
  onMarkdownNodeType: _onMarkdownNodeType,
  onEditTable,
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
      icon: <Copy size={14} />,
      label: 'コピー',
      onClick: () => onCopyNode(selectedNode.id),
    },
    {
      icon: <Copy size={14} />,
      label: '貼り付け',
      onClick: () => void onPasteNode(selectedNode.id),
    },
    {
      icon: <Link size={14} />,
      label: 'リンクを追加',
      onClick: () => onAddLink(selectedNode.id),
    },
  ];

  if (onAIGenerate) {
    items.push({
      icon: <Sparkles size={14} />,
      label: 'AI生成',
      onClick: () => onAIGenerate(selectedNode),
    });
  }

  // テーブル編集メニュー（テーブルノードのみ）
  const isTableNode = (selectedNode as any).kind === 'table';
  if (isTableNode && onEditTable) {
    items.push({ separator: true });
    items.push({
      icon: <Table size={14} />,
      label: 'テーブルを編集',
      onClick: () => onEditTable(selectedNode.id),
    });
  }

  items.push({ separator: true });
  items.push({
    icon: <Trash2 size={14} />,
    label: '削除',
    onClick: () => onDelete(selectedNode.id),
    danger: true,
  });

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
