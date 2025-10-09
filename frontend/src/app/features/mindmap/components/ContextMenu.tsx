import React, { useCallback, memo } from 'react';
import { MindMapNode } from '@shared/types';
import MenuItems from './contextmenu/MenuItems';
import ContextMenuStyles from '../styles/ContextMenuStyles';
import { useClickOutside } from '@shared/utils';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface Position {
  x: number;
  y: number;
}

interface ContextMenuProps {
  visible: boolean;
  position: Position;
  selectedNode: MindMapNode | null;
  onDelete: (nodeId: string) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onAIGenerate?: (node: MindMapNode) => void;
  onAddLink?: (nodeId: string) => void;
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onEditTable?: (nodeId: string) => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  position,
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
  // メニュー外クリックで閉じる
  const menuRef = useClickOutside<HTMLDivElement>(onClose, visible);

  // ESCキーで閉じる
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEventListener('keydown', handleKeyDown, { target: document, enabled: visible });

  if (!visible || !selectedNode) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 2000
      }}
    >
      <MenuItems
        selectedNode={selectedNode}
        onDelete={onDelete}
        onCopy={onCopy}
        onPaste={onPaste}
        onAIGenerate={onAIGenerate}
        onAddLink={onAddLink}
        onMarkdownNodeType={onMarkdownNodeType}
        onEditTable={onEditTable}
        onClose={onClose}
      />
      
      <ContextMenuStyles />
    </div>
  );
};

export default memo(ContextMenu);
