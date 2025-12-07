/**
 * Shared table styling utilities
 * Used by TableNodeContent and TableRenderer
 */

export interface TableCellStyle {
  border?: number;
  borderRight?: string;
  borderBottom?: string;
  borderTop?: string;
  padding?: string;
  verticalAlign?: 'middle' | 'top' | 'bottom';
  fontWeight?: number;
  background?: string;
  color?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderBottomRightRadius?: string;
  textAlign?: 'left' | 'center' | 'right';
  whiteSpace?: 'nowrap' | 'normal' | 'pre' | 'pre-wrap';
}

export const tableContainerStyle = {
  width: '100%',
  height: '100%',
  overflow: 'hidden' as const,
  borderRadius: '10px',
  boxSizing: 'border-box' as const
};

export const tableBaseStyle = (fontSize: number) => ({
  width: 'auto',
  margin: 0,
  borderCollapse: 'collapse' as const,
  overflow: 'hidden' as const,
  borderRadius: '10px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  background: 'white',
  fontSize: `${fontSize * 0.95}px`,
  lineHeight: 1.5
});

export const headerCellBaseStyle: TableCellStyle = {
  border: 0,
  padding: '12px 16px',
  verticalAlign: 'middle',
  fontWeight: 600,
  background: '#6b7280',
  color: 'white',
  borderBottom: '2px solid #e2e8f0',
  textAlign: 'left',
  whiteSpace: 'nowrap'
};

export const dataCellBaseStyle: TableCellStyle = {
  padding: '12px 16px',
  verticalAlign: 'middle',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderTop: '1px solid #f1f5f9'
};

export const getHeaderCellStyle = (
  cellIndex: number,
  rowLength: number
): TableCellStyle => ({
  ...headerCellBaseStyle,
  borderRight: cellIndex < rowLength - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined,
  borderTopLeftRadius: cellIndex === 0 ? '10px' : undefined,
  borderTopRightRadius: cellIndex === rowLength - 1 ? '10px' : undefined,
});

export const getDataCellStyle = (
  isEven: boolean,
  isLastRow: boolean,
  cellIndex: number,
  rowLength: number
): TableCellStyle => ({
  ...dataCellBaseStyle,
  background: isEven ? 'white' : '#fcfcfd',
  borderBottomLeftRadius: isLastRow && cellIndex === 0 ? '10px' : undefined,
  borderBottomRightRadius: isLastRow && cellIndex === rowLength - 1 ? '10px' : undefined,
});
