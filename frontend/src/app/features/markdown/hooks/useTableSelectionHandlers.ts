import { useCallback } from 'react';
import type { Selection, EditingCell } from '../utils/table-editor/types';

interface UseTableSelectionHandlersProps {
  selection: Selection;
  setSelection: (selection: Selection) => void;
  setEditingCell: (cell: EditingCell | null) => void;
  setContextMenu: (menu: any) => void;
}

export const useTableSelectionHandlers = ({
  selection,
  setSelection,
  setEditingCell,
  setContextMenu,
}: UseTableSelectionHandlersProps) => {

  const handleRowHeaderClick = useCallback((rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null);

    if (e.shiftKey && selection.type === 'rows' && selection.indices.length > 0) {
      const lastIndex = selection.indices[selection.indices.length - 1];
      const start = Math.min(lastIndex, rowIndex);
      const end = Math.max(lastIndex, rowIndex);
      const newIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelection({ type: 'rows', indices: newIndices });
    } else if (e.ctrlKey || e.metaKey) {
      if (selection.type === 'rows') {
        const newIndices = selection.indices.includes(rowIndex)
          ? selection.indices.filter(i => i !== rowIndex)
          : [...selection.indices, rowIndex].sort((a, b) => a - b);
        setSelection(newIndices.length > 0 ? { type: 'rows', indices: newIndices } : { type: 'none' });
      } else {
        setSelection({ type: 'rows', indices: [rowIndex] });
      }
    } else {
      setSelection({ type: 'rows', indices: [rowIndex] });
      setEditingCell(null);
    }
  }, [selection, setSelection, setEditingCell, setContextMenu]);

  const handleRowHeaderContextMenu = useCallback((rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (selection.type !== 'rows' || !selection.indices.includes(rowIndex)) {
      setSelection({ type: 'rows', indices: [rowIndex] });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row', target: rowIndex });
  }, [selection, setSelection, setContextMenu]);

  const handleColumnHeaderClick = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null);

    if (e.shiftKey && selection.type === 'columns' && selection.indices.length > 0) {
      const lastIndex = selection.indices[selection.indices.length - 1];
      const start = Math.min(lastIndex, colIndex);
      const end = Math.max(lastIndex, colIndex);
      const newIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelection({ type: 'columns', indices: newIndices });
    } else if (e.ctrlKey || e.metaKey) {
      if (selection.type === 'columns') {
        const newIndices = selection.indices.includes(colIndex)
          ? selection.indices.filter(i => i !== colIndex)
          : [...selection.indices, colIndex].sort((a, b) => a - b);
        setSelection(newIndices.length > 0 ? { type: 'columns', indices: newIndices } : { type: 'none' });
      } else {
        setSelection({ type: 'columns', indices: [colIndex] });
      }
    } else if (selection.type === 'columns' && selection.indices.length === 1 && selection.indices[0] === colIndex) {
      setEditingCell({ row: -1, col: colIndex });
    } else {
      setSelection({ type: 'columns', indices: [colIndex] });
      setEditingCell(null);
    }
  }, [selection, setSelection, setEditingCell, setContextMenu]);

  const handleColumnHeaderContextMenu = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (selection.type !== 'columns' || !selection.indices.includes(colIndex)) {
      setSelection({ type: 'columns', indices: [colIndex] });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'column', target: colIndex });
  }, [selection, setSelection, setContextMenu]);

  return {
    handleRowHeaderClick,
    handleRowHeaderContextMenu,
    handleColumnHeaderClick,
    handleColumnHeaderContextMenu,
  };
};
