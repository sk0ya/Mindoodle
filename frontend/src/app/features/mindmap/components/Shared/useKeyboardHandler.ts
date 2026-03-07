import { useCallback } from 'react';
import { useEventListener } from '@shared/hooks/system/useEventListener';

/**
 * Shared keyboard event handler
 * Reusable for Escape key and other keyboard shortcuts
 */
export const useEscapeKey = (
  isEnabled: boolean,
  onEscape: () => void
) => {
  const handleKeyDown = useCallback(
    (event: Event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'Escape') {
        onEscape();
      }
    },
    [onEscape]
  );

  useEventListener('keydown', handleKeyDown, { target: document, enabled: isEnabled });
};
