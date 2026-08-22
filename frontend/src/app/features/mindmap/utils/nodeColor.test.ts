import { describe, expect, it } from 'vitest';
import { generateBranchColors, getBranchColor, getColorSetColors } from './nodeColor';
import type { NormalizedData } from '@core/data/normalizedStore';

const normalized: NormalizedData = {
  nodes: {
    root: { id: 'root', text: 'root', x: 0, y: 0, fontSize: 14, fontWeight: 'normal', children: [] },
    branchA: { id: 'branchA', text: 'branchA', x: 0, y: 0, fontSize: 14, fontWeight: 'normal', children: [] },
    branchB: { id: 'branchB', text: 'branchB', x: 0, y: 0, fontSize: 14, fontWeight: 'normal', children: [] },
    grandchild: { id: 'grandchild', text: 'grandchild', x: 0, y: 0, fontSize: 14, fontWeight: 'normal', children: [] },
  },
  rootNodeIds: ['root'],
  parentMap: { branchA: 'root', branchB: 'root', grandchild: 'branchA' },
  childrenMap: {
    __mindoodle_root__: ['root'],
    root: ['branchA', 'branchB'],
    branchA: ['grandchild'],
    branchB: [],
  },
};

describe('node branch colors', () => {
  it('returns configured palettes and a deterministic six-color branch', () => {
    expect(getColorSetColors('missing')).toEqual(getColorSetColors('vibrant'));
    expect(getColorSetColors('nord')).toHaveLength(6);
    expect(generateBranchColors('#ff0000')).toHaveLength(6);
    expect(generateBranchColors('#ff0000')[0]).toBe('#ff0000');
  });

  it('colors roots, branch roots, descendants, and unknown nodes safely', () => {
    const branchA = getColorSetColors('vibrant')[0];
    const branchB = getColorSetColors('vibrant')[1];
    const branchColors = generateBranchColors(branchA);

    expect(getBranchColor('root', normalized)).toBe('#333');
    expect(getBranchColor('branchA', normalized)).toBe(branchA);
    expect(getBranchColor('branchB', normalized)).toBe(branchB);
    expect(getBranchColor('grandchild', normalized)).toBe(branchColors[0]);
    expect(getBranchColor('missing', normalized)).toBe('#666');
    expect(getBranchColor('', normalized)).toBe('#666');
  });
});
