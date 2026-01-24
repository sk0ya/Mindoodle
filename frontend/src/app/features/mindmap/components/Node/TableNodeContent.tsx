import React from 'react';
import type { MindMapNode } from '@shared/types';
import { parseTableFromString } from './nodeRendererHelpers';
import { tableContainerStyle, tableBaseStyle, getHeaderCellStyle, getDataCellStyle } from './tableStyles';

interface TableNodeContentProps {
  node: MindMapNode;
  fontSize: number;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

type TableNode = MindMapNode & { note?: string; tableData?: { headers?: string[]; rows?: string[][] } };

export const TableNodeContent: React.FC<TableNodeContentProps> = ({
  node,
  fontSize,
  isSelected,
  onSelect,
  onContextMenu,
  onMouseEnter,
  onMouseLeave
}) => {
  const tableNode = node as TableNode;
  const parsed = parseTableFromString(node.text) || parseTableFromString(tableNode.note) ||
    (tableNode.tableData?.rows ? { headers: tableNode.tableData.headers, rows: tableNode.tableData.rows } : null);

  const headers = parsed?.headers;
  const dataRows = parsed?.rows || [];
  const rows = headers || dataRows.length > 0 ? [headers, ...dataRows].filter(Boolean) : [['', ''], ['', '']];

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={(e) => { e.stopPropagation(); if (!isSelected) onSelect(); }}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="table-wrap" style={tableContainerStyle}>
        <table style={tableBaseStyle(fontSize)}>
          {headers && (
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
            {(headers ? dataRows : rows).filter((row): row is string[] => !!row).map((row: string[], ri: number) => {
              const isLastRow = ri === (headers ? dataRows : rows).length - 1;
              return (
                <tr
                  key={ri}
                  style={{ transition: 'background 0.15s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ri % 2 === 0 ? 'white' : '#fcfcfd'; }}
                >
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={getDataCellStyle(ri % 2 === 0, isLastRow, ci, row.length)}>
                      {cell}
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
};
