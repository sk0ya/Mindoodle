import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

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
  | { type: 'row'; index: number }
  | { type: 'column'; index: number }
  | { type: 'cell'; row: number; col: number }
  | { type: 'range'; startRow: number; startCol: number; endRow: number; endCol: number };

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
    if (selection.type === 'row') {
      if (tableData.rows.length <= 1) return;
      const newRows = tableData.rows.filter((_, idx) => idx !== selection.index);
      setTableData({ ...tableData, rows: newRows });
      setSelection({ type: 'none' });
    } else if (selection.type === 'column') {
      if (tableData.headers.length <= 1) return;
      const newHeaders = tableData.headers.filter((_, idx) => idx !== selection.index);
      const newRows = tableData.rows.map(row => row.filter((_, idx) => idx !== selection.index));
      setTableData({ headers: newHeaders, rows: newRows });
      setSelection({ type: 'none' });
    }
  };

  const handleRowHeaderClick = (rowIndex: number) => {
    if (selection.type === 'row' && selection.index === rowIndex) {
      setSelection({ type: 'none' });
    } else {
      setSelection({ type: 'row', index: rowIndex });
    }
  };

  const handleColumnHeaderClick = (colIndex: number) => {
    if (selection.type === 'column' && selection.index === colIndex) {
      // 既に選択されている列をクリック → 編集モードに入る
      setEditingCell({ row: -1, col: colIndex });
    } else {
      // 新しい列を選択
      setSelection({ type: 'column', index: colIndex });
      setEditingCell(null);
    }
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
  };

  const handleCellDoubleClick = (rowIndex: number, cellIndex: number) => {
    // ダブルクリックで即座に編集モードへ
    setEditingCell({ row: rowIndex, col: cellIndex });
    setSelection({ type: 'none' });
  };

  // セルが選択範囲内かチェック
  const isCellInSelection = (rowIndex: number, cellIndex: number): boolean => {
    if (selection.type === 'row' && selection.index === rowIndex) return true;
    if (selection.type === 'column' && selection.index === cellIndex) return true;
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
    (selection.type === 'row' && tableData.rows.length > 1) ||
    (selection.type === 'column' && tableData.headers.length > 1);

  return (
    <div className="table-editor-modal-overlay" onClick={handleCancel} onMouseUp={handleMouseUp}>
      <div className="table-editor-modal" onClick={e => e.stopPropagation()} onMouseUp={handleMouseUp}>
        <div className="modal-header">
          <div className="header-left">
            <h2>テーブルを編集</h2>
            {selection.type !== 'none' && canDelete && (
              <button className="delete-selection-btn" onClick={handleDeleteSelection}>
                <Trash2 size={16} />
                <span>
                  {selection.type === 'row' ? `行 ${selection.index + 1} を削除` : `列 ${selection.index + 1} を削除`}
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
                      className={`column-header ${selection.type === 'column' && selection.index === idx ? 'selected' : ''}`}
                      onClick={() => handleColumnHeaderClick(idx)}
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
                      className={`row-header ${selection.type === 'row' && selection.index === rowIdx ? 'selected' : ''}`}
                      onClick={() => handleRowHeaderClick(rowIdx)}
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
        `}</style>
      </div>
    </div>
  );
};

export default TableEditorModal;
