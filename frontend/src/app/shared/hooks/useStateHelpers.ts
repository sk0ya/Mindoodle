/**
 * Functional utilities for React state management
 * Reduces boilerplate in useState/useCallback patterns
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';

/**
 * Creates a setter function that updates a single property in state
 * Eliminates repetitive setState(prev => ({ ...prev, key: value })) patterns
 */
export function createStateSetter<T, K extends keyof T>(
  setState: Dispatch<SetStateAction<T>>,
  key: K
): (value: T[K]) => void {
  return (value: T[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };
}

/**
 * Creates multiple state setters at once
 * Returns an object with setter functions for each specified key
 */
export function createStateSetters<T>(
  setState: Dispatch<SetStateAction<T>>,
  keys: (keyof T)[]
): Record<string, (value: unknown) => void> {
  const setters: Record<string, (value: unknown) => void> = {};

  keys.forEach((key) => {
    setters[`set${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}`] =
      createStateSetter(setState, key);
  });

  return setters;
}

/**
 * Creates a memoized setter using useCallback
 * Combines createStateSetter with useCallback for optimal performance
 */
export function useMemoizedSetter<T, K extends keyof T>(
  setState: Dispatch<SetStateAction<T>>,
  key: K,
  deps: unknown[] = []
): (value: T[K]) => void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(createStateSetter(setState, key), [setState, key, ...deps]);
}

/**
 * Creates a setter that appends to a string property
 */
export function createStringAppender<T, K extends keyof T>(
  setState: Dispatch<SetStateAction<T>>,
  key: K
): (char: string) => void {
  return (char: string) => {
    setState((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown as string) + char
    }));
  };
}

/**
 * Creates a setter that clears a property (sets to empty string or empty array)
 */
export function createClearer<T, K extends keyof T>(
  setState: Dispatch<SetStateAction<T>>,
  key: K,
  emptyValue: T[K]
): () => void {
  return () => {
    setState((prev) => ({ ...prev, [key]: emptyValue }));
  };
}

/**
 * Creates a toggle function for boolean properties
 */
export function createToggler<T, K extends keyof T>(
  setState: Dispatch<SetStateAction<T>>,
  key: K
): () => void {
  return () => {
    setState((prev) => ({
      ...prev,
      [key]: !prev[key] as T[K]
    }));
  };
}

/**
 * Batch multiple state updates into a single setState call
 */
export function createBatchSetter<T>(
  setState: Dispatch<SetStateAction<T>>
): (updates: Partial<T>) => void {
  return (updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };
}
