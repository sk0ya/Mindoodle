import React from 'react';
import type { Header, EditingCell } from '../../utils/table-editor/types';

interface TableHeaderCellProps {
  index: number;
  header: Header;
  editingCell: EditingCell | null;
  isSelected: boolean;
  isDragOver: boolean;
  isDraggable: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({
  index,
  header,
  editingCell,
  isSelected,
  isDragOver,
  isDraggable,
  onClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onChange,
  onBlur,
}) => {
  const isEditing = editingCell?.row === -1 && editingCell?.col === index;

  return (
    <th
      className={`column-header ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isEditing ? (
        <input
          type="text"
          value={header.value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Header ${index + 1}`}
          className="header-input editing"
          autoFocus
          onBlur={onBlur}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className="header-display">{header.value || `Header ${index + 1}`}</div>
      )}
    </th>
  );
};
