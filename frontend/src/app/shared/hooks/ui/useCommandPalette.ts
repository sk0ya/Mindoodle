

import { useState, useEffect } from 'react';
import { useStableCallback } from '../utilities/useStableCallback';

export interface UseCommandPaletteOptions {
  
  enabled?: boolean;
  
  shortcut?: string;
}

export interface UseCommandPaletteReturn {
  
  isOpen: boolean;
  
  open: () => void;
  
  close: () => void;
  
  toggle: () => void;
}


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

  
  const parseShortcut = useStableCallback((shortcutString: string) => {
    const parts = shortcutString.toLowerCase().split('+');
    return {
      ctrl: parts.includes('ctrl') || parts.includes('cmd'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1],
    };
  });

  
  useEffect(() => {
    if (!enabled) return;

    const shortcutConfig = parseShortcut(shortcut);

    const handleKeyDown = (event: KeyboardEvent) => {
      
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (isInputElement) return;

      
      const ctrlPressed = event.ctrlKey || event.metaKey; 
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