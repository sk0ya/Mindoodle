

import { useCallback, useEffect, useRef } from 'react';


export function stopEventPropagation(e: Event | React.SyntheticEvent): void {
  e.preventDefault();
  e.stopPropagation();
}


export function stopPropagationOnly(e: Event | React.SyntheticEvent): void {
  e.stopPropagation();
}


export function preventDefaultOnly(e: Event | React.SyntheticEvent): void {
  e.preventDefault();
}


export function useClickOutside<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  enabled: boolean = true
) {
  const ref = useRef<T>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      callback();
    }
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, enabled]);

  return ref;
}


export function createConditionalClickHandler(
  condition: boolean | (() => boolean),
  callback: () => void
) {
  return () => {
    const shouldExecute = typeof condition === 'function' ? condition() : condition;
    if (shouldExecute) {
      callback();
    }
  };
}


export function combineEventHandlers<T extends Event | React.SyntheticEvent>(
  ...handlers: Array<(e: T) => void | undefined>
) {
  return (e: T) => {
    handlers.forEach(handler => {
      if (handler) {
        handler(e);
      }
    });
  };
}


export function createSafeClickHandler(
  callback: () => void,
  onError?: (error: Error) => void
) {
  return () => {
    try {
      callback();
    } catch (error) {
      console.error('Click handler error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };
}


export function createDebounceClickHandler(
  callback: () => void,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let isExecuting = false;

  return () => {
    if (isExecuting) return;

    isExecuting = true;
    callback();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      isExecuting = false;
      timeoutId = null;
    }, delay);
  };
}