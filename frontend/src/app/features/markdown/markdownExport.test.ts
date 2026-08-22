import { describe, expect, it } from 'vitest';
import { nodeToMarkdown } from './markdownExport';
import type { MindMapNode } from '@shared/types';

const node = (id: string, text: string, children: MindMapNode[] = [], overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
  lineEnding: '\n',
  ...overrides,
});

describe('nodeToMarkdown', () => {
  it('exports headings, list markers, checkboxes, notes, and children', () => {
    const child = node('child', 'Done', [], {
      markdownMeta: { type: 'unordered-list', originalFormat: '*', indentLevel: 2, isCheckbox: true, isChecked: true },
    });
    const root = node('root', 'Title', [child], {
      markdownMeta: { type: 'heading', level: 2 },
      note: 'Description',
    });
    expect(nodeToMarkdown(root)).toBe('## Title\nDescription\n  * [x] Done\n');
  });

  it('exports ordered lists and plain/preface nodes', () => {
    expect(nodeToMarkdown(node('n', 'Item', [], {
      markdownMeta: { type: 'ordered-list', originalFormat: '3.', indentLevel: 0 },
      lineEnding: '\r\n',
    }))).toBe('3. Item\r\n');
    expect(nodeToMarkdown(node('n', 'Preface', [], { markdownMeta: { type: 'preface' } }))).toBe('Preface\n');
    expect(nodeToMarkdown(node('n', 'Plain'))).toBe('Plain\n');
  });

  it('exports table nodes without adding a trailing line ending', () => {
    const table = node('table', '| A |\n|---|\n| B |', [], { kind: 'table', note: 'after' });
    expect(nodeToMarkdown(table)).toBe('| A |\n|---|\n| B |\nafter');
  });
});
