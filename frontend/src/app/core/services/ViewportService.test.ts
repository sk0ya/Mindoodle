import { describe, expect, it } from 'vitest';
import { viewportService } from './ViewportService';

describe('viewportService', () => {
  it('reads viewport dimensions and derives note limits', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    expect(viewportService.getSize()).toEqual({ width: 1000, height: 800 });
    expect(viewportService.getCenter()).toEqual({ x: 500, y: 400 });
    expect(viewportService.getDefaultNoteHeight()).toBe(240);
    expect(viewportService.getMaxNoteHeight()).toBe(640);
    expect(viewportService.getMaxAllowedNoteHeight()).toBe(720);
    expect(viewportService.fitsInViewport(1000, 800)).toBe(true);
    expect(viewportService.fitsInViewport(1001, 800)).toBe(false);
  });

  it('bounds positions and checks viewport membership', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    expect(viewportService.getBoundedPosition(-10, 900, 100, 200)).toEqual({ x: 0, y: 600 });
    expect(viewportService.isInViewport(0, 0)).toBe(true);
    expect(viewportService.isInViewport(1000, 800)).toBe(true);
    expect(viewportService.isInViewport(-1, 0)).toBe(false);
  });
});
