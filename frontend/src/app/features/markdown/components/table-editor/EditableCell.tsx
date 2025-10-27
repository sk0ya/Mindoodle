import React from 'react';
import type { Cell, EditingCell } from '../../utils/table-editor/types';

interface EditableCellProps {
  rowIndex: number;
  cellIndex: number;
  cell: Cell;
  editingCell: EditingCell | null;
  isSelected: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  rowIndex,
  cellIndex,
  cell,
  editingCell,
  isSelected,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onChange,
  onBlur,
}) => {
  const isEditing = editingCell?.row === rowIndex && editingCell?.col === cellIndex;

  return (
    <td
      className={isSelected ? 'selected-cell' : ''}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        <input
          type="text"
          value={cell.value}
          onChange={e => onChange(e.target.value)}
          placeholder=" "
          className="cell-input editing"
          autoFocus
          onBlur={onBlur}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Tab') {
              onBlur();
            }
          }}
        />
      ) : (
        <div className="cell-display">{cell.value || ''}</div>
      )}
    </td>
  );
};
