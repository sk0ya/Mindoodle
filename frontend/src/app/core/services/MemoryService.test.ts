import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryService } from './MemoryService';

describe('memoryService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    memoryService.cleanup();
  });

  afterEach(() => {
    memoryService.cleanup();
    vi.useRealTimers();
  });

  it('tracks and removes managed timeouts and intervals', () => {
    const callback = vi.fn();
    const timeout = memoryService.createManagedTimeout(callback, 100, 'one-shot');
    const interval = memoryService.createManagedInterval(callback, 50, 'repeating');

    expect(memoryService.getTimerStatus()).toMatchObject({
      activeTimers: 2,
      timerDescriptions: ['one-shot', 'repeating'],
    });

    memoryService.clearManagedTimer(timeout);
    vi.advanceTimersByTime(160);
    expect(callback).toHaveBeenCalledTimes(3);

    memoryService.clearManagedTimer(interval);
    expect(memoryService.getTimerStatus().activeTimers).toBe(0);
  });

  it('resets monitoring state during cleanup so it can be restarted', () => {
    memoryService.startMonitoring(1000);
    expect(memoryService.getTimerStatus().timerDescriptions).toContain('Memory monitoring');

    memoryService.cleanup();
    expect(memoryService.getTimerStatus().activeTimers).toBe(0);

    memoryService.startMonitoring(1000);
    expect(memoryService.getTimerStatus().timerDescriptions).toContain('Memory monitoring');
  });

  it('takes snapshots and generates a report with timer recommendations', () => {
    for (let i = 0; i < 11; i += 1) {
      memoryService.createManagedTimeout(() => undefined, 10000, `timer-${i}`);
    }

    const snapshot = memoryService.takeSnapshot();
    expect(snapshot.timers).toBe(11);
    expect(memoryService.generateReport()).toMatchObject({
      current: snapshot,
      recommendations: ['Consider reducing the number of active timers'],
      trends: { memoryTrend: 'stable', timerTrend: 'stable' },
    });
  });

  it('executes cleanup callbacks and continues when one throws', () => {
    const first = vi.fn(() => { throw new Error('ignored'); });
    const second = vi.fn();
    memoryService.registerCleanup(first);
    memoryService.registerCleanup(second);

    expect(() => memoryService.cleanup()).not.toThrow();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(memoryService.getTimerStatus().cleanupCallbacks).toBe(0);
  });
});
