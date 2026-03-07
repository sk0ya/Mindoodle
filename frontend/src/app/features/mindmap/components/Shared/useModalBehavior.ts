import { useEffect, useCallback } from 'react';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { useEscapeKey } from './useKeyboardHandler';

/**
 * Hook for standard modal behaviors:
 * - Body scroll lock when modal is open
 * - Close on Escape key
 * - Close on backdrop click
 */
export const useModalBehavior = (
  isOpen: boolean,
  onClose: () => void,
  options: {
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    lockBodyScroll?: boolean;
  } = {}
) => {
  const {
    closeOnEscape = true,
    closeOnBackdrop = true,
    lockBodyScroll = true,
  } = options;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!lockBodyScroll) return;

    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, lockBodyScroll]);

  // Handle Escape key using shared hook
  useEscapeKey(isOpen && closeOnEscape, onClose);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  return {
    handleBackdropClick,
  };
};

/**
 * Hook for managing click outside behavior
 * Useful for menus and popups within modals
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  isOpen: boolean,
  onClose: () => void,
  options: {
    closeOnEscape?: boolean;
  } = {}
) => {
  const { closeOnEscape = true } = options;

  const handleClickOutside = useCallback(
    (event: Event) => {
      const e = event as MouseEvent;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [ref, onClose]
  );

  useEventListener('mousedown', handleClickOutside, { target: document, enabled: isOpen });
  // Use shared Escape key handler
  useEscapeKey(isOpen && closeOnEscape, onClose);
};
