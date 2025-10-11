

import { useCallback, useMemo, useRef } from 'react';


export function useCallbackSetter<T>(setter: (value: T) => void) {
  return useCallback((value: T) => setter(value), [setter]);
}


export function useBooleanSetters(
  setTrue: () => void,
  setFalse: () => void,
  toggle: () => void
) {
  return {
    setTrue: useCallback(() => setTrue(), [setTrue]),
    setFalse: useCallback(() => setFalse(), [setFalse]),
    toggle: useCallback(() => toggle(), [toggle])
  };
}


export function useModeSetters<T extends string>(
  setMode: (mode: T) => void,
  modes: T[]
) {
  return useMemo(() => {
    const setters = {} as Record<`set${Capitalize<T>}Mode`, () => void>;
    for (const mode of modes) {
      const m = mode as unknown as string;
      const key = `set${m.charAt(0).toUpperCase() + m.slice(1)}Mode` as `set${Capitalize<T>}Mode`;
      setters[key] = () => setMode(mode);
    }
    return setters;
  }, [setMode, modes]);
}


export function useResetCallbacks<T extends Record<string, () => void>>(resetters: T): T {
  return useMemo(() => {
    const callbacks = {} as T;
    for (const [key, resetter] of Object.entries(resetters as Record<string, () => void>)) {
      callbacks[key as keyof T] = (() => resetter()) as T[keyof T];
    }
    return callbacks;
  }, [resetters]);
}


export function useConditionalCallback(
  callback: () => void,
  condition: boolean | (() => boolean)
) {
  return useCallback(() => {
    const shouldExecute = typeof condition === 'function' ? condition() : condition;
    if (shouldExecute) {
      callback();
    }
  }, [callback, condition]);
}


export function useAsyncCallback<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>
) {
  return useCallback(async (...args: T): Promise<R> => {
    return asyncFn(...args);
  }, [asyncFn]);
}


export function useSafeCallback<T extends unknown[]>(
  callback: (...args: T) => void,
  onError?: (error: Error) => void
) {
  return useCallback((...args: T) => {
    try {
      callback(...args);
    } catch (error) {
      console.error('Callback error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [callback, onError]);
}


export function useDebounceCallback<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((...args: T) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
      timeoutRef.current = null;
    }, delay);
  }, [callback, delay]);
}


export function useOnceCallback<T extends unknown[]>(
  callback: (...args: T) => void
) {
  const hasExecutedRef = useRef(false);
  return useCallback((...args: T) => {
    if (!hasExecutedRef.current) {
      hasExecutedRef.current = true;
      callback(...args);
    }
  }, [callback]);
}


export function useHandlerCallbacks<T extends Record<string, (...args: unknown[]) => void>>(
  handlers: T
): T {
  return useMemo(() => {
    const callbacks = {} as T;
    for (const [key, handler] of Object.entries(handlers)) {
      callbacks[key as keyof T] = ((...args: unknown[]) => (handler as (...a: unknown[]) => void)(...args)) as T[keyof T];
    }
    return callbacks;
  }, [handlers]);
}


export function useGetterCallback<T>(
  getter: () => T
) {
  return useCallback((): T => getter(), [getter]);
}
