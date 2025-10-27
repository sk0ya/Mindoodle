/**
 * Functional React utilities
 * Reduce boilerplate and duplication in React components and hooks
 */

import { useCallback, useMemo, useRef, useEffect, useState, type DependencyList } from 'react';

// === State Management ===

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
export const useBooleanStates = <T extends string>(
  ...names: T[]
): Record<T, ReturnType<typeof useBooleanState>> =>
  useMemo(
    () =>
      names.reduce((acc, name) => {
        acc[name] = useBooleanState();
        return acc;
      }, {} as Record<T, ReturnType<typeof useBooleanState>>),
    [names.join(',')]
  );

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
export const useStableCallbacks = <T extends Record<string, (...args: any[]) => any>>(
  callbacks: T
): T => {
  const refs = useRef(callbacks);

  useEffect(() => {
    refs.current = callbacks;
  });

  return useMemo(
    () =>
      Object.keys(callbacks).reduce((acc, key) => {
        acc[key as keyof T] = ((...args: any[]) =>
          refs.current[key as keyof T](...args)
        ) as T[keyof T];
        return acc;
      }, {} as T),
    [Object.keys(callbacks).join(',')]
  );
};

/**
 * Memoize a value with a stable reference
 * Like useMemo but with better control
 */
export const useStableValue = <T>(
  factory: () => T,
  deps: DependencyList
): T => {
  const valueRef = useRef<T>();
  const depsRef = useRef<DependencyList>();

  const hasChanged = !depsRef.current ||
    deps.length !== depsRef.current.length ||
    deps.some((dep, i) => !Object.is(dep, depsRef.current?.[i]));

  if (hasChanged) {
    valueRef.current = factory();
    depsRef.current = deps;
  }

  return valueRef.current as T;
};

// === Event Handlers ===

/**
 * Create an event handler that prevents default and stops propagation
 */
export const usePreventDefault = <T extends Event>(
  handler?: (e: T) => void
) => useStableCallback((e: T) => {
  e.preventDefault();
  e.stopPropagation();
  handler?.(e);
});

/**
 * Create multiple event handlers with preventDefault/stopPropagation
 */
export const usePreventDefaults = <T extends Record<string, (e: Event) => void>>(
  handlers: T
): T =>
  useMemo(
    () =>
      Object.keys(handlers).reduce((acc, key) => {
        acc[key as keyof T] = ((e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          handlers[key as keyof T](e);
        }) as T[keyof T];
        return acc;
      }, {} as T),
    [Object.keys(handlers).join(',')]
  );

// === Derived State ===

/**
 * Create derived state from multiple sources
 * Memoizes the result automatically
 */
export const useDerived = <T, Deps extends readonly unknown[]>(
  compute: (...deps: Deps) => T,
  ...deps: Deps
): T => useMemo(() => compute(...deps), deps);

/**
 * Create multiple derived values at once
 */
export const useDerivedValues = <T extends Record<string, () => any>>(
  computations: T
): { [K in keyof T]: ReturnType<T[K]> } =>
  useMemo(
    () =>
      Object.keys(computations).reduce((acc, key) => {
        acc[key as keyof T] = computations[key as keyof T]();
        return acc;
      }, {} as { [K in keyof T]: ReturnType<T[K]> }),
    [Object.keys(computations).join(',')]
  );

// === Conditional Hooks ===

/**
 * Conditionally run effect
 */
export const useEffectWhen = (
  condition: boolean,
  effect: () => void | (() => void),
  deps: DependencyList = []
) => {
  useEffect(() => {
    if (condition) return effect();
  }, [condition, ...deps]);
};

/**
 * Run effect only once when condition becomes true
 */
export const useEffectOnce = (
  condition: boolean,
  effect: () => void | (() => void)
) => {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (condition && !hasRunRef.current) {
      hasRunRef.current = true;
      return effect();
    }
  }, [condition]);
};

// === State Reducers ===

/**
 * Create a state object with updater functions
 * Eliminates multiple useState calls
 */
export const useStateObject = <T extends Record<string, unknown>>(
  initial: T
) => {
  const [state, setState] = useState(initial);

  const updaters = useMemo(
    () =>
      Object.keys(initial).reduce((acc, key) => {
        const k = key as keyof T;
        acc[`set${capitalize(key)}`] = (value: T[typeof k] | ((prev: T[typeof k]) => T[typeof k])) =>
          setState(prev => ({
            ...prev,
            [k]: typeof value === 'function' ? (value as (prev: T[typeof k]) => T[typeof k])(prev[k]) : value
          }));
        return acc;
      }, {} as Record<string, (value: any) => void>),
    []
  );

  const reset = useCallback(() => setState(initial), []);
  const update = useCallback((partial: Partial<T>) =>
    setState(prev => ({ ...prev, ...partial })), []
  );

  return { ...state, ...updaters, reset, update };
};

/**
 * Capitalize first letter
 */
const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

// === Async State ===

/**
 * Handle async operations with loading/error states
 */
export const useAsyncState = <T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>
) => {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null
  });

  const execute = useStableCallback(async (...args: Args) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await asyncFn(...args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
      throw error;
    }
  });

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
};

// === Previous Value ===

/**
 * Get previous value of a state or prop
 */
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

/**
 * Detect when a value changes
 */
export const useChanged = <T>(value: T): boolean => {
  const prev = usePrevious(value);
  return prev !== undefined && !Object.is(prev, value);
};

// === Debounce & Throttle ===

/**
 * Debounced value
 */
export const useDebounced = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Debounced callback
 */
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useStableCallback(((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }) as T);
};

/**
 * Throttled callback
 */
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T => {
  const inThrottleRef = useRef(false);

  return useStableCallback(((...args) => {
    if (!inThrottleRef.current) {
      callback(...args);
      inThrottleRef.current = true;
      setTimeout(() => (inThrottleRef.current = false), limit);
    }
  }) as T);
};

// === Array State Helpers ===

/**
 * Array state with helper methods
 */
export const useArrayState = <T>(initial: T[] = []) => {
  const [array, setArray] = useState(initial);

  return useMemo(() => ({
    array,
    push: (...items: T[]) => setArray(prev => [...prev, ...items]),
    pop: () => setArray(prev => prev.slice(0, -1)),
    shift: () => setArray(prev => prev.slice(1)),
    unshift: (...items: T[]) => setArray(prev => [...items, ...prev]),
    remove: (index: number) => setArray(prev => prev.filter((_, i) => i !== index)),
    removeWhere: (predicate: (item: T) => boolean) =>
      setArray(prev => prev.filter(item => !predicate(item))),
    update: (index: number, value: T) =>
      setArray(prev => prev.map((item, i) => i === index ? value : item)),
    clear: () => setArray([]),
    set: setArray,
    reset: () => setArray(initial)
  }), [array]);
};

// === Map/Set State Helpers ===

/**
 * Map state with helper methods
 */
export const useMapState = <K, V>(initial?: Map<K, V>) => {
  const [map, setMap] = useState(initial || new Map<K, V>());

  return useMemo(() => ({
    map,
    set: (key: K, value: V) => setMap(prev => new Map(prev).set(key, value)),
    delete: (key: K) => setMap(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    }),
    clear: () => setMap(new Map()),
    reset: () => setMap(initial || new Map())
  }), [map]);
};

/**
 * Set state with helper methods
 */
export const useSetState = <T>(initial?: Set<T>) => {
  const [set, setSet] = useState(initial || new Set<T>());

  return useMemo(() => ({
    set,
    add: (value: T) => setSet(prev => new Set(prev).add(value)),
    delete: (value: T) => setSet(prev => {
      const next = new Set(prev);
      next.delete(value);
      return next;
    }),
    toggle: (value: T) => setSet(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    }),
    clear: () => setSet(new Set()),
    reset: () => setSet(initial || new Set())
  }), [set]);
};
