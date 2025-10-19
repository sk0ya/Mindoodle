/**
 * Context menu component for table editor
 */

import React from 'react';
import { Copy, ClipboardPaste, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { ContextMenu, ClipboardData } from '../../utils/table-editor/types';

interface TableContextMenuProps {
  contextMenu: ContextMenu;
  clipboard: ClipboardData | null;
  canDelete: boolean;
  menuRef: React.RefObject<HTMLDivElement>;
  onCopy: () => void;
  onPaste: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColumnLeft: () => void;
  onInsertColumnRight: () => void;
  onDelete: () => void;
}

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  contextMenu,
  clipboard,
  canDelete,
  menuRef,
  onCopy,
  onPaste,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDelete,
}) => {
  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        zIndex: 10001,
      }}
    >
      {contextMenu.type === 'row' && (
        <>
          <button className="context-menu-item" onClick={onCopy}>
            <Copy size={14} />
            <span>コピー</span>
            <span className="shortcut">Ctrl+C</span>
          </button>
          {clipboard && (
            <button className="context-menu-item" onClick={onPaste}>
              <ClipboardPaste size={14} />
              <span>ペースト</span>
              <span className="shortcut">Ctrl+V</span>
            </button>
          )}
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={onInsertRowAbove}>
            <ArrowUp size={14} />
            <span>上に行を挿入</span>
          </button>
          <button className="context-menu-item" onClick={onInsertRowBelow}>
            <ArrowDown size={14} />
            <span>下に行を挿入</span>
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={onDelete} disabled={!canDelete}>
            <Trash2 size={14} />
            <span>削除</span>
            <span className="shortcut">Del</span>
          </button>
        </>
      )}
      {contextMenu.type === 'column' && (
        <>
          <button className="context-menu-item" onClick={onCopy}>
            <Copy size={14} />
            <span>コピー</span>
            <span className="shortcut">Ctrl+C</span>
          </button>
          {clipboard && (
            <button className="context-menu-item" onClick={onPaste}>
              <ClipboardPaste size={14} />
              <span>ペースト</span>
              <span className="shortcut">Ctrl+V</span>
            </button>
          )}
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={onInsertColumnLeft}>
            <ArrowLeft size={14} />
            <span>左に列を挿入</span>
          </button>
          <button className="context-menu-item" onClick={onInsertColumnRight}>
            <ArrowRight size={14} />
            <span>右に列を挿入</span>
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={onDelete} disabled={!canDelete}>
            <Trash2 size={14} />
            <span>削除</span>
            <span className="shortcut">Del</span>
          </button>
        </>
      )}
    </div>
  );
};
