

import { useState, useEffect } from 'react';
import { viewportService, type ViewportSize } from '@/app/core/services';


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


export function useViewportWidth(throttleMs: number = 100): number {
  const { width } = useViewport(throttleMs);
  return width;
}


export function useViewportHeight(throttleMs: number = 100): number {
  const { height } = useViewport(throttleMs);
  return height;
}
