/**
 * Functional React utilities
 * Reduce boilerplate and duplication in React components and hooks
 */

import { useCallback, useMemo, useRef, useEffect, useState, type DependencyList } from 'react';

/**
 * Create a boolean state with toggle, setTrue, setFalse helpers
 * Replaces repetitive useState + useCallback patterns
 */
export const useBooleanState = (initial = false) => {
  const [value, setValue] = useState(initial);

  return useMemo(() => ({
    value,
    toggle: () => setValue(v => !v),
    setTrue: () => setValue(true),
    setFalse: () => setValue(false),
    setValue
  }), [value]);
};

/**
 * Create multiple boolean states at once
 */

/**
 * Stable callback that never changes reference
 * Eliminates need for useCallback with dependencies
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T
): T => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
};

/**
 * Create multiple stable callbacks at once
 */

/**
 * Memoize a value with a stable reference
 * Like useMemo but with better control
 */

/**
 * Create an event handler that prevents default and stops propagation
 */

/**
 * Create multiple event handlers with preventDefault/stopPropagation
 */

/**
 * Create derived state from multiple sources
 * Memoizes the result automatically
 */

/**
 * Create multiple derived values at once
 */

/**
 * Conditionally run effect
 */

/**
 * Run effect only once when condition becomes true
 */

/**
 * Create a state object with updater functions
 * Eliminates multiple useState calls
 */

/**
 * Capitalize first letter
 */
const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Handle async operations with loading/error states
 */

/**
 * Get previous value of a state or prop
 */

/**
 * Detect when a value changes
 */

/**
 * Debounced value
 */

/**
 * Debounced callback
 */

/**
 * Throttled callback
 */

/**
 * Array state with helper methods
 */

/**
 * Map state with helper methods
 */

/**
 * Set state with helper methods
 */
