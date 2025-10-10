/**
 * Command Palette Hook
 * Manages command palette state and keyboard shortcuts
 */

import { useState, useEffect } from 'react';
import { useStableCallback } from '../utilities';

export interface UseCommandPaletteOptions {
  /** Whether the command palette is enabled */
  enabled?: boolean;
  /** Custom keyboard shortcut (default: 'ctrl+p') */
  shortcut?: string;
}

export interface UseCommandPaletteReturn {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Open the command palette */
  open: () => void;
  /** Close the command palette */
  close: () => void;
  /** Toggle the command palette */
  toggle: () => void;
}

/**
 * Hook for managing command palette state and keyboard shortcuts
 */
export function useCommandPalette(options: UseCommandPaletteOptions = {}): UseCommandPaletteReturn {
  const { enabled = true, shortcut = 'ctrl+p' } = options;
  const [isOpen, setIsOpen] = useState(false);

  const open = useStableCallback(() => {
    if (enabled) {
      setIsOpen(true);
    }
  });

  const close = useStableCallback(() => {
    setIsOpen(false);
  });

  const toggle = useStableCallback(() => {
    if (enabled) {
      setIsOpen(prev => !prev);
    }
  });

  // Parse keyboard shortcut
  const parseShortcut = useStableCallback((shortcutString: string) => {
    const parts = shortcutString.toLowerCase().split('+');
    return {
      ctrl: parts.includes('ctrl') || parts.includes('cmd'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1],
    };
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;

    const shortcutConfig = parseShortcut(shortcut);

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea/contenteditable
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (isInputElement) return;

      // Check if the shortcut matches
      const ctrlPressed = event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
      const altPressed = event.altKey;
      const shiftPressed = event.shiftKey;
      const keyPressed = event.key.toLowerCase();

      if (
        ctrlPressed === shortcutConfig.ctrl &&
        altPressed === shortcutConfig.alt &&
        shiftPressed === shortcutConfig.shift &&
        keyPressed === shortcutConfig.key
      ) {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }

      // Also handle Escape to close when open
      if (isOpen && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, shortcut, isOpen, toggle, close, parseShortcut]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}