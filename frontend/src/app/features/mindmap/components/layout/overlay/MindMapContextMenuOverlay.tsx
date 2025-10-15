
import React from 'react';
import { Copy, Link, Trash2, Sparkles, Table, FileOutput } from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { findNodeInRoots } from '@mindmap/utils';
import type { MindMapNode } from '@shared/types';
import type { MarkdownNodeType, CommandContext } from '@commands/system/types';
import type { CommandRegistryImpl } from '@commands/system/registry';
import { useMindMapStore } from '@mindmap/store';

type Props = {
  dataRoot: MindMapNode | null;
  dataRoots?: MindMapNode[];
  onDelete: (nodeId: string) => void;
  onAddLink: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (parentId: string) => Promise<void>;
  onAIGenerate?: (node: MindMapNode) => void;
  onMarkdownNodeType?: (nodeId: string, newType: MarkdownNodeType) => void;
  onEditTable?: (nodeId: string) => void;
  onConvertToMap?: (nodeId: string) => Promise<void>;
  commandRegistry?: CommandRegistryImpl;
  commandContext?: CommandContext;
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
  onConvertToMap,
  commandRegistry,
  commandContext,
  onClose,
}) => {
  const store = useMindMapStore();
  const ui = store.ui;
  const visible = ui.showContextMenu;
  const position = ui.contextMenuPosition;
  const nodeId = store.selectedNodeId;

  let roots: MindMapNode[] = [];
  if (dataRoots && dataRoots.length > 0) {
    roots = dataRoots;
  } else if (dataRoot) {
    roots = [dataRoot];
  }

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


  const isTableNode = selectedNode.kind === 'table';
  if (isTableNode && onEditTable) {
    items.push({ separator: true });
    items.push({
      icon: <Table size={14} />,
      label: 'テーブルを編集',
      onClick: () => onEditTable(selectedNode.id),
    });
  }

  // Convert to map option - check using command guard
  const canConvertToMap = commandRegistry && commandContext
    ? commandRegistry.canExecute('convert-node-to-map', commandContext, { nodeId: selectedNode.id })
    : false;
  if (canConvertToMap && onConvertToMap) {
    items.push({ separator: true });
    items.push({
      icon: <FileOutput size={14} />,
      label: 'マップに変換',
      onClick: () => void onConvertToMap(selectedNode.id),
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
