/**
 * Optimized React callback hooks
 * Reduces boilerplate for common callback patterns
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Create multiple callbacks at once with automatic memoization
 * Eliminates repetitive useCallback definitions
 */
export function useCallbacks<T extends Record<string, (...args: unknown[]) => unknown>>(
  callbacks: T,
  deps: unknown[] = []
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callbacks, deps) as T;
}

/**
 * Create event handlers with automatic event.preventDefault()
 */
export function usePreventDefaultHandlers<
  T extends Record<string, (e: Event, ...args: unknown[]) => unknown>
>(handlers: T): T {
  return useMemo(
    () =>
      Object.keys(handlers).reduce((acc, key) => {
        const handler = handlers[key as keyof T];
        acc[key as keyof T] = ((e: Event, ...args: unknown[]) => {
          e.preventDefault();
          return handler(e, ...args);
        }) as T[keyof T];
        return acc;
      }, {} as T),
    [handlers]
  );
}

/**
 * Create debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  deps: unknown[] = []
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...deps]
  );
}

/**
 * Create throttled callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number,
  deps: unknown[] = []
): T {
  const inThrottleRef = useRef(false);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (!inThrottleRef.current) {
        callback(...args);
        inThrottleRef.current = true;
        setTimeout(() => (inThrottleRef.current = false), limit);
      }
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, limit, ...deps]
  );
}

/**
 * Create callback that only executes once
 */
export function useOnceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: unknown[] = []
): T {
  const calledRef = useRef(false);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (!calledRef.current) {
        calledRef.current = true;
        return callback(...args);
      }
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, ...deps]
  );
}

/**
 * Create async callback with loading state
 */
export function useAsyncCallback<T extends unknown[], R>(
  callback: (...args: T) => Promise<R>
): {
  execute: (...args: T) => Promise<R | undefined>;
  loading: boolean;
  error: Error | null;
} {
  const [state, setState] = React.useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null
  });

  const execute = useCallback(
    async (...args: T): Promise<R | undefined> => {
      setState({ loading: true, error: null });
      try {
        const result = await callback(...args);
        setState({ loading: false, error: null });
        return result;
      } catch (error) {
        setState({ loading: false, error: error as Error });
        return undefined;
      }
    },
    [callback]
  );

  return { execute, loading: state.loading, error: state.error };
}

/**
 * Create stable callback reference that always uses latest function
 * Useful when you want to avoid re-renders but use latest closure
 */
export function useLatestCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}

/**
 * Create callbacks with automatic error boundary
 */
export function useSafeCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  onError?: (error: Error) => void
): T {
  return useCallback(
    ((...args: Parameters<T>) => {
      try {
        return callback(...args);
      } catch (error) {
        if (onError) onError(error as Error);
        console.error('Callback error:', error);
      }
    }) as T,
    [callback, onError]
  );
}

/**
 * Batch multiple state updates into one callback
 */
export function useBatchCallback<S>(
  updates: Array<(state: S) => S>,
  setState: React.Dispatch<React.SetStateAction<S>>
): () => void {
  return useCallback(() => {
    setState(prev => updates.reduce((acc, update) => update(acc), prev));
  }, [updates, setState]);
}

// Add React import for useAsyncCallback
import * as React from 'react';
