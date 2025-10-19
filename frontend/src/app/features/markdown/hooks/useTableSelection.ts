/**
 * Hook for managing table selection state and operations
 */

import { useState } from 'react';
import { Selection, EditingCell } from '../utils/table-editor/types';

export function useTableSelection() {
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);

  const isCellInSelection = (rowIndex: number, cellIndex: number): boolean => {
    if (selection.type === 'rows' && selection.indices.includes(rowIndex)) return true;
    if (selection.type === 'columns' && selection.indices.includes(cellIndex)) return true;
    if (selection.type === 'cell' && selection.row === rowIndex && selection.col === cellIndex) return true;
    if (selection.type === 'range') {
      return (
        rowIndex >= selection.startRow &&
        rowIndex <= selection.endRow &&
        cellIndex >= selection.startCol &&
        cellIndex <= selection.endCol
      );
    }
    return false;
  };

  const clearSelection = () => {
    setSelection({ type: 'none' });
    setEditingCell(null);
  };

  return {
    selection,
    setSelection,
    editingCell,
    setEditingCell,
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    isCellInSelection,
    clearSelection,
  };
}
