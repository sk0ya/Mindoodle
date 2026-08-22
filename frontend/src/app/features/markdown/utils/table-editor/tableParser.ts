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

  const parseCells = (line: string): string[] => {
    const trimmed = line.trim();
    const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const withoutOuterPipes = withoutLeadingPipe.endsWith('|')
      ? withoutLeadingPipe.slice(0, -1)
      : withoutLeadingPipe;
    return withoutOuterPipes.split('|').map(cell => cell.trim());
  };

  // Parse header line
  const headers = parseCells(lines[0])
    .filter(cell => cell.length > 0)
    .map(value => ({ value }));

  if (headers.length === 0) return null;

  // Skip separator line (index 1), parse data rows
  const rows: TableCell[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseCells(lines[i])
      .slice(0, headers.length)
      .map(value => ({ value }));

    while (cells.length < headers.length) {
      cells.push({ value: '' });
    }
    rows.push(cells.slice(0, headers.length));
  }

  return { headers, rows };
}
