import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditingStateService, type EditingActivity } from './EditingStateService';

describe('EditingStateService', () => {
  let service: EditingStateService;

  beforeEach(() => {
    // Get singleton instance
    service = EditingStateService.getInstance();
    // Clean up before each test
    service.cleanup();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EditingStateService.getInstance();
      const instance2 = EditingStateService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('activity management', () => {
    it('should start an activity', () => {
      service.startActivity('typing');

      expect(service.isEditing()).toBe(true);
      expect(service.getActiveActivities()).toContain('typing');
    });

    it('should end an activity', () => {
      service.startActivity('typing');
      service.endActivity('typing');

      expect(service.isEditing()).toBe(false);
      expect(service.getActiveActivities()).not.toContain('typing');
    });

    it('should track multiple activities', () => {
      service.startActivity('typing');
      service.startActivity('dragging');
      service.startActivity('menu-open');

      expect(service.isEditing()).toBe(true);
      expect(service.getActiveActivities()).toHaveLength(3);
      expect(service.getActiveActivities()).toContain('typing');
      expect(service.getActiveActivities()).toContain('dragging');
      expect(service.getActiveActivities()).toContain('menu-open');
    });

    it('should end all activities', () => {
      service.startActivity('typing');
      service.startActivity('dragging');
      service.startActivity('menu-open');

      service.endAllActivities();

      expect(service.isEditing()).toBe(false);
      expect(service.getActiveActivities()).toHaveLength(0);
    });

    it('should remain in editing state while any activity is active', () => {
      service.startActivity('typing');
      service.startActivity('dragging');

      service.endActivity('typing');

      expect(service.isEditing()).toBe(true);
      expect(service.getActiveActivities()).toContain('dragging');
    });

    it('should handle duplicate activity starts', () => {
      service.startActivity('typing');
      service.startActivity('typing'); // Start same activity again

      expect(service.getActiveActivities()).toHaveLength(1);
    });

    it('should handle ending non-existent activity', () => {
      service.endActivity('typing'); // End activity that was never started

      expect(service.isEditing()).toBe(false);
    });
  });

  describe('activity types', () => {
    const activityTypes: EditingActivity[] = [
      'typing',
      'node-editing',
      'dragging',
      'menu-open',
      'modal-open',
    ];

    activityTypes.forEach((activity) => {
      it(`should handle ${activity} activity`, () => {
        service.startActivity(activity);

        expect(service.isEditing()).toBe(true);
        expect(service.getActiveActivities()).toContain(activity);

        service.endActivity(activity);

        expect(service.isEditing()).toBe(false);
      });
    });
  });

  describe('time tracking', () => {
    it('should track time since last activity', () => {
      const before = Date.now();
      service.startActivity('typing');
      const after = Date.now();

      const timeSince = service.getTimeSinceLastActivity();

      expect(timeSince).toBeGreaterThanOrEqual(0);
      expect(timeSince).toBeLessThanOrEqual(after - before + 10); // Allow 10ms tolerance
    });

    it('should update time on activity start', () => {
      vi.useFakeTimers();

      service.startActivity('typing');
      const time1 = service.getTimeSinceLastActivity();

      // Wait a bit
      vi.advanceTimersByTime(100);

      service.startActivity('dragging');
      const time2 = service.getTimeSinceLastActivity();

      vi.useRealTimers();

      // time2 should be less than time1 because the clock was reset
      expect(time2).toBeLessThanOrEqual(time1);
    });

    it('should update time on activity end', () => {
      service.startActivity('typing');

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      service.endActivity('typing');
      const timeSince = service.getTimeSinceLastActivity();

      vi.useRealTimers();

      expect(timeSince).toBeLessThan(50); // Should be very recent
    });
  });

  describe('activity timeout', () => {
    it('should clear activities after timeout', () => {
      service.startActivity('typing');

      expect(service.isEditing()).toBe(true);

      // Simulate timeout (10 seconds + 1ms)
      vi.useFakeTimers();
      vi.advanceTimersByTime(10001);

      expect(service.isEditing()).toBe(false);
      expect(service.getActiveActivities()).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should not clear activities before timeout', () => {
      service.startActivity('typing');

      vi.useFakeTimers();
      vi.advanceTimersByTime(5000); // 5 seconds (< 10 second timeout)

      expect(service.isEditing()).toBe(true);

      vi.useRealTimers();
    });

    it('should reset timeout on new activity', () => {
      service.startActivity('typing');

      vi.useFakeTimers();
      vi.advanceTimersByTime(8000); // 8 seconds

      service.startActivity('dragging'); // Reset timeout

      vi.advanceTimersByTime(8000); // Another 8 seconds (16 total, but only 8 since last activity)

      expect(service.isEditing()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('debugging', () => {
    it('should provide debug info', () => {
      service.startActivity('typing');
      service.startActivity('dragging');

      const debugInfo = service.getDebugInfo();

      expect(debugInfo.isEditing).toBe(true);
      expect(debugInfo.activeActivities).toHaveLength(2);
      expect(debugInfo.activeActivities).toContain('typing');
      expect(debugInfo.activeActivities).toContain('dragging');
      expect(debugInfo.timeSinceLastActivity).toBeGreaterThanOrEqual(0);
      expect(debugInfo.activityTimeout).toBe(10000);
    });

    it('should show empty state in debug info when no activities', () => {
      const debugInfo = service.getDebugInfo();

      expect(debugInfo.isEditing).toBe(false);
      expect(debugInfo.activeActivities).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all state on cleanup', () => {
      service.startActivity('typing');
      service.startActivity('dragging');

      service.cleanup();

      expect(service.isEditing()).toBe(false);
      expect(service.getActiveActivities()).toHaveLength(0);
      expect(service.getTimeSinceLastActivity()).toBeGreaterThan(0);
    });

    it('should handle cleanup when no activities', () => {
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid activity changes', () => {
      for (let i = 0; i < 100; i++) {
        service.startActivity('typing');
        service.endActivity('typing');
      }

      expect(service.isEditing()).toBe(false);
    });

    it('should handle mixed activity operations', () => {
      service.startActivity('typing');
      service.startActivity('dragging');
      service.endActivity('typing');
      service.startActivity('menu-open');
      service.endActivity('dragging');
      service.startActivity('modal-open');

      expect(service.isEditing()).toBe(true);
      expect(service.getActiveActivities()).toHaveLength(2);
      expect(service.getActiveActivities()).toContain('menu-open');
      expect(service.getActiveActivities()).toContain('modal-open');
    });
  });
});
