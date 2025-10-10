import React from 'react';
import { Bot, Copy, Clipboard, Link, Trash2, Clock, List, Table } from 'lucide-react';
import { MindMapNode } from '@shared/types';
import { useMindMapStore } from '../../store';

interface MenuItemAction {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

interface MenuItemSeparator {
  type: 'separator';
}

export type MenuItem = MenuItemAction | MenuItemSeparator;

interface MenuItemsProps {
  selectedNode: MindMapNode;
  onDelete: (nodeId: string) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onAIGenerate?: (node: MindMapNode) => void;
  onAddLink?: (nodeId: string) => void;
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onEditTable?: (nodeId: string) => void;
  onClose: () => void;
}

const MenuItems: React.FC<MenuItemsProps> = ({
  selectedNode,
  onDelete,
  onCopy,
  onPaste,
  onAIGenerate,
  onAddLink,
  onMarkdownNodeType,
  onEditTable,
  onClose
}) => {
  const store = useMindMapStore();
  const aiEnabled = store.aiSettings?.enabled || false;
  const isGenerating = store.isGenerating || false;

  
  const isMarkdownNode = selectedNode.markdownMeta ? true : false;
  const markdownMeta = selectedNode.markdownMeta;

  const menuItems: MenuItem[] = [
    ...(aiEnabled && onAIGenerate ? [{
      icon: isGenerating ? <Clock size={16} /> : <Bot size={16} />,
      label: isGenerating ? 'AI生成中...' : 'AI子ノード生成',
      action: () => {
        if (!isGenerating) {
          onAIGenerate(selectedNode);
          onClose();
        }
      },
      disabled: isGenerating
    }] : []),
    ...(aiEnabled && onAIGenerate ? [{ type: 'separator' as const }] : []),
    {
      icon: <Copy size={16} />,
      label: 'コピー',
      action: () => {
        onCopy(selectedNode);
        onClose();
      },
      shortcut: 'Ctrl+C'
    },
    {
      icon: <Clipboard size={16} />,
      label: '貼り付け',
      action: () => {
        onPaste(selectedNode.id);
        onClose();
      },
      shortcut: 'Ctrl+V',
      disabled: !store.ui?.clipboard
    },
    { type: 'separator' as const },

    
    ...(isMarkdownNode && onMarkdownNodeType && markdownMeta?.type === 'heading' ? [
      {
        icon: <List size={16} />,
        label: 'リストに変更',
        action: () => {
          onMarkdownNodeType(selectedNode.id, 'unordered-list');
          onClose();
        },
        shortcut: 'Ctrl+M / m'
      },
      { type: 'separator' as const }
    ] : []),

    
    ...((selectedNode as any).kind === 'table' && onEditTable ? [
      {
        icon: <Table size={16} />,
        label: 'テーブルを編集',
        action: () => {
          onEditTable(selectedNode.id);
          onClose();
        }
      },
      { type: 'separator' as const }
    ] : []),

    
    ...(onAddLink ? [{
      icon: <Link size={16} />,
      label: 'リンク追加',
      action: () => {
        onAddLink(selectedNode.id);
        onClose();
      }
    }] : []),
    { type: 'separator' as const },
    {
      icon: <Trash2 size={16} />,
      label: '削除',
      action: () => {
        if (selectedNode.id !== 'root') {
          onDelete(selectedNode.id);
        }
        onClose();
      },
      shortcut: 'Delete',
      disabled: selectedNode.id === 'root',
      danger: true
    }
  ];

  const renderMenuItem = (item: MenuItem, index: number): React.ReactNode => {
    if ('type' in item && item.type === 'separator') {
      return <div key={index} className="menu-separator" />;
    }

    const actionItem = item as MenuItemAction;
    
    return (
      <div
        key={index}
        className={`menu-item ${actionItem.disabled ? 'disabled' : ''} ${actionItem.danger ? 'danger' : ''}`}
        onClick={actionItem.disabled ? undefined : actionItem.action}
      >
        <div className="menu-item-content">
          <span className="menu-icon">{actionItem.icon}</span>
          <span className="menu-label">{actionItem.label}</span>
          {actionItem.shortcut && (
            <span className="menu-shortcut">{actionItem.shortcut}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="menu-items">
      {menuItems.map(renderMenuItem)}
    </div>
  );
};

export default MenuItems;
