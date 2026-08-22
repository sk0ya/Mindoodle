import { describe, expect, it } from 'vitest';
import { canTransition, isInsertLike, isVisualLike, nextMode } from './uiModeMachine';

describe('uiModeMachine', () => {
  it('allows mode changes and keeps the requested mode', () => {
    expect(canTransition('normal', 'insert')).toBe(true);
    expect(nextMode('normal', 'visual')).toBe('visual');
    expect(nextMode('insert', 'normal')).toBe('normal');
  });

  it('classifies insert and visual modes', () => {
    expect(isInsertLike('insert')).toBe(true);
    expect(isInsertLike('normal')).toBe(false);
    expect(isVisualLike('visual')).toBe(true);
    expect(isVisualLike('insert')).toBe(false);
  });
});
