import React, { useCallback, memo } from 'react';
import { MindMapNode, type Position } from '@shared/types';
import type { CommandContext } from '@commands/system/types';
import type { CommandRegistryImpl } from '@commands/system/registry';
import MenuItems from './contextmenu/MenuItems';
import ContextMenuStyles from '../styles/ContextMenuStyles';
import { useClickOutside } from '@shared/utils';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface ContextMenuProps {
  visible: boolean;
  position: Position;
  selectedNode: MindMapNode | null;
  onDelete: (nodeId: string) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onAddLink?: (nodeId: string) => void;
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onEditTable?: (nodeId: string) => void;
  onConvertToMap?: (nodeId: string) => void;
  commandRegistry?: CommandRegistryImpl;
  commandContext?: CommandContext;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  position,
  selectedNode,
  onDelete,
  onCopy,
  onPaste,
  onAddLink,
  onMarkdownNodeType,
  onEditTable,
  onConvertToMap,
  commandRegistry,
  commandContext,
  onClose
}) => {
  
  const menuRef = useClickOutside<HTMLDivElement>(onClose, visible);

  
  const handleKeyDown = useCallback((event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') {
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
        onAddLink={onAddLink}
        onMarkdownNodeType={onMarkdownNodeType}
        onEditTable={onEditTable}
        onConvertToMap={onConvertToMap}
        commandRegistry={commandRegistry}
        commandContext={commandContext}
        onClose={onClose}
      />
      
      <ContextMenuStyles />
    </div>
  );
};

export default memo(ContextMenu);
