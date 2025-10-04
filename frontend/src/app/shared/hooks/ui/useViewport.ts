/**
 * useViewport hook
 *
 * React hook for reactive viewport size tracking.
 * Automatically updates on window resize.
 */

import { useState, useEffect } from 'react';
import { viewportService } from '@/app/core/services';
import type { ViewportSize } from '@/app/core/services';

/**
 * Hook to track viewport dimensions reactively
 * @param throttleMs - Throttle resize events (default: 100ms)
 */
export function useViewport(throttleMs: number = 100): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => viewportService.getSize());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setSize(viewportService.getSize());
      }, throttleMs);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [throttleMs]);

  return size;
}

/**
 * Hook to get viewport width only
 */
export function useViewportWidth(throttleMs: number = 100): number {
  const { width } = useViewport(throttleMs);
  return width;
}

/**
 * Hook to get viewport height only
 */
export function useViewportHeight(throttleMs: number = 100): number {
  const { height } = useViewport(throttleMs);
  return height;
}
