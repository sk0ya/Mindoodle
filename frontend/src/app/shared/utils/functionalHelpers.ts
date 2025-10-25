/**
 * Functional programming utilities
 * Generic helpers for array, object, and data manipulation
 */

// === Array Utilities ===

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
export const compose = <T>(...fns: Array<(arg: T) => T>) =>
  (value: T): T => fns.reduceRight((acc, fn) => fn(acc), value);

/**
 * Group array items by a key function
 */
export const groupBy = <T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> =>
  array.reduce((groups, item) => {
    const key = keyFn(item);
    return {
      ...groups,
      [key]: [...(groups[key] || []), item]
    };
  }, {} as Record<K, T[]>);

/**
 * Chunk array into smaller arrays of specified size
 */
export const chunk = <T>(array: T[], size: number): T[][] =>
  Array.from(
    { length: Math.ceil(array.length / size) },
    (_, i) => array.slice(i * size, i * size + size)
  );

/**
 * Remove duplicates from array using a key function
 */
export const uniqueBy = <T, K>(array: T[], keyFn: (item: T) => K): T[] => {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Partition array into two arrays based on predicate
 * Returns [passing, failing]
 */
export const partition = <T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] =>
  array.reduce(
    ([pass, fail], item) =>
      predicate(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
    [[], []] as [T[], T[]]
  );

/**
 * Sort array by multiple keys
 */
export const sortBy = <T>(...keyFns: Array<(item: T) => number | string>) =>
  (array: T[]): T[] =>
    [...array].sort((a, b) => {
      for (const keyFn of keyFns) {
        const aKey = keyFn(a);
        const bKey = keyFn(b);
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
      }
      return 0;
    });

// === Object Utilities ===

/**
 * Pick specific keys from object
 */
export const pick = <T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> =>
  keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {} as Pick<T, K>);

/**
 * Omit specific keys from object
 */
export const omit = <T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> => {
  const keysSet = new Set(keys);
  return Object.keys(obj).reduce((acc, key) => {
    if (!keysSet.has(key as K)) {
      (acc as Record<string, unknown>)[key] = obj[key as keyof T];
    }
    return acc;
  }, {} as Omit<T, K>);
};

/**
 * Map object values
 */
export const mapValues = <T extends object, R>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => R
): Record<keyof T, R> =>
  Object.keys(obj).reduce((acc, key) => {
    const k = key as keyof T;
    acc[k] = fn(obj[k], k);
    return acc;
  }, {} as Record<keyof T, R>);

/**
 * Filter object by predicate
 */
export const filterObject = <T extends object>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> =>
  Object.keys(obj).reduce((acc, key) => {
    const k = key as keyof T;
    if (predicate(obj[k], k)) {
      acc[k] = obj[k];
    }
    return acc;
  }, {} as Partial<T>);

// === Function Utilities ===

/**
 * Memoize function results
 */
export const memoize = <T extends (...args: unknown[]) => unknown>(
  fn: T
): T => {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Debounce function execution
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle function execution
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

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

// === Conditional Utilities ===

/**
 * Safe property access with default value
 */
export const getOr = <T, K extends keyof T, D>(
  obj: T | null | undefined,
  key: K,
  defaultValue: D
): T[K] | D =>
  obj?.[key] ?? defaultValue;

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

// === Type Guards ===

/**
 * Check if value is defined (not null or undefined)
 */
export const isDefined = <T>(value: T | null | undefined): value is T =>
  value != null;

/**
 * Check if value is non-empty array
 */
export const isNonEmptyArray = <T>(value: unknown): value is [T, ...T[]] =>
  Array.isArray(value) && value.length > 0;

/**
 * Check if value is non-empty string
 */
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
