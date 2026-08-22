import { describe, expect, it } from 'vitest';
import { parseMarkdownTable } from './tableParser';
import { toMarkdownTable, sanitizeInput } from './tableSerializer';
import { canDeleteColumns, canDeleteRows, validateTableData } from './tableValidation';
import type { TableData } from './types';

describe('markdown table editor utilities', () => {
  it('parses pipes with or without outer delimiters', () => {
    expect(parseMarkdownTable('Name | Status\n--- | ---\nA | Done')).toEqual({
      headers: [{ value: 'Name' }, { value: 'Status' }],
      rows: [[{ value: 'A' }, { value: 'Done' }]],
    });
    expect(parseMarkdownTable('| Name | Status |\n| --- | --- |\n| A | Done |'))
      .toEqual({
        headers: [{ value: 'Name' }, { value: 'Status' }],
        rows: [[{ value: 'A' }, { value: 'Done' }]],
      });
  });

  it('pads short rows and truncates extra cells to the header width', () => {
    expect(parseMarkdownTable('| A | B |\n|---|---|\n| only |\n| one | two | three |')).toEqual({
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [
        [{ value: 'only' }, { value: '' }],
        [{ value: 'one' }, { value: 'two' }],
      ],
    });
  });

  it('returns null when there is no header/data structure', () => {
    expect(parseMarkdownTable('')).toBeNull();
    expect(parseMarkdownTable('| A |')).toBeNull();
    expect(parseMarkdownTable('| |\n|---|')).toBeNull();
    expect(parseMarkdownTable('| A | B |\n| not a separator | nope |\n| 1 | 2 |')).toBeNull();
  });

  it('serializes a rectangular table and sanitizes markdown delimiters', () => {
    const table: TableData = {
      headers: [{ value: 'A|B' }, { value: 'Second\nline' }],
      rows: [[{ value: 'x\ny' }, { value: 'z|q' }]],
    };

    expect(toMarkdownTable(table)).toBe('| A B | Second line |\n| --- | --- |\n| x y | z q |');
    expect(sanitizeInput('a|b\nc')).toBe('a b c');
  });

  it('validates rectangular table data', () => {
    const valid: TableData = {
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }, { value: '2' }]],
    };
    const invalid: TableData = {
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }]],
    };

    expect(validateTableData(valid)).toBe(true);
    expect(validateTableData(invalid)).toBe(false);
    expect(validateTableData({ headers: [], rows: [] })).toBe(false);
  });

  it('does not permit deleting the final row or column', () => {
    const table: TableData = {
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }, { value: '2' }], [{ value: '3' }, { value: '4' }]],
    };

    expect(canDeleteRows(table, [0])).toBe(true);
    expect(canDeleteRows(table, [0, 1])).toBe(false);
    expect(canDeleteColumns(table, [0])).toBe(true);
    expect(canDeleteColumns(table, [0, 1])).toBe(false);
  });
});
