import { describe, expect, it } from 'vitest';
import { applyClose, applyOpen, applyToggle, canOpen, closeAll, isOpen } from './panelManager';

describe('panelManager', () => {
  it('opens and closes panels without mutating the input state', () => {
    const current = { notes: true, nodeNote: false } as const;
    expect(isOpen(current, 'notes')).toBe(true);
    expect(isOpen(undefined, 'notes')).toBe(false);
    expect(applyClose(current, 'notes')).toEqual({ notes: false, nodeNote: false });
    expect(current).toEqual({ notes: true, nodeNote: false });
  });

  it('supports exclusive panels and exclusiveWith guards', () => {
    expect(applyOpen({ notes: true, nodeNote: true }, 'vimSettings', { exclusive: true }))
      .toEqual({ notes: false, nodeNote: false, vimSettings: true });
    expect(canOpen({ notes: true }, 'nodeNote', { exclusiveWith: ['notes'] })).toBe(false);
    expect(applyOpen({ notes: true }, 'nodeNote', { exclusiveWith: ['notes'] }))
      .toEqual({ notes: true });
  });

  it('toggles panels and closes all panels', () => {
    expect(applyToggle(undefined, 'notes')).toEqual({ notes: true });
    expect(applyToggle({ notes: true }, 'notes')).toEqual({ notes: false });
    expect(closeAll()).toEqual({});
  });
});
