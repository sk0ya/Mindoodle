import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Copy, ClipboardPaste, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface TableEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (markdown: string) => void;
  initialMarkdown?: string;
}

interface TableCell {
  value: string;
}

interface TableData {
  headers: TableCell[];
  rows: TableCell[][];
}

type Selection =
  | { type: 'none' }
  | { type: 'rows'; indices: number[] }
  | { type: 'columns'; indices: number[] }
  | { type: 'cell'; row: number; col: number }
  | { type: 'range'; startRow: number; startCol: number; endRow: number; endCol: number };

interface ContextMenu {
  x: number;
  y: number;
  type: 'row' | 'column' | 'cell' | 'range';
  target?: number | number[];
}

interface ClipboardData {
  type: 'cells' | 'rows' | 'columns';
  data: TableCell[][] | TableCell[];
  indices?: number[];
}

/**
 * Parse markdown table to structured data
 */
function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return null;

  // Parse headers (first line)
  const headerLine = lines[0].trim();
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0)
    .map(value => ({ value }));

  if (headers.length === 0) return null;

  // Skip separator line (second line)
  // Parse data rows (remaining lines)
  const rows: TableCell[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    const cells = line
      .split('|')
      .map(cell => cell.trim())
      .filter((_, idx) => idx > 0 && idx <= headers.length)
      .map(value => ({ value }));

    while (cells.length < headers.length) {
      cells.push({ value: '' });
    }
    rows.push(cells.slice(0, headers.length));
  }

  return { headers, rows };
}

/**
 * Convert structured data to markdown table
 */
function toMarkdownTable(data: TableData): string {
  const { headers, rows } = data;
  const headerLine = '| ' + headers.map(h => h.value || ' ').join(' | ') + ' |';
  const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const dataLines = rows.map(row =>
    '| ' + row.map(cell => cell.value || ' ').join(' | ') + ' |'
  );
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

export const TableEditorModal: React.FC<TableEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMarkdown = ''
}) => {
  const [tableData, setTableData] = useState<TableData>({ headers: [], rows: [] });
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [dragType, setDragType] = useState<'select' | 'reorder' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialMarkdown) {
      const parsed = parseMarkdownTable(initialMarkdown);
      if (parsed) {
        setTableData(parsed);
        setError(null);
      } else {
        setTableData({
          headers: [{ value: 'Header 1' }, { value: 'Header 2' }, { value: 'Header 3' }],
          rows: [
            [{ value: '' }, { value: '' }, { value: '' }],
            [{ value: '' }, { value: '' }, { value: '' }]
          ]
        });
        setError('テーブルの解析に失敗しました。デフォルトのテーブルを作成します。');
      }
    } else {
      setTableData({
        headers: [{ value: 'Header 1' }, { value: 'Header 2' }, { value: 'Header 3' }],
        rows: [
          [{ value: '' }, { value: '' }, { value: '' }],
          [{ value: '' }, { value: '' }, { value: '' }]
        ]
      });
      setError(null);
    }
    setSelection({ type: 'none' });
  }, [isOpen, initialMarkdown]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...tableData.headers];
    newHeaders[index] = { value };
    setTableData({ ...tableData, headers: newHeaders });
  };

  const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
    const newRows = tableData.rows.map((row, rIdx) =>
      rIdx === rowIndex
        ? row.map((cell, cIdx) => cIdx === cellIndex ? { value } : cell)
        : row
    );
    setTableData({ ...tableData, rows: newRows });
  };

  const handleAddRow = () => {
    const newRow = tableData.headers.map(() => ({ value: '' }));
    setTableData({ ...tableData, rows: [...tableData.rows, newRow] });
    setSelection({ type: 'none' });
  };

  const handleAddColumn = () => {
    const newHeaders = [...tableData.headers, { value: `Header ${tableData.headers.length + 1}` }];
    const newRows = tableData.rows.map(row => [...row, { value: '' }]);
    setTableData({ headers: newHeaders, rows: newRows });
    setSelection({ type: 'none' });
  };

  const handleDeleteSelection = () => {
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
  };

  const handleCopy = () => {
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
  };

  const handlePaste = () => {
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
  };

  const handleInsertRowAbove = () => {
    if (selection.type === 'rows' && selection.indices.length > 0) {
      const targetIndex = Math.min(...selection.indices);
      const newRow = tableData.headers.map(() => ({ value: '' }));
      const newRows = [...tableData.rows];
      newRows.splice(targetIndex, 0, newRow);
      setTableData({ ...tableData, rows: newRows });
    }
    setContextMenu(null);
  };

  const handleInsertRowBelow = () => {
    if (selection.type === 'rows' && selection.indices.length > 0) {
      const targetIndex = Math.max(...selection.indices) + 1;
      const newRow = tableData.headers.map(() => ({ value: '' }));
      const newRows = [...tableData.rows];
      newRows.splice(targetIndex, 0, newRow);
      setTableData({ ...tableData, rows: newRows });
    }
    setContextMenu(null);
  };

  const handleInsertColumnLeft = () => {
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
  };

  const handleInsertColumnRight = () => {
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
  };

  const handleRowHeaderClick = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null);

    if (e.shiftKey && selection.type === 'rows' && selection.indices.length > 0) {
      // Shift+クリック: 範囲選択
      const lastIndex = selection.indices[selection.indices.length - 1];
      const start = Math.min(lastIndex, rowIndex);
      const end = Math.max(lastIndex, rowIndex);
      const newIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelection({ type: 'rows', indices: newIndices });
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+クリック: 追加選択
      if (selection.type === 'rows') {
        const newIndices = selection.indices.includes(rowIndex)
          ? selection.indices.filter(i => i !== rowIndex)
          : [...selection.indices, rowIndex].sort((a, b) => a - b);
        setSelection(newIndices.length > 0 ? { type: 'rows', indices: newIndices } : { type: 'none' });
      } else {
        setSelection({ type: 'rows', indices: [rowIndex] });
      }
    } else {
      // 通常クリック
      setSelection({ type: 'rows', indices: [rowIndex] });
      setEditingCell(null);
    }
  };

  const handleRowHeaderContextMenu = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();

    // 右クリックされた行が選択されていない場合は、その行を選択
    if (selection.type !== 'rows' || !selection.indices.includes(rowIndex)) {
      setSelection({ type: 'rows', indices: [rowIndex] });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'row',
      target: rowIndex
    });
  };

  const handleColumnHeaderClick = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null);

    if (e.shiftKey && selection.type === 'columns' && selection.indices.length > 0) {
      // Shift+クリック: 範囲選択
      const lastIndex = selection.indices[selection.indices.length - 1];
      const start = Math.min(lastIndex, colIndex);
      const end = Math.max(lastIndex, colIndex);
      const newIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelection({ type: 'columns', indices: newIndices });
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+クリック: 追加選択
      if (selection.type === 'columns') {
        const newIndices = selection.indices.includes(colIndex)
          ? selection.indices.filter(i => i !== colIndex)
          : [...selection.indices, colIndex].sort((a, b) => a - b);
        setSelection(newIndices.length > 0 ? { type: 'columns', indices: newIndices } : { type: 'none' });
      } else {
        setSelection({ type: 'columns', indices: [colIndex] });
      }
    } else if (selection.type === 'columns' && selection.indices.length === 1 && selection.indices[0] === colIndex) {
      // 既に選択されている列をクリック → 編集モードに入る
      setEditingCell({ row: -1, col: colIndex });
    } else {
      // 新しい列を選択
      setSelection({ type: 'columns', indices: [colIndex] });
      setEditingCell(null);
    }
  };

  const handleColumnHeaderContextMenu = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();

    // 右クリックされた列が選択されていない場合は、その列を選択
    if (selection.type !== 'columns' || !selection.indices.includes(colIndex)) {
      setSelection({ type: 'columns', indices: [colIndex] });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'column',
      target: colIndex
    });
  };

  const handleCellMouseDown = (rowIndex: number, cellIndex: number) => {
    // 編集モード中のセルをクリック → 何もしない
    if (editingCell?.row === rowIndex && editingCell?.col === cellIndex) {
      return;
    }

    // ドラッグ開始
    setIsDragging(true);
    setDragStart({ row: rowIndex, col: cellIndex });
    setSelection({ type: 'cell', row: rowIndex, col: cellIndex });
    setEditingCell(null);
  };

  const handleCellMouseEnter = (rowIndex: number, cellIndex: number) => {
    if (!isDragging || !dragStart) return;

    // 範囲選択を更新
    const startRow = Math.min(dragStart.row, rowIndex);
    const endRow = Math.max(dragStart.row, rowIndex);
    const startCol = Math.min(dragStart.col, cellIndex);
    const endCol = Math.max(dragStart.col, cellIndex);

    setSelection({
      type: 'range',
      startRow,
      startCol,
      endRow,
      endCol
    });
  };

  const handleRowHeaderDragStart = (rowIndex: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowIndex.toString());
    setDragType('reorder');

    // ドラッグ中の行が選択されていない場合は選択
    if (selection.type !== 'rows' || !selection.indices.includes(rowIndex)) {
      setSelection({ type: 'rows', indices: [rowIndex] });
    }
  };

  const handleRowHeaderDragOver = (rowIndex: number, e: React.DragEvent) => {
    if (dragType === 'reorder') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(rowIndex);
    }
  };

  const handleRowHeaderDrop = (targetRowIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragType !== 'reorder' || selection.type !== 'rows') return;

    const selectedIndices = [...selection.indices].sort((a, b) => a - b);

    // 選択された行を移動
    const newRows = [...tableData.rows];
    const movedRows = selectedIndices.map(idx => newRows[idx]);

    // 元の位置から削除（逆順で削除して、インデックスのずれを防ぐ）
    [...selectedIndices].reverse().forEach(idx => {
      newRows.splice(idx, 1);
    });

    // 新しい位置を計算
    let insertIndex = targetRowIndex;
    selectedIndices.forEach(idx => {
      if (idx < targetRowIndex) insertIndex--;
    });

    // 新しい位置に挿入
    newRows.splice(insertIndex, 0, ...movedRows);

    setTableData({ ...tableData, rows: newRows });
    setDragType(null);
    setDragOverIndex(null);

    // 選択を更新
    const newIndices = movedRows.map((_, i) => insertIndex + i);
    setSelection({ type: 'rows', indices: newIndices });
  };

  const handleColumnHeaderDragStart = (colIndex: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colIndex.toString());
    setDragType('reorder');

    // ドラッグ中の列が選択されていない場合は選択
    if (selection.type !== 'columns' || !selection.indices.includes(colIndex)) {
      setSelection({ type: 'columns', indices: [colIndex] });
    }
  };

  const handleColumnHeaderDragOver = (colIndex: number, e: React.DragEvent) => {
    if (dragType === 'reorder') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(colIndex);
    }
  };

  const handleColumnHeaderDrop = (targetColIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragType !== 'reorder' || selection.type !== 'columns') return;

    const selectedIndices = [...selection.indices].sort((a, b) => a - b);

    // 選択された列を移動
    const newHeaders = [...tableData.headers];
    const movedHeaders = selectedIndices.map(idx => newHeaders[idx]);

    // 元の位置から削除
    [...selectedIndices].reverse().forEach(idx => {
      newHeaders.splice(idx, 1);
    });

    // 新しい位置を計算
    let insertIndex = targetColIndex;
    selectedIndices.forEach(idx => {
      if (idx < targetColIndex) insertIndex--;
    });

    // 新しい位置に挿入
    newHeaders.splice(insertIndex, 0, ...movedHeaders);

    // 行のデータも同様に移動
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

    // 選択を更新
    const newIndices = movedHeaders.map((_, i) => insertIndex + i);
    setSelection({ type: 'columns', indices: newIndices });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // 単一セルの場合はダブルクリックで編集できるように
      if (selection.type === 'cell') {
        // 既に選択されているセルをクリックした場合は編集モードに
        const isSameCell =
          dragStart &&
          selection.type === 'cell' &&
          selection.row === dragStart.row &&
          selection.col === dragStart.col;

        if (isSameCell) {
          // 単一セル選択のまま（次のクリックで編集モードへ）
        }
      }
      setDragStart(null);
    }

    if (dragType === 'reorder') {
      setDragType(null);
      setDragOverIndex(null);
    }
  };

  const handleCellDoubleClick = (rowIndex: number, cellIndex: number) => {
    // ダブルクリックで即座に編集モードへ
    setEditingCell({ row: rowIndex, col: cellIndex });
    setSelection({ type: 'none' });
  };

  // セルが選択範囲内かチェック
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 編集モード中はキーボードショートカットを無効化
    if (editingCell) return;

    // Stop propagation to prevent vim keybindings from being triggered
    e.stopPropagation();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

    // Delete: 選択を削除
    if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrlOrCmd) {
      e.preventDefault();
      if (selection.type === 'rows' || selection.type === 'columns') {
        handleDeleteSelection();
      }
    }

    // Ctrl/Cmd+C: コピー
    if (e.key === 'c' && ctrlOrCmd && !e.shiftKey) {
      e.preventDefault();
      handleCopy();
    }

    // Ctrl/Cmd+V: ペースト
    if (e.key === 'v' && ctrlOrCmd && !e.shiftKey) {
      e.preventDefault();
      handlePaste();
    }

    // Ctrl/Cmd+X: カット
    if (e.key === 'x' && ctrlOrCmd && !e.shiftKey) {
      e.preventDefault();
      handleCopy();
      handleDeleteSelection();
    }

    // Escape: 選択解除/コンテキストメニューを閉じる
    if (e.key === 'Escape') {
      e.preventDefault();
      setSelection({ type: 'none' });
      setContextMenu(null);
    }
  };

  const handleSave = () => {
    const markdown = toMarkdownTable(tableData);
    onSave(markdown);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  const canDelete =
    (selection.type === 'rows' && tableData.rows.length - selection.indices.length >= 1) ||
    (selection.type === 'columns' && tableData.headers.length - selection.indices.length >= 1);

  return (
    <div className="table-editor-modal-overlay" onClick={handleCancel} onMouseUp={handleMouseUp}>
      <div
        className="table-editor-modal"
        onClick={e => e.stopPropagation()}
        onMouseUp={handleMouseUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="modal-header">
          <div className="header-left">
            <h2>テーブルを編集</h2>
            {selection.type !== 'none' && canDelete && (
              <button className="delete-selection-btn" onClick={handleDeleteSelection}>
                <Trash2 size={16} />
                <span>
                  {selection.type === 'rows'
                    ? `${selection.indices.length}行を削除`
                    : selection.type === 'columns'
                    ? `${selection.indices.length}列を削除`
                    : '削除'}
                </span>
              </button>
            )}
          </div>
          <button className="close-button" onClick={handleCancel} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="modal-body">
          <div className="table-container">
            <table className="editable-table">
              <thead>
                <tr>
                  <th className="corner-cell"></th>
                  {tableData.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className={`column-header ${
                        selection.type === 'columns' && selection.indices.includes(idx) ? 'selected' : ''
                      } ${dragOverIndex === idx && dragType === 'reorder' ? 'drag-over' : ''}`}
                      onClick={(e) => handleColumnHeaderClick(idx, e)}
                      onContextMenu={(e) => handleColumnHeaderContextMenu(idx, e)}
                      draggable={selection.type === 'columns' && selection.indices.includes(idx)}
                      onDragStart={(e) => handleColumnHeaderDragStart(idx, e)}
                      onDragOver={(e) => handleColumnHeaderDragOver(idx, e)}
                      onDrop={(e) => handleColumnHeaderDrop(idx, e)}
                    >
                      {editingCell?.row === -1 && editingCell?.col === idx ? (
                        <input
                          type="text"
                          value={header.value}
                          onChange={e => handleHeaderChange(idx, e.target.value)}
                          placeholder={`Header ${idx + 1}`}
                          className="header-input editing"
                          autoFocus
                          onBlur={() => setEditingCell(null)}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div className="header-display">
                          {header.value || `Header ${idx + 1}`}
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="add-column-header">
                    <button
                      className="add-column-btn"
                      onClick={handleAddColumn}
                      aria-label="列を追加"
                      title="列を追加"
                    >
                      <Plus size={16} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td
                      className={`row-header ${
                        selection.type === 'rows' && selection.indices.includes(rowIdx) ? 'selected' : ''
                      } ${dragOverIndex === rowIdx && dragType === 'reorder' ? 'drag-over' : ''}`}
                      onClick={(e) => handleRowHeaderClick(rowIdx, e)}
                      onContextMenu={(e) => handleRowHeaderContextMenu(rowIdx, e)}
                      draggable={selection.type === 'rows' && selection.indices.includes(rowIdx)}
                      onDragStart={(e) => handleRowHeaderDragStart(rowIdx, e)}
                      onDragOver={(e) => handleRowHeaderDragOver(rowIdx, e)}
                      onDrop={(e) => handleRowHeaderDrop(rowIdx, e)}
                    >
                      {rowIdx + 1}
                    </td>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={isCellInSelection(rowIdx, cellIdx) ? 'selected-cell' : ''}
                        onMouseDown={() => handleCellMouseDown(rowIdx, cellIdx)}
                        onMouseEnter={() => handleCellMouseEnter(rowIdx, cellIdx)}
                        onDoubleClick={() => handleCellDoubleClick(rowIdx, cellIdx)}
                      >
                        {editingCell?.row === rowIdx && editingCell?.col === cellIdx ? (
                          <input
                            type="text"
                            value={cell.value}
                            onChange={e => handleCellChange(rowIdx, cellIdx, e.target.value)}
                            placeholder=" "
                            className="cell-input editing"
                            autoFocus
                            onBlur={() => setEditingCell(null)}
                          />
                        ) : (
                          <div className="cell-display">
                            {cell.value || ' '}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="empty-cell"></td>
                  </tr>
                ))}
                <tr className="add-row-tr">
                  <td colSpan={tableData.headers.length + 2}>
                    <button
                      className="add-row-btn"
                      onClick={handleAddRow}
                      aria-label="行を追加"
                    >
                      <Plus size={16} />
                      <span>行を追加</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              zIndex: 10001
            }}
          >
            {contextMenu.type === 'row' && (
              <>
                <button className="context-menu-item" onClick={handleCopy}>
                  <Copy size={14} />
                  <span>コピー</span>
                  <span className="shortcut">Ctrl+C</span>
                </button>
                {clipboard && (
                  <button className="context-menu-item" onClick={handlePaste}>
                    <ClipboardPaste size={14} />
                    <span>ペースト</span>
                    <span className="shortcut">Ctrl+V</span>
                  </button>
                )}
                <div className="context-menu-divider" />
                <button className="context-menu-item" onClick={handleInsertRowAbove}>
                  <ArrowUp size={14} />
                  <span>上に行を挿入</span>
                </button>
                <button className="context-menu-item" onClick={handleInsertRowBelow}>
                  <ArrowDown size={14} />
                  <span>下に行を挿入</span>
                </button>
                <div className="context-menu-divider" />
                <button
                  className="context-menu-item danger"
                  onClick={handleDeleteSelection}
                  disabled={!canDelete}
                >
                  <Trash2 size={14} />
                  <span>削除</span>
                  <span className="shortcut">Del</span>
                </button>
              </>
            )}
            {contextMenu.type === 'column' && (
              <>
                <button className="context-menu-item" onClick={handleCopy}>
                  <Copy size={14} />
                  <span>コピー</span>
                  <span className="shortcut">Ctrl+C</span>
                </button>
                {clipboard && (
                  <button className="context-menu-item" onClick={handlePaste}>
                    <ClipboardPaste size={14} />
                    <span>ペースト</span>
                    <span className="shortcut">Ctrl+V</span>
                  </button>
                )}
                <div className="context-menu-divider" />
                <button className="context-menu-item" onClick={handleInsertColumnLeft}>
                  <ArrowLeft size={14} />
                  <span>左に列を挿入</span>
                </button>
                <button className="context-menu-item" onClick={handleInsertColumnRight}>
                  <ArrowRight size={14} />
                  <span>右に列を挿入</span>
                </button>
                <div className="context-menu-divider" />
                <button
                  className="context-menu-item danger"
                  onClick={handleDeleteSelection}
                  disabled={!canDelete}
                >
                  <Trash2 size={14} />
                  <span>削除</span>
                  <span className="shortcut">Del</span>
                </button>
              </>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="cancel-button" onClick={handleCancel}>
            キャンセル
          </button>
          <button className="save-button" onClick={handleSave}>
            保存
          </button>
        </div>

        <style>{`
          .table-editor-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
          }

          .table-editor-modal {
            background: var(--bg-primary);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            width: 90vw;
            max-width: 1400px;
            height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-secondary);
            flex-shrink: 0;
            gap: 16px;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
            min-width: 0;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            flex-shrink: 0;
          }

          .delete-selection-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
          }

          .delete-selection-btn:hover {
            background: #dc2626;
          }

          .close-button {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .close-button:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }

          .error-message {
            padding: 12px 20px;
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            font-size: 14px;
            border-left: 4px solid #ef4444;
            margin: 16px 24px 0;
            border-radius: 4px;
          }

          .modal-body {
            padding: 0;
            overflow: auto;
            flex: 1;
            background: var(--bg-primary);
            display: flex;
            flex-direction: column;
          }

          .table-container {
            overflow: auto;
            flex: 1;
            background: var(--bg-primary);
          }

          .editable-table {
            border-collapse: separate;
            border-spacing: 0;
            width: auto;
            min-width: auto;
          }

          .editable-table th,
          .editable-table td {
            border: 1px solid var(--border-color);
            position: relative;
            padding: 0;
            width: auto;
          }

          .corner-cell {
            width: 40px;
            min-width: 40px;
            background: var(--bg-tertiary);
          }

          .column-header {
            background: var(--bg-secondary);
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
            padding: 0;
          }

          .column-header:hover {
            background: var(--bg-hover);
          }

          .column-header.selected {
            background: rgba(59, 130, 246, 0.2);
          }

          .header-display {
            width: 100%;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 600;
            padding: 8px 12px;
            text-align: center;
            cursor: pointer;
          }

          .header-input {
            width: 100%;
            border: none;
            background: var(--bg-hover);
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 600;
            padding: 8px 12px;
            outline: none;
            border-radius: 4px;
            text-align: center;
            box-shadow: inset 0 0 0 2px var(--accent-color);
            min-width: 100px;
          }

          .row-header {
            width: 40px;
            min-width: 40px;
            text-align: center;
            background: var(--bg-secondary);
            cursor: pointer;
            user-select: none;
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 500;
            padding: 8px 4px;
            transition: background 0.2s;
          }

          .row-header:hover {
            background: var(--bg-hover);
          }

          .row-header.selected {
            background: rgba(59, 130, 246, 0.2);
          }

          .selected-cell {
            background: rgba(59, 130, 246, 0.15);
            cursor: pointer;
            user-select: none;
          }

          .cell-display {
            color: var(--text-primary);
            font-size: 14px;
            padding: 8px 12px;
            min-height: 20px;
            cursor: pointer;
            white-space: nowrap;
            min-width: 80px;
          }

          .header-display {
            white-space: nowrap;
          }

          .cell-input {
            width: 100%;
            min-width: 80px;
            border: none;
            background: var(--bg-hover);
            color: var(--text-primary);
            font-size: 14px;
            padding: 8px 12px;
            outline: none;
            box-sizing: border-box;
            box-shadow: inset 0 0 0 2px var(--accent-color);
          }

          .header-input {
            min-width: 100px;
          }

          .add-column-header {
            width: 40px;
            min-width: 40px;
            background: var(--bg-tertiary);
            text-align: center;
          }

          .add-column-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
            margin: 0 auto;
          }

          .add-column-btn:hover {
            background: var(--bg-hover);
            color: var(--accent-color);
          }

          .empty-cell {
            width: 40px;
            min-width: 40px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
          }

          .add-row-tr {
            background: var(--bg-secondary);
          }

          .add-row-btn {
            width: 100%;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
            font-size: 13px;
          }

          .add-row-btn:hover {
            background: var(--bg-hover);
            color: var(--accent-color);
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            background: var(--bg-secondary);
            flex-shrink: 0;
          }

          .cancel-button,
          .save-button {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .cancel-button {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
          }

          .cancel-button:hover {
            background: var(--bg-hover);
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          }

          .save-button {
            background: var(--accent-color);
            color: white;
          }

          .save-button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          }

          .cancel-button:active,
          .save-button:active {
            transform: translateY(0);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .context-menu {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 4px;
            min-width: 200px;
          }

          .context-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            width: 100%;
            background: none;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-primary);
            font-size: 13px;
            text-align: left;
            transition: background 0.15s;
          }

          .context-menu-item:hover:not(:disabled) {
            background: var(--bg-hover);
          }

          .context-menu-item:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .context-menu-item.danger {
            color: #ef4444;
          }

          .context-menu-item.danger:hover:not(:disabled) {
            background: rgba(239, 68, 68, 0.1);
          }

          .context-menu-item .shortcut {
            margin-left: auto;
            font-size: 11px;
            color: var(--text-secondary);
          }

          .context-menu-divider {
            height: 1px;
            background: var(--border-color);
            margin: 4px 0;
          }

          .column-header.drag-over,
          .row-header.drag-over {
            background: rgba(59, 130, 246, 0.3);
            box-shadow: inset 0 0 0 2px var(--accent-color);
          }

          .column-header[draggable="true"],
          .row-header[draggable="true"] {
            cursor: move;
          }

          .column-header[draggable="true"]:active,
          .row-header[draggable="true"]:active {
            opacity: 0.5;
          }
        `}</style>
      </div>
    </div>
  );
};

export default TableEditorModal;
