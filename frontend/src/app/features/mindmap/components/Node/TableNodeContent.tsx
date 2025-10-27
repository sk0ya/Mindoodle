import React from 'react';
import type { MindMapNode } from '@shared/types';
import { parseTableFromString } from './nodeRendererHelpers';

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

const getCellStyle = (isHeader: boolean, isEven: boolean, isLastRow: boolean, cellIndex: number, rowLength: number) => ({
  border: 0,
  borderRight: isHeader && cellIndex < rowLength - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined,
  padding: '12px 16px',
  verticalAlign: 'middle' as const,
  fontWeight: isHeader ? 600 : undefined,
  background: isHeader ? '#6b7280' : isEven ? 'white' : '#fcfcfd',
  color: isHeader ? 'white' : 'black',
  borderBottom: isHeader ? '2px solid #e2e8f0' : undefined,
  borderTop: !isHeader && cellIndex > 0 ? '1px solid #f1f5f9' : undefined,
  borderTopLeftRadius: isHeader && cellIndex === 0 ? '10px' : undefined,
  borderTopRightRadius: isHeader && cellIndex === rowLength - 1 ? '10px' : undefined,
  borderBottomLeftRadius: isLastRow && cellIndex === 0 ? '10px' : undefined,
  borderBottomRightRadius: isLastRow && cellIndex === rowLength - 1 ? '10px' : undefined,
  textAlign: 'left' as const,
  whiteSpace: 'nowrap' as const
});

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
      <div className="table-wrap" style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '10px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <table style={{
          width: 'auto',
          borderCollapse: 'collapse',
          overflow: 'hidden',
          borderRadius: '10px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          background: 'white',
          fontSize: `${fontSize * 0.95}px`,
          lineHeight: 1.5
        }}>
          {headers && (
            <thead>
              <tr>
                {headers.map((cell: string, ci: number) => (
                  <th key={ci} style={getCellStyle(true, false, false, ci, headers.length)}>
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
                    <td key={ci} style={getCellStyle(false, ri % 2 === 0, isLastRow, ci, row.length)}>
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
