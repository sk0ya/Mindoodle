import { useCallback, useState, useEffect, useRef } from 'react';
import { parseStoredJson, storeJson } from '@shared/utils';

export interface BooleanStateOptions {
  initialValue?: boolean;
  onToggle?: (newValue: boolean) => void;
  onTrue?: () => void;
  onFalse?: () => void;
}

export interface BooleanStateReturn {
  value: boolean;
  setTrue: () => void;
  setFalse: () => void;
  toggle: () => void;
  setValue: (value: boolean) => void;
}

/**
 * 汎用的なboolean状態管理フック
 * 単純なtrue/false状態とその操作メソッドを提供
 */
export const useBooleanState = (options: BooleanStateOptions = {}): BooleanStateReturn => {
  const { initialValue = false, onToggle, onTrue, onFalse } = options;
  const [value, setValue] = useState(initialValue);

  const setTrue = useCallback(() => {
    setValue(true);
    onToggle?.(true);
    onTrue?.();
  }, [onToggle, onTrue]);

  const setFalse = useCallback(() => {
    setValue(false);
    onToggle?.(false);
    onFalse?.();
  }, [onToggle, onFalse]);

  const toggle = useCallback(() => {
    setValue(prev => {
      const newValue = !prev;
      onToggle?.(newValue);
      if (newValue) {
        onTrue?.();
      } else {
        onFalse?.();
      }
      return newValue;
    });
  }, [onToggle, onTrue, onFalse]);

  const setValueCallback = useCallback((newValue: boolean) => {
    setValue(newValue);
    onToggle?.(newValue);
    if (newValue) {
      onTrue?.();
    } else {
      onFalse?.();
    }
  }, [onToggle, onTrue, onFalse]);

  return {
    value,
    setTrue,
    setFalse,
    toggle,
    setValue: setValueCallback,
  };
};

/**
 * より簡潔なAPI版 - useModal と同等だが命名がより汎用的
 */
export const useBooleanToggle = (initialValue = false) => {
  const { value, setTrue, setFalse, toggle } = useBooleanState({ initialValue });

  return {
    isActive: value,
    activate: setTrue,
    deactivate: setFalse,
    toggle,
  };
};

/**
 * Loading状態専用のフック
 */
export const useLoadingState = (initialValue = false) => {
  const { value, setTrue, setFalse, setValue } = useBooleanState({ initialValue });

  return {
    isLoading: value,
    startLoading: setTrue,
    stopLoading: setFalse,
    setLoading: setValue,
  };
};

/**
 * Resizing状態専用のフック
 */
export const useResizingState = (initialValue = false) => {
  const { value, setTrue, setFalse } = useBooleanState({ initialValue });

  return {
    isResizing: value,
    startResizing: setTrue,
    stopResizing: setFalse,
  };
};

/**
 * Hover状態専用のフック
 */
export const useHoverState = (initialValue = false) => {
  const { value, setTrue, setFalse } = useBooleanState({ initialValue });

  return {
    isHovered: value,
    handleMouseEnter: setTrue,
    handleMouseLeave: setFalse,
  };
};

// Mouse event listener管理のためのカスタムフック
export const useMouseEvents = (
  isActive: boolean,
  handlers: {
    onMouseMove?: (e: MouseEvent) => void;
    onMouseUp?: (e: MouseEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
  }
) => {
  useEffect(() => {
    if (!isActive) return;

    const { onMouseMove, onMouseUp, onKeyDown } = handlers;

    if (onMouseMove) {
      document.addEventListener('mousemove', onMouseMove);
    }
    if (onMouseUp) {
      document.addEventListener('mouseup', onMouseUp);
    }
    if (onKeyDown) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      if (onMouseMove) {
        document.removeEventListener('mousemove', onMouseMove);
      }
      if (onMouseUp) {
        document.removeEventListener('mouseup', onMouseUp);
      }
      if (onKeyDown) {
        document.removeEventListener('keydown', onKeyDown);
      }
    };
  }, [isActive, handlers.onMouseMove, handlers.onMouseUp, handlers.onKeyDown]);
};

// ドラッグ操作のための共通フック
interface UseDragOptions {
  onDragStart?: (startPos: { x: number; y: number }) => void;
  onDragMove?: (currentPos: { x: number; y: number }, deltaPos: { x: number; y: number }) => void;
  onDragEnd?: (endPos: { x: number; y: number }, totalDelta: { x: number; y: number }) => void;
  dragThreshold?: number;
}

export const useDrag = (options: UseDragOptions = {}) => {
  const { onDragStart, onDragMove, onDragEnd, dragThreshold = 5 } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setStartPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!startPos) return;

    const currentPos = { x: e.clientX, y: e.clientY };
    const deltaPos = {
      x: currentPos.x - startPos.x,
      y: currentPos.y - startPos.y
    };

    if (!isDragging) {
      const distance = Math.sqrt(deltaPos.x ** 2 + deltaPos.y ** 2);
      if (distance > dragThreshold) {
        setIsDragging(true);
        onDragStart?.(startPos);
      }
    } else {
      onDragMove?.(currentPos, deltaPos);
    }
  }, [startPos, isDragging, dragThreshold, onDragStart, onDragMove]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (startPos) {
      const endPos = { x: e.clientX, y: e.clientY };
      const totalDelta = {
        x: endPos.x - startPos.x,
        y: endPos.y - startPos.y
      };

      if (isDragging) {
        onDragEnd?.(endPos, totalDelta);
      }
    }

    setIsDragging(false);
    setStartPos(null);
  }, [startPos, isDragging, onDragEnd]);

  useMouseEvents(
    startPos !== null,
    { onMouseMove: handleMouseMove, onMouseUp: handleMouseUp }
  );

  return {
    isDragging,
    isActive: startPos !== null,
    handleMouseDown
  };
};

// リサイズ機能のための共通フック
interface UseResizeOptions {
  initialValue: number;
  minValue?: number;
  maxValue?: number;
  storageKey?: string;
  onResize?: (newValue: number) => void;
  onResizeEnd?: (finalValue: number) => void;
}

export const useResize = (options: UseResizeOptions) => {
  const {
    initialValue,
    minValue = 0,
    maxValue = Infinity,
    storageKey,
    onResize,
    onResizeEnd
  } = options;

  const [value, setValue] = useState(initialValue);
  const { value: isResizing, setTrue: startResizing, setFalse: stopResizing } = useBooleanState();

  // ローカルストレージから値を復元
  useEffect(() => {
    if (storageKey) {
      const savedValue = localStorage.getItem(storageKey);
      if (savedValue) {
        const parsed = parseInt(savedValue, 10);
        if (!isNaN(parsed) && parsed >= minValue && parsed <= maxValue) {
          setValue(parsed);
        }
      }
    }
  }, [storageKey, minValue, maxValue]);

  const handleResize = useCallback((startX: number, startValue: number, direction: 'horizontal' | 'vertical' = 'horizontal') => {
    return (e: MouseEvent) => {
      const delta = direction === 'horizontal' ? e.clientX - startX : e.clientY - startX;
      const newValue = Math.max(minValue, Math.min(maxValue, startValue + delta));
      setValue(newValue);
      onResize?.(newValue);
    };
  }, [minValue, maxValue, onResize]);

  const handleResizeEnd = useCallback((finalValue: number) => {
    stopResizing();
    if (storageKey) {
      localStorage.setItem(storageKey, finalValue.toString());
    }
    onResizeEnd?.(finalValue);
  }, [storageKey, onResizeEnd, stopResizing]);

  const createResizeHandler = useCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      startResizing();

      const startX = direction === 'horizontal' ? e.clientX : e.clientY;
      const startValue = value;
      const mouseMoveHandler = handleResize(startX, startValue, direction);

      const mouseUpHandler = () => {
        handleResizeEnd(value);
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      };

      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    };
  }, [value, startResizing, handleResize, handleResizeEnd]);

  return {
    value,
    setValue,
    isResizing,
    createResizeHandler
  };
};

// ローカルストレージと同期する状態管理フック
export const usePersistedState = <T>(
  key: string,
  initialValue: T,
  options: {
    serializer?: {
      serialize: (value: T) => string;
      deserialize: (value: string) => T;
    };
    validator?: (value: unknown) => value is T;
  } = {}
) => {
  const {
    serializer = {
      serialize: JSON.stringify,
      deserialize: JSON.parse
    },
    validator
  } = options;

  const [state, setState] = useState<T>(() => {
    try {
      const raw = parseStoredJson<string | T>(key, undefined as any);
      if (typeof raw === 'string') {
        const parsed = serializer.deserialize(raw);
        if (validator ? validator(parsed) : true) return parsed;
      } else if (raw !== undefined) {
        if (validator ? validator(raw) : true) return raw as T;
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for key "${key}":`, error);
    }
    return initialValue;
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState(current => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(current) : value;
      try {
        const serialized = serializer.serialize(newValue);
        if (typeof serialized === 'string') {
          storeJson(key, serialized);
        } else {
          storeJson(key, newValue as unknown as object);
        }
      } catch (error) {
        console.warn(`Failed to save persisted state for key "${key}":`, error);
      }
      return newValue;
    });
  }, [key, serializer]);

  return [state, setValue] as const;
};

// 遅延実行（デバウンス）フック
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 前の値を保持するフック
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// 条件付きエフェクトフック
export const useConditionalEffect = (
  effect: () => void | (() => void),
  deps: React.DependencyList,
  condition: boolean
) => {
  useEffect(() => {
    if (condition) {
      return effect();
    }
  }, [...deps, condition]);
};

// 安全なエフェクトクリーンアップフック
export const useSafeEffect = (
  effect: () => void | (() => void),
  deps: React.DependencyList
) => {
  useEffect(() => {
    const cleanup = effect();
    return () => {
      if (typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.warn('Effect cleanup failed:', error);
        }
      }
    };
  }, deps);
};
