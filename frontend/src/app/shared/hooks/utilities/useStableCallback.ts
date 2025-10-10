import { useCallback, useEffect, useRef } from 'react';

/**
 * useStableCallback
 *
 * Creates a stable callback reference that always calls the latest version of the provided function.
 * This solves the stale closure problem without requiring exhaustive dependency arrays.
 *
 * @template T - The function signature
 * @param callback - The callback function to stabilize
 * @returns A stable callback reference
 *
 * @example
 * ```tsx
 * // Instead of:
 * const handleClick = useCallback(() => {
 *   console.log(someValue);
 * }, [someValue]);
 *
 * // Use:
 * const handleClick = useStableCallback(() => {
 *   console.log(someValue);
 * });
 * ```
 *
 * Benefits:
 * - Eliminates stale closure bugs
 * - Reduces boilerplate (no dependency arrays)
 * - Maintains referential stability for child component props
 * - Always calls the latest version of the callback
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  // Update ref on each render to capture latest closure
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Return stable callback that invokes the latest ref
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}
