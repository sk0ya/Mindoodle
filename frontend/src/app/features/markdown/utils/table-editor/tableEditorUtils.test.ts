import { describe, expect, it } from 'vitest';
import { parseMarkdownTable } from './tableParser';
import { sanitizeInput, toMarkdownTable } from './tableSerializer';
import { canDeleteColumns, canDeleteRows, validateTableData } from './tableValidation';
import type { TableData } from './types';

describe('table editor utilities', () => {
  it('parses tables with or without outer pipes', () => {
    expect(parseMarkdownTable('A | B\n--- | ---\n1 | 2')).toEqual({
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }, { value: '2' }]],
    });

    expect(parseMarkdownTable('| A | B |\n| --- | --- |\n| 1 | 2 |')).toEqual({
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }, { value: '2' }]],
    });
  });

  it('pads short rows and truncates extra cells', () => {
    expect(parseMarkdownTable('| A | B |\n|---|---|\n| only |')).toEqual({
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: 'only' }, { value: '' }]],
    });
    expect(parseMarkdownTable('| A |\n|---|\n| one | two |')).toEqual({
      headers: [{ value: 'A' }],
      rows: [[{ value: 'one' }]],
    });
  });

  it('returns null when there is no header and data section', () => {
    expect(parseMarkdownTable('')).toBeNull();
    expect(parseMarkdownTable('| A |')).toBeNull();
  });

  it('serializes and sanitizes cell values', () => {
    const data: TableData = {
      headers: [{ value: 'Name|value' }, { value: '' }],
      rows: [[{ value: 'line 1\nline 2' }, { value: 'ok' }]],
    };
    expect(toMarkdownTable(data)).toBe('| Name value |   |\n| --- | --- |\n| line 1 line 2 | ok |');
    expect(sanitizeInput('a|b\r\nc')).toBe('a b  c');
  });

  it('enforces that at least one row and column remain', () => {
    const data: TableData = {
      headers: [{ value: 'A' }, { value: 'B' }],
      rows: [[{ value: '1' }, { value: '2' }], [{ value: '3' }, { value: '4' }]],
    };
    expect(canDeleteRows(data, [0])).toBe(true);
    expect(canDeleteRows(data, [0, 1])).toBe(false);
    expect(canDeleteColumns(data, [0])).toBe(true);
    expect(canDeleteColumns(data, [0, 1])).toBe(false);
  });

  it('validates rectangular table data', () => {
    const valid: TableData = { headers: [{ value: 'A' }], rows: [[{ value: '1' }]] };
    expect(validateTableData(valid)).toBe(true);
    expect(validateTableData({ headers: [], rows: [] })).toBe(false);
    expect(validateTableData({ headers: [{ value: 'A' }], rows: [[]] })).toBe(false);
  });
});
