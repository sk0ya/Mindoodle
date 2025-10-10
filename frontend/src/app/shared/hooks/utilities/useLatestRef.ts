import { useEffect, useRef } from 'react';

/**
 * useLatestRef
 *
 * Creates a mutable ref that always contains the latest value.
 * Useful for accessing current state/props in callbacks without re-creating them.
 *
 * @template T - The type of the value to track
 * @param value - The value to keep updated in the ref
 * @returns A mutable ref object containing the latest value
 *
 * @example
 * ```tsx
 * // Instead of:
 * const valueRef = useRef(value);
 * useEffect(() => {
 *   valueRef.current = value;
 * }, [value]);
 *
 * // Use:
 * const valueRef = useLatestRef(value);
 *
 * // Then access in stable callbacks:
 * const stableCallback = useStableCallback(() => {
 *   console.log(valueRef.current);
 * });
 * ```
 *
 * Benefits:
 * - Simplifies ref updates
 * - Always contains the latest value
 * - Pairs well with useStableCallback
 * - Reduces boilerplate code
 */
export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
