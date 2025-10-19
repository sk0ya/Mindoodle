/**
 * Markdown table serialization utilities
 */

import { TableData } from './types';

/**
 * Sanitize cell value: remove newlines and pipe characters
 */
function sanitizeCellValue(value: string): string {
  return value.replace(/[\r\n|]/g, ' ');
}

/**
 * Convert structured data to markdown table
 */
export function toMarkdownTable(data: TableData): string {
  const { headers, rows } = data;

  const headerLine = '| ' + headers.map(h => sanitizeCellValue(h.value || ' ')).join(' | ') + ' |';
  const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const dataLines = rows.map(row =>
    '| ' + row.map(cell => sanitizeCellValue(cell.value || ' ')).join(' | ') + ' |'
  );
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Sanitize input value for table cells and headers
 */
export function sanitizeInput(value: string): string {
  return value.replace(/[\r\n|]/g, ' ');
}
