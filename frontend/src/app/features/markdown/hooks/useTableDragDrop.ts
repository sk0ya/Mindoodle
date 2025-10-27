import { useState, useCallback } from 'react';
import type { TableData, Selection } from '../utils/table-editor/types';

interface UseTableDragDropProps {
  tableData: TableData;
  setTableData: (data: TableData) => void;
  selection: Selection;
  setSelection: (selection: Selection) => void;
}

export const useTableDragDrop = ({
  tableData,
  setTableData,
  selection,
  setSelection,
}: UseTableDragDropProps) => {
  const [dragType, setDragType] = useState<'select' | 'reorder' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleRowDragStart = useCallback((rowIndex: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowIndex.toString());
    setDragType('reorder');

    if (selection.type !== 'rows' || !selection.indices.includes(rowIndex)) {
      setSelection({ type: 'rows', indices: [rowIndex] });
    }
  }, [selection, setSelection]);

  const handleRowDragOver = useCallback((rowIndex: number, e: React.DragEvent) => {
    if (dragType === 'reorder') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(rowIndex);
    }
  }, [dragType]);

  const handleRowDrop = useCallback((targetRowIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragType !== 'reorder' || selection.type !== 'rows') return;

    const selectedIndices = [...selection.indices].sort((a, b) => a - b);
    const newRows = [...tableData.rows];
    const movedRows = selectedIndices.map(idx => newRows[idx]);

    [...selectedIndices].reverse().forEach(idx => {
      newRows.splice(idx, 1);
    });

    let insertIndex = targetRowIndex;
    selectedIndices.forEach(idx => {
      if (idx < targetRowIndex) insertIndex--;
    });

    newRows.splice(insertIndex, 0, ...movedRows);

    setTableData({ ...tableData, rows: newRows });
    setDragType(null);
    setDragOverIndex(null);

    const newIndices = movedRows.map((_, i) => insertIndex + i);
    setSelection({ type: 'rows', indices: newIndices });
  }, [dragType, selection, tableData, setTableData, setSelection]);

  const handleColumnDragStart = useCallback((colIndex: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colIndex.toString());
    setDragType('reorder');

    if (selection.type !== 'columns' || !selection.indices.includes(colIndex)) {
      setSelection({ type: 'columns', indices: [colIndex] });
    }
  }, [selection, setSelection]);

  const handleColumnDragOver = useCallback((colIndex: number, e: React.DragEvent) => {
    if (dragType === 'reorder') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(colIndex);
    }
  }, [dragType]);

  const handleColumnDrop = useCallback((targetColIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragType !== 'reorder' || selection.type !== 'columns') return;

    const selectedIndices = [...selection.indices].sort((a, b) => a - b);
    const newHeaders = [...tableData.headers];
    const movedHeaders = selectedIndices.map(idx => newHeaders[idx]);

    [...selectedIndices].reverse().forEach(idx => {
      newHeaders.splice(idx, 1);
    });

    let insertIndex = targetColIndex;
    selectedIndices.forEach(idx => {
      if (idx < targetColIndex) insertIndex--;
    });

    newHeaders.splice(insertIndex, 0, ...movedHeaders);

    const newRows = tableData.rows.map(row => {
      const newRow = [...row];
      const movedCells = selectedIndices.map(idx => newRow[idx]);
      [...selectedIndices].reverse().forEach(idx => {
        newRow.splice(idx, 1);
      });
      newRow.splice(insertIndex, 0, ...movedCells);
      return newRow;
    });

    setTableData({ headers: newHeaders, rows: newRows });
    setDragType(null);
    setDragOverIndex(null);

    const newIndices = movedHeaders.map((_, i) => insertIndex + i);
    setSelection({ type: 'columns', indices: newIndices });
  }, [dragType, selection, tableData, setTableData, setSelection]);

  const resetDrag = useCallback(() => {
    setDragType(null);
    setDragOverIndex(null);
  }, []);

  return {
    dragType,
    dragOverIndex,
    handleRowDragStart,
    handleRowDragOver,
    handleRowDrop,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDrop,
    resetDrag,
  };
};
