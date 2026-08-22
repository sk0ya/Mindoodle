import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { mergeNodesPreservingLayout } from './markdownNodeMerge';

const node = (id: string, text: string, children: MindMapNode[] = [], overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
  ...overrides,
});

describe('mergeNodesPreservingLayout', () => {
  it('matches nodes by text while preserving IDs, layout, and visual properties', () => {
    const existing = [
      node('existing-a', 'A', [], { x: 100, y: 200, color: 'red', collapsed: true, note: 'old note' }),
    ];
    const parsed = [
      node('parsed-a', 'A', [], { markdownMeta: { type: 'heading', level: 2 } }),
    ];

    const [merged] = mergeNodesPreservingLayout(existing, parsed);
    expect(merged).toMatchObject({
      id: 'existing-a',
      text: 'A',
      x: 100,
      y: 200,
      color: 'red',
      collapsed: true,
      note: 'old note',
      markdownMeta: { type: 'heading', level: 2 },
    });
    expect(merged).not.toBe(existing[0]);
  });

  it('uses each duplicate existing text once and creates new parsed nodes with positions', () => {
    const existing = [node('old-1', 'Same', [], { x: 10, y: 20 }), node('old-2', 'Same', [], { x: 30, y: 40 })];
    const parsed = [node('p1', 'Same'), node('p2', 'Same'), node('p3', 'New')];
    const result = mergeNodesPreservingLayout(existing, parsed, node('parent', 'Parent', [], { x: 100, y: 100 }));

    expect(result.map(n => n.id)).toEqual(['old-1', 'old-2', expect.stringMatching(/^node_/)]);
    expect(result[2]).toMatchObject({ text: 'New', x: 128, y: 156 });
  });

  it('merges children recursively and carries table extensions to new nodes', () => {
    const existing = [node('root', 'Root', [node('old-child', 'Child', [], { x: 50, y: 60 })])];
    const parsed = [node('parsed-root', 'Root', [node('parsed-child', 'Child'), node('new-child', 'New')], {
      kind: 'table',
      tableData: { headers: ['A'], rows: [['B']] },
    })];

    const [merged] = mergeNodesPreservingLayout(existing, parsed);
    expect(merged.id).toBe('root');
    expect(merged.kind).toBe('table');
    expect(merged.tableData).toEqual({ headers: ['A'], rows: [['B']] });
    expect(merged.children.map(child => child.id)).toEqual(['old-child', expect.stringMatching(/^node_/)]);
    expect(merged.children[0]).toMatchObject({ x: 50, y: 60, text: 'Child' });
    expect(merged.children[1].text).toBe('New');
  });

  it('returns an empty result when there are no parsed nodes', () => {
    expect(mergeNodesPreservingLayout([node('old', 'Old')], [])).toEqual([]);
  });
});
