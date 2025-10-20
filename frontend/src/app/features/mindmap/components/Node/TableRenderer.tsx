import React, { memo } from 'react';
import type { MindMapNode } from '@shared/types';
import { parseTableFromString } from './nodeRendererHelpers';

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
  type TableNode = MindMapNode & { note?: string; tableData?: { headers?: string[]; rows?: string[][] } };
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
          {hasHeaders && headers && (
            <thead>
              <tr>
                {headers.map((cell: string, ci: number) => (
                  <th
                    key={ci}
                    style={{
                      border: 0,
                      borderRight: ci < headers.length - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined,
                      padding: '12px 16px',
                      verticalAlign: 'middle',
                      fontWeight: 600,
                      background: '#6b7280',
                      color: 'white',
                      borderBottom: '2px solid #e2e8f0',
                      textAlign: 'left',
                      borderTopLeftRadius: ci === 0 ? '10px' : undefined,
                      borderTopRightRadius: ci === headers.length - 1 ? '10px' : undefined,
                      whiteSpace: 'nowrap'
                    }}
                  >
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
                    <td
                      key={ci}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        background: ri % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderRight: ci < row.length - 1 ? '1px solid #e2e8f0' : undefined,
                        borderBottom: !isLastRow ? '1px solid #e2e8f0' : undefined,
                        borderBottomLeftRadius: isLastRow && ci === 0 ? '10px' : undefined,
                        borderBottomRightRadius: isLastRow && ci === row.length - 1 ? '10px' : undefined
                      }}
                    >
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
