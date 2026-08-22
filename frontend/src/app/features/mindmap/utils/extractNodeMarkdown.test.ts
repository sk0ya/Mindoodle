import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { extractNodeMarkdownFromStream } from './extractNodeMarkdown';

const node = (id: string, children: MindMapNode[] = []): MindMapNode => ({
  id,
  text: id,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
});

describe('extractNodeMarkdownFromStream', () => {
  it('extracts a node through the deepest descendant line', () => {
    const tree = [node('root', [node('child', [node('grandchild')])])];
    expect(extractNodeMarkdownFromStream(
      '# root\n- child\n  - grandchild\n# next',
      1,
      tree[0],
      { root: 1, child: 2, grandchild: 3 },
    )).toBe('# root\n- child\n  - grandchild');
  });

  it('returns empty output for missing maps, content, or invalid start lines', () => {
    const root = node('root');
    expect(extractNodeMarkdownFromStream('', 1, root, { root: 1 })).toBe('');
    expect(extractNodeMarkdownFromStream('# root', 1, root)).toBe('');
    expect(extractNodeMarkdownFromStream('# root', 0, root, { root: 1 })).toBe('');
    expect(extractNodeMarkdownFromStream('# root', 2, root, { root: 1 })).toBe('');
  });

  it('preserves blank lines inside the selected range', () => {
    const root = node('root', [node('child')]);
    expect(extractNodeMarkdownFromStream('root\n\nchild', 1, root, { root: 1, child: 3 }))
      .toBe('root\n\nchild');
  });
});
