import React, { memo } from 'react';
import type { MindMapNode, TableNode } from '@shared/types';
import { parseTableFromString } from './nodeRendererHelpers';
import { tableContainerStyle, tableBaseStyle, getHeaderCellStyle, getDataCellStyle } from './tableStyles';

interface TableRendererProps {
  node: MindMapNode;
  fontSize: number;
  isSelected: boolean;
  onSelectNode?: (nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const TableRenderer: React.FC<TableRendererProps> = memo(({
  node,
  fontSize,
  isSelected,
  onSelectNode,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave
}) => {
  const tableNode = node as TableNode;

  // Prefer parsing from node.text (canonical); fallback to note
  let parsed = parseTableFromString(node.text) || parseTableFromString(tableNode.note);
  if (!parsed) {
    const td = tableNode.tableData;
    if (td && Array.isArray(td.rows)) {
      parsed = { headers: td.headers, rows: td.rows };
    }
  }

  const headers = parsed?.headers;
  const dataRows = parsed?.rows || [];
  const rowsOrPlaceholder = headers || dataRows.length > 0 ? [headers, ...dataRows].filter(Boolean) : [['', ''], ['', '']];
  const hasHeaders = !!headers;

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isSelected && onSelectNode) onSelectNode(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(e);
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="table-wrap" style={{ ...tableContainerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <table style={tableBaseStyle(fontSize)}>
          {hasHeaders && headers && (
            <thead>
              <tr>
                {headers.map((cell: string, ci: number) => (
                  <th key={ci} style={getHeaderCellStyle(ci, headers.length)}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {(hasHeaders ? dataRows : rowsOrPlaceholder).filter((row): row is string[] => !!row).map((row: string[], ri: number) => {
              const isLastRow = ri === (hasHeaders ? dataRows : rowsOrPlaceholder).length - 1;
              return (
                <tr key={ri}>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={getDataCellStyle(ri % 2 === 0, isLastRow, ci, row.length)}>
                      {cell || ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

TableRenderer.displayName = 'TableRenderer';
