/**
 * Hook for table editing operations
 */

import { useState, useCallback } from 'react';
import { TableData, TableCell, Selection, ClipboardData } from '../utils/table-editor/types';
import { sanitizeInput } from '../utils/table-editor/tableSerializer';

interface UseTableEditorProps {
  tableData: TableData;
  setTableData: (data: TableData) => void;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  setContextMenu: (menu: any) => void;
}

export function useTableEditor({
  tableData,
  setTableData,
  selection,
  setSelection,
  setContextMenu,
}: UseTableEditorProps) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const handleHeaderChange = useCallback(
    (index: number, value: string) => {
      const newHeaders = [...tableData.headers];
      newHeaders[index] = { value: sanitizeInput(value) };
      setTableData({ ...tableData, headers: newHeaders });
    },
    [tableData, setTableData]
  );

  const handleCellChange = useCallback(
    (rowIndex: number, cellIndex: number, value: string) => {
      const newRows = tableData.rows.map((row, rIdx) =>
        rIdx === rowIndex
          ? row.map((cell, cIdx) => (cIdx === cellIndex ? { value: sanitizeInput(value) } : cell))
          : row
      );
      setTableData({ ...tableData, rows: newRows });
    },
    [tableData, setTableData]
  );

  const handleAddRow = useCallback(() => {
    const newRow = tableData.headers.map(() => ({ value: '' }));
    setTableData({ ...tableData, rows: [...tableData.rows, newRow] });
    setSelection({ type: 'none' });
  }, [tableData, setTableData, setSelection]);

  const handleAddColumn = useCallback(() => {
    const newHeaders = [...tableData.headers, { value: `Header ${tableData.headers.length + 1}` }];
    const newRows = tableData.rows.map(row => [...row, { value: '' }]);
    setTableData({ headers: newHeaders, rows: newRows });
    setSelection({ type: 'none' });
  }, [tableData, setTableData, setSelection]);

  const handleDeleteSelection = useCallback(() => {
    if (selection.type === 'rows') {
      if (tableData.rows.length - selection.indices.length < 1) return;
      const newRows = tableData.rows.filter((_, idx) => !selection.indices.includes(idx));
      setTableData({ ...tableData, rows: newRows });
      setSelection({ type: 'none' });
    } else if (selection.type === 'columns') {
      if (tableData.headers.length - selection.indices.length < 1) return;
      const newHeaders = tableData.headers.filter((_, idx) => !selection.indices.includes(idx));
      const newRows = tableData.rows.map(row => row.filter((_, idx) => !selection.indices.includes(idx)));
      setTableData({ headers: newHeaders, rows: newRows });
      setSelection({ type: 'none' });
    }
    setContextMenu(null);
  }, [selection, tableData, setTableData, setSelection, setContextMenu]);

  const handleCopy = useCallback(() => {
    if (selection.type === 'rows') {
      const copiedRows = selection.indices.map(idx => tableData.rows[idx]);
      setClipboard({ type: 'rows', data: copiedRows, indices: selection.indices });
    } else if (selection.type === 'columns') {
      const copiedColumns = selection.indices.map(colIdx => tableData.headers[colIdx]);
      setClipboard({ type: 'columns', data: copiedColumns, indices: selection.indices });
    } else if (selection.type === 'range') {
      const copiedCells: TableCell[][] = [];
      for (let r = selection.startRow; r <= selection.endRow; r++) {
        const rowCells: TableCell[] = [];
        for (let c = selection.startCol; c <= selection.endCol; c++) {
          rowCells.push(tableData.rows[r][c]);
        }
        copiedCells.push(rowCells);
      }
      setClipboard({ type: 'cells', data: copiedCells });
    }
    setContextMenu(null);
  }, [selection, tableData, setContextMenu]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    if (clipboard.type === 'rows' && selection.type === 'rows' && selection.indices.length > 0) {
      const targetIndex = Math.min(...selection.indices);
      const newRows = [...tableData.rows];
      (clipboard.data as TableCell[][]).forEach((row, idx) => {
        newRows.splice(targetIndex + idx, 0, [...row]);
      });
      setTableData({ ...tableData, rows: newRows });
    } else if (clipboard.type === 'columns' && selection.type === 'columns' && selection.indices.length > 0) {
      const targetIndex = Math.min(...selection.indices);
      const copiedHeaders = clipboard.data as TableCell[];
      const newHeaders = [...tableData.headers];
      copiedHeaders.forEach((header, idx) => {
        newHeaders.splice(targetIndex + idx, 0, { ...header });
      });
      const newRows = tableData.rows.map(row => {
        const newRow = [...row];
        copiedHeaders.forEach((_, idx) => {
          newRow.splice(targetIndex + idx, 0, { value: '' });
        });
        return newRow;
      });
      setTableData({ headers: newHeaders, rows: newRows });
    } else if (clipboard.type === 'cells' && selection.type === 'cell') {
      const copiedCells = clipboard.data as TableCell[][];
      const newRows = [...tableData.rows];
      copiedCells.forEach((rowCells, rIdx) => {
        const targetRow = selection.row + rIdx;
        if (targetRow < newRows.length) {
          rowCells.forEach((cell, cIdx) => {
            const targetCol = selection.col + cIdx;
            if (targetCol < newRows[targetRow].length) {
              newRows[targetRow][targetCol] = { ...cell };
            }
          });
        }
      });
      setTableData({ ...tableData, rows: newRows });
    }
    setContextMenu(null);
  }, [clipboard, selection, tableData, setTableData, setContextMenu]);

  const handleInsertRowAbove = useCallback(() => {
    if (selection.type === 'rows' && selection.indices.length > 0) {
      const targetIndex = Math.min(...selection.indices);
      const newRow = tableData.headers.map(() => ({ value: '' }));
      const newRows = [...tableData.rows];
      newRows.splice(targetIndex, 0, newRow);
      setTableData({ ...tableData, rows: newRows });
    }
    setContextMenu(null);
  }, [selection, tableData, setTableData, setContextMenu]);

  const handleInsertRowBelow = useCallback(() => {
    if (selection.type === 'rows' && selection.indices.length > 0) {
      const targetIndex = Math.max(...selection.indices) + 1;
      const newRow = tableData.headers.map(() => ({ value: '' }));
      const newRows = [...tableData.rows];
      newRows.splice(targetIndex, 0, newRow);
      setTableData({ ...tableData, rows: newRows });
    }
    setContextMenu(null);
  }, [selection, tableData, setTableData, setContextMenu]);

  const handleInsertColumnLeft = useCallback(() => {
    if (selection.type === 'columns' && selection.indices.length > 0) {
      const targetIndex = Math.min(...selection.indices);
      const newHeaders = [...tableData.headers];
      newHeaders.splice(targetIndex, 0, { value: `Header ${tableData.headers.length + 1}` });
      const newRows = tableData.rows.map(row => {
        const newRow = [...row];
        newRow.splice(targetIndex, 0, { value: '' });
        return newRow;
      });
      setTableData({ headers: newHeaders, rows: newRows });
    }
    setContextMenu(null);
  }, [selection, tableData, setTableData, setContextMenu]);

  const handleInsertColumnRight = useCallback(() => {
    if (selection.type === 'columns' && selection.indices.length > 0) {
      const targetIndex = Math.max(...selection.indices) + 1;
      const newHeaders = [...tableData.headers];
      newHeaders.splice(targetIndex, 0, { value: `Header ${tableData.headers.length + 1}` });
      const newRows = tableData.rows.map(row => {
        const newRow = [...row];
        newRow.splice(targetIndex, 0, { value: '' });
        return newRow;
      });
      setTableData({ headers: newHeaders, rows: newRows });
    }
    setContextMenu(null);
  }, [selection, tableData, setTableData, setContextMenu]);

  return {
    clipboard,
    handleHeaderChange,
    handleCellChange,
    handleAddRow,
    handleAddColumn,
    handleDeleteSelection,
    handleCopy,
    handlePaste,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleInsertColumnLeft,
    handleInsertColumnRight,
  };
}
