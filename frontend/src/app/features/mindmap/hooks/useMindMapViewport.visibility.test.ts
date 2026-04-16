import { describe, expect, it } from 'vitest';
import { calculateVisibilityPanDelta } from './useMindMapViewport';

describe('calculateVisibilityPanDelta', () => {
  const visibleBounds = {
    left: 0,
    right: 100,
    top: 0,
    bottom: 100,
  };

  const targetBounds = {
    left: 40,
    right: 60,
    top: 16,
    bottom: 80,
  };

  it('does not move a node that is visible but outside the safety margin', () => {
    expect(calculateVisibilityPanDelta(
      { left: 10, right: 30, top: 20, bottom: 40 },
      visibleBounds,
      targetBounds
    )).toEqual({ x: 0, y: 0 });
  });

  it('moves a node into the safety margin after it leaves the visible area', () => {
    expect(calculateVisibilityPanDelta(
      { left: -5, right: 15, top: 20, bottom: 40 },
      visibleBounds,
      targetBounds
    )).toEqual({ x: 45, y: 0 });
  });

  it('only adjusts the axis that is actually outside the visible area', () => {
    expect(calculateVisibilityPanDelta(
      { left: 10, right: 30, top: 90, bottom: 105 },
      visibleBounds,
      targetBounds
    )).toEqual({ x: 0, y: -25 });
  });

  it('can keep a rightward insertion from pushing the canvas downward', () => {
    expect(calculateVisibilityPanDelta(
      { left: 90, right: 105, top: -5, bottom: 15 },
      visibleBounds,
      targetBounds,
      { preventDownwardPan: true }
    )).toEqual({ x: -45, y: 0 });
  });
});
