/**
 * Markdown table extraction utilities
 */

export type MarkdownTableExtract = {
  headers?: string[];
  rows: string[][];
  before?: string;
  tableBlock: string;
  after?: string;
};

/**
 * Convert table row line to cells
 */
function toCells(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

/**
 * Check if line is a table separator line
 */
function isTableSeparator(line: string): boolean {
  const parts = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
  return parts.length > 0 && parts.every(cell => /^:?-{3,}:?$/.test(cell));
}

/**
 * Extract the first table from markdown text
 */
export function extractFirstTable(text?: string, lineEnding?: string): MarkdownTableExtract | null {
  if (!text) return null;

  const defaultLineEnding = lineEnding || '\n';
  const lines = text.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i];
    const sepLine = lines[i + 1];

    // Check if this is a table header
    const isHeader = headerLine.includes('|');
    if (!isHeader || !isTableSeparator(sepLine)) {
      continue;
    }

    // Collect data rows
    let j = i + 2;
    const rowLines: string[] = [];
    while (j < lines.length && lines[j].includes('|')) {
      rowLines.push(lines[j]);
      j++;
    }

    const headers = toCells(headerLine);
    const rows = rowLines.map(toCells);

    const before = i > 0 ? lines.slice(0, i).join(defaultLineEnding) : undefined;
    const tableBlock = lines.slice(i, j).join(defaultLineEnding);
    const after = j < lines.length ? lines.slice(j).join(defaultLineEnding) : undefined;

    return { headers, rows, before, tableBlock, after };
  }

  return null;
}

/**
 * Extract all tables from markdown text
 */
export function extractAllTables(text: string, lineEnding?: string): MarkdownTableExtract[] {
  const tables: MarkdownTableExtract[] = [];
  let remaining = text;

  while (remaining) {
    const table = extractFirstTable(remaining, lineEnding);
    if (!table) break;

    tables.push(table);
    remaining = table.after || '';
  }

  return tables;
}

/**
 * Parse table from markdown string (simpler version)
 */
export function parseTableFromMarkdown(src: string): { headers?: string[]; rows: string[][] } | null {
  const extract = extractFirstTable(src);
  if (!extract) return null;

  return {
    headers: extract.headers,
    rows: extract.rows
  };
}
