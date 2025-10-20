import { LineEndingUtils } from '@shared/utils/lineEndingUtils';

/**
 * Result of table parsing
 */
export interface TableParseResult {
  headers?: string[];
  rows: string[][];
}

/**
 * Parse table from markdown string
 *
 * Looks for GitHub Flavored Markdown table syntax:
 * | Header 1 | Header 2 |
 * | -------- | -------- |
 * | Cell 1   | Cell 2   |
 *
 * @param src - Markdown source string
 * @returns Parsed table data or null if no valid table found
 */
export const parseTableFromString = (src?: string): TableParseResult | null => {
  if (!src) return null;

  const lines = LineEndingUtils.splitLines(src).filter(
    line => !LineEndingUtils.isEmptyOrWhitespace(line)
  );

  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const separator = lines[i + 1];

    if (!isTableHeader(header) || !isTableSeparator(separator)) {
      continue;
    }

    const headers = parseTableRow(header);
    const rows = parseTableBody(lines, i + 2);

    return { headers, rows };
  }

  return null;
};

/**
 * Check if line is a valid table header
 */
const isTableHeader = (line: string): boolean => {
  return /^\|.*\|$/.test(line) || line.includes('|');
};

/**
 * Check if line is a valid table separator
 */
const isTableSeparator = (line: string): boolean => {
  const parts = line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(s => s.trim());

  return parts.length > 0 && parts.every(cell => /^:?-{3,}:?$/.test(cell));
};

/**
 * Parse a table row into cells
 */
const parseTableRow = (line: string): string[] => {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
};

/**
 * Parse table body rows starting from given index
 */
const parseTableBody = (lines: string[], startIndex: number): string[][] => {
  const rows: string[][] = [];
  let j = startIndex;

  while (j < lines.length && lines[j].includes('|')) {
    rows.push(parseTableRow(lines[j]));
    j++;
  }

  return rows;
};
