/**
 * Functional programming utilities
 * Generic helpers for array, object, and data manipulation
 */

/**
 * Pipe: Compose functions from left to right
 * const result = pipe(data, fn1, fn2, fn3)
 */
export const pipe = <T>(value: T, ...fns: Array<(arg: T) => T>): T =>
  fns.reduce((acc, fn) => fn(acc), value);

/**
 * Compose: Compose functions from right to left
 * const fn = compose(fn3, fn2, fn1); fn(data)
 */

/**
 * Group array items by a key function
 */

/**
 * Chunk array into smaller arrays of specified size
 */

/**
 * Remove duplicates from array using a key function
 */

/**
 * Partition array into two arrays based on predicate
 * Returns [passing, failing]
 */

/**
 * Sort array by multiple keys
 */

/**
 * Pick specific keys from object
 */

/**
 * Omit specific keys from object
 */

/**
 * Map object values
 */

/**
 * Filter object by predicate
 */

/**
 * Memoize function results
 */

/**
 * Debounce function execution
 */

/**
 * Throttle function execution
 */

/**
 * Retry function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed');
};

/**
 * Safe property access with default value
 */

/**
 * Conditional execution
 */
export const when = <T>(
  condition: boolean,
  fn: () => T
): T | undefined =>
  condition ? fn() : undefined;

/**
 * Unless (inverse of when)
 */
export const unless = <T>(
  condition: boolean,
  fn: () => T
): T | undefined =>
  !condition ? fn() : undefined;

/**
 * Safe chain: execute function only if value is not null/undefined
 */
export const chain = <T, R>(
  value: T | null | undefined,
  fn: (val: T) => R
): R | undefined =>
  value != null ? fn(value) : undefined;

/**
 * Check if value is defined (not null or undefined)
 */

/**
 * Check if value is non-empty array
 */

/**
 * Check if value is non-empty string
 */
