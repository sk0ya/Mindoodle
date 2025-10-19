/**
 * Table validation utilities
 */

import { TableData } from './types';

/**
 * Check if deleting rows is allowed (at least 1 row must remain)
 */
export function canDeleteRows(tableData: TableData, rowIndices: number[]): boolean {
  return tableData.rows.length - rowIndices.length >= 1;
}

/**
 * Check if deleting columns is allowed (at least 1 column must remain)
 */
export function canDeleteColumns(tableData: TableData, colIndices: number[]): boolean {
  return tableData.headers.length - colIndices.length >= 1;
}

/**
 * Validate table data structure
 */
export function validateTableData(data: TableData): boolean {
  if (!data.headers || data.headers.length === 0) return false;
  if (!data.rows || !Array.isArray(data.rows)) return false;

  // Each row should have same length as headers
  return data.rows.every(row => row.length === data.headers.length);
}
