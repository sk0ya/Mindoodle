/**
 * Shared type definitions for table editor components
 */

export interface TableCell {
  value: string;
}

export interface TableData {
  headers: TableCell[];
  rows: TableCell[][];
}

export type Selection =
  | { type: 'none' }
  | { type: 'rows'; indices: number[] }
  | { type: 'columns'; indices: number[] }
  | { type: 'cell'; row: number; col: number }
  | { type: 'range'; startRow: number; startCol: number; endRow: number; endCol: number };

export interface ContextMenu {
  x: number;
  y: number;
  type: 'row' | 'column' | 'cell' | 'range';
  target?: number | number[];
}

export interface ClipboardData {
  type: 'cells' | 'rows' | 'columns';
  data: TableCell[][] | TableCell[];
  indices?: number[];
}

export interface EditingCell {
  row: number;
  col: number;
}
