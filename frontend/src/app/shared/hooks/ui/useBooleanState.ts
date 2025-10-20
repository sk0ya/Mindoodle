import { useState, useEffect, useRef } from 'react';
import { parseStoredJson, storeJson } from '@shared/utils';
import { useStableCallback } from '../utilities/useStableCallback';

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

export const useBooleanState = (options: BooleanStateOptions = {}): BooleanStateReturn => {
  const { initialValue = false, onToggle, onTrue, onFalse } = options;
  const [value, setValue] = useState(initialValue);

  const setTrue = useStableCallback(() => {
    setValue(true);
    onToggle?.(true);
    onTrue?.();
  });

  const setFalse = useStableCallback(() => {
    setValue(false);
    onToggle?.(false);
    onFalse?.();
  });

  const toggle = useStableCallback(() => {
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
  });

  const setValueCallback = useStableCallback((newValue: boolean) => {
    setValue(newValue);
    onToggle?.(newValue);
    if (newValue) {
      onTrue?.();
    } else {
      onFalse?.();
    }
  });

  return {
    value,
    setTrue,
    setFalse,
    toggle,
    setValue: setValueCallback,
  };
};

export const useBooleanToggle = (initialValue = false) => {
  const { value, setTrue, setFalse, toggle } = useBooleanState({ initialValue });

  return {
    isActive: value,
    activate: setTrue,
    deactivate: setFalse,
    toggle,
  };
};

export const useLoadingState = (initialValue = false) => {
  const { value, setTrue, setFalse, setValue } = useBooleanState({ initialValue });

  return {
    isLoading: value,
    startLoading: setTrue,
    stopLoading: setFalse,
    setLoading: setValue,
  };
};

export const useResizingState = (initialValue = false) => {
  const { value, setTrue, setFalse } = useBooleanState({ initialValue });

  return {
    isResizing: value,
    startResizing: setTrue,
    stopResizing: setFalse,
  };
};

export const useHoverState = (initialValue = false) => {
  const { value, setTrue, setFalse } = useBooleanState({ initialValue });

  return {
    isHovered: value,
    handleMouseEnter: setTrue,
    handleMouseLeave: setFalse,
  };
};


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
  }, [isActive, handlers, handlers.onMouseMove, handlers.onMouseUp, handlers.onKeyDown]);
};


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

  const handleMouseDown = useStableCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setStartPos({ x: e.clientX, y: e.clientY });
  });

  const handleMouseMove = useStableCallback((e: MouseEvent) => {
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
  });

  const handleMouseUp = useStableCallback((e: MouseEvent) => {
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
  });

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

  const handleResize = useStableCallback((startX: number, startValue: number, direction: 'horizontal' | 'vertical' = 'horizontal') => {
    return (e: MouseEvent) => {
      const delta = direction === 'horizontal' ? e.clientX - startX : e.clientY - startX;
      const newValue = Math.max(minValue, Math.min(maxValue, startValue + delta));
      setValue(newValue);
      onResize?.(newValue);
    };
  });

  const handleResizeEnd = useStableCallback((finalValue: number) => {
    stopResizing();
    if (storageKey) {
      localStorage.setItem(storageKey, finalValue.toString());
    }
    onResizeEnd?.(finalValue);
  });

  const createResizeHandler = useStableCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => {
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
  });

  return {
    value,
    setValue,
    isResizing,
    createResizeHandler
  };
};


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
      const raw = parseStoredJson<string | T | undefined>(key, undefined);
      if (raw === undefined) {
        return initialValue;
      }
      if (typeof raw === 'string') {
        const parsed = serializer.deserialize(raw);
        if (validator ? validator(parsed) : true) return parsed;
      } else {
        if (validator ? validator(raw) : true) return raw;
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for key "${key}":`, error);
    }
    return initialValue;
  });

  const setValue = useStableCallback((value: T | ((prev: T) => T)) => {
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
  });

  return [state, setValue] as const;
};


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


export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
