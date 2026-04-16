import { describe, expect, it } from 'vitest';
import { calculateStableNodePan } from './viewportPanCompensation';

describe('calculateStableNodePan', () => {
  it('moves pan opposite to the layout delta so the node stays at the same screen position', () => {
    const currentPan = { x: 20, y: -10 };
    const before = { x: 100, y: 200 };
    const after = { x: 140, y: 150 };

    const result = calculateStableNodePan(currentPan, before, after);

    expect(after.x + result.x).toBe(before.x + currentPan.x);
    expect(after.y + result.y).toBe(before.y + currentPan.y);
    expect(result).toEqual({ x: -20, y: 40 });
  });

  it('keeps pan unchanged when the anchored node did not move', () => {
    const currentPan = { x: 12, y: 34 };
    const nodePosition = { x: 300, y: 400 };

    expect(calculateStableNodePan(currentPan, nodePosition, nodePosition)).toEqual(currentPan);
  });
});
