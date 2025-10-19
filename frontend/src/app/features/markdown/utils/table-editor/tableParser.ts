/**
 * Markdown table parsing utilities
 */

import { TableCell, TableData } from './types';

/**
 * Parse markdown table string into structured data
 */
export function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return null;

  // Parse header line
  const headerLine = lines[0].trim();
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0)
    .map(value => ({ value }));

  if (headers.length === 0) return null;

  // Skip separator line (index 1), parse data rows
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
