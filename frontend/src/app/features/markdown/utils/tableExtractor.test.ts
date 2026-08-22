import { describe, expect, it } from 'vitest';
import { extractAllTables, extractFirstTable, parseTableFromMarkdown } from './tableExtractor';

describe('markdown table extraction', () => {
  it('extracts the first table with surrounding content and line endings', () => {
    const source = 'before\r\n| A | B |\r\n| :--- | ---: |\r\n| 1 | 2 |\r\nafter';
    expect(extractFirstTable(source, '\r\n')).toEqual({
      headers: ['A', 'B'],
      rows: [['1', '2']],
      before: 'before',
      tableBlock: '| A | B |\r\n| :--- | ---: |\r\n| 1 | 2 |',
      after: 'after',
    });
    expect(parseTableFromMarkdown(source)).toEqual({ headers: ['A', 'B'], rows: [['1', '2']] });
  });

  it('extracts multiple tables and ignores non-table pipe text', () => {
    const source = 'a | sentence\n\n| A |\n|---|\n| 1 |\n\n| B |\n|---|\n| 2 |';
    expect(extractAllTables(source).map(table => table.headers)).toEqual([['A'], ['B']]);
    expect(extractFirstTable('plain text\nwith | pipe')).toBeNull();
    expect(extractFirstTable()).toBeNull();
  });
});
