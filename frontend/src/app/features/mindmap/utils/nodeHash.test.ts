import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { hashNodeTree, MarkdownMemoizer } from './nodeHash';

const node = (overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id: 'node',
  text: 'Text',
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children: [],
  ...overrides,
});

describe('node hashing and markdown memoization', () => {
  it('changes when note content changes even if its length is unchanged', () => {
    expect(hashNodeTree([node({ note: 'abc' })])).not.toBe(hashNodeTree([node({ note: 'xyz' })]));
  });

  it('includes structural and checkbox metadata in the hash', () => {
    const base = node({ markdownMeta: { type: 'heading', level: 1 } });
    expect(hashNodeTree([base])).not.toBe(hashNodeTree([{
      ...base,
      markdownMeta: { type: 'heading', level: 2 },
    }]));
    expect(hashNodeTree([base])).not.toBe(hashNodeTree([{
      ...base,
      markdownMeta: { type: 'heading', level: 1, isCheckbox: true, isChecked: true },
    }]));
  });

  it('memoizes, invalidates, and reports hit/miss statistics', () => {
    const memoizer = new MarkdownMemoizer();
    const nodes = [node()];
    let conversions = 0;
    const convert = () => {
      conversions += 1;
      return 'markdown';
    };

    expect(memoizer.convert(nodes, convert)).toBe('markdown');
    expect(memoizer.convert(nodes, convert)).toBe('markdown');
    expect(conversions).toBe(1);
    expect(memoizer.getStats()).toEqual({ hitCount: 1, missCount: 1, hitRate: 0.5 });

    memoizer.invalidate();
    expect(memoizer.convert(nodes, convert)).toBe('markdown');
    expect(memoizer.getStats()).toEqual({ hitCount: 1, missCount: 2, hitRate: 1 / 3 });

    memoizer.resetStats();
    expect(memoizer.getStats()).toEqual({ hitCount: 0, missCount: 0, hitRate: 0 });
  });
});
