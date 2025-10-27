/**
 * Boolean state management hooks
 * Delegates to functional programming library for core logic
 */
import { useState, useEffect } from 'react';
import { useBooleanState as useBooleanStateBase } from '@shared/utils/functionalReact';
import { parseStoredJson, storeJson } from '@shared/utils';
import { useStableCallback } from '../utilities/useStableCallback';

// === Types ===

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

// === Core Boolean State ===

export const useBooleanState = (options: BooleanStateOptions = {}): BooleanStateReturn => {
  const { initialValue = false, onToggle, onTrue, onFalse } = options;
  const state = useBooleanStateBase(initialValue);

  // Wrap callbacks if provided
  if (onToggle || onTrue || onFalse) {
    return {
      ...state,
      setTrue: () => { state.setTrue(); onToggle?.(true); onTrue?.(); },
      setFalse: () => { state.setFalse(); onToggle?.(false); onFalse?.(); },
      toggle: () => {
        const newValue = !state.value;
        state.toggle();
        onToggle?.(newValue);
        if (newValue) onTrue?.(); else onFalse?.();
      },
      setValue: (newValue: boolean) => {
        state.setValue(newValue);
        onToggle?.(newValue);
        if (newValue) onTrue?.(); else onFalse?.();
      }
    };
  }
  return state;
};

// === Specialized Boolean States ===

export const useBooleanToggle = (initialValue = false) => {
  const state = useBooleanStateBase(initialValue);
  return { isActive: state.value, activate: state.setTrue, deactivate: state.setFalse, toggle: state.toggle };
};

export const useLoadingState = (initialValue = false) => {
  const state = useBooleanStateBase(initialValue);
  return { isLoading: state.value, startLoading: state.setTrue, stopLoading: state.setFalse, setLoading: state.setValue };
};

export const useResizingState = (initialValue = false) => {
  const state = useBooleanStateBase(initialValue);
  return { isResizing: state.value, startResizing: state.setTrue, stopResizing: state.setFalse };
};

export const useHoverState = (initialValue = false) => {
  const state = useBooleanStateBase(initialValue);
  return { isHovered: state.value, handleMouseEnter: state.setTrue, handleMouseLeave: state.setFalse };
};

// === Mouse Events ===

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
    if (onMouseMove) document.addEventListener('mousemove', onMouseMove);
    if (onMouseUp) document.addEventListener('mouseup', onMouseUp);
    if (onKeyDown) document.addEventListener('keydown', onKeyDown);
    return () => {
      if (onMouseMove) document.removeEventListener('mousemove', onMouseMove);
      if (onMouseUp) document.removeEventListener('mouseup', onMouseUp);
      if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    };
  }, [isActive, handlers.onMouseMove, handlers.onMouseUp, handlers.onKeyDown]);
};

// === Drag ===

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
    const deltaPos = { x: currentPos.x - startPos.x, y: currentPos.y - startPos.y };
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
      const totalDelta = { x: endPos.x - startPos.x, y: endPos.y - startPos.y };
      if (isDragging) onDragEnd?.(endPos, totalDelta);
    }
    setIsDragging(false);
    setStartPos(null);
  });

  useMouseEvents(startPos !== null, { onMouseMove: handleMouseMove, onMouseUp: handleMouseUp });
  return { isDragging, isActive: startPos !== null, handleMouseDown };
};

// === Resize ===

interface UseResizeOptions {
  initialValue: number;
  minValue?: number;
  maxValue?: number;
  storageKey?: string;
  onResize?: (newValue: number) => void;
  onResizeEnd?: (finalValue: number) => void;
}

export const useResize = (options: UseResizeOptions) => {
  const { initialValue, minValue = 0, maxValue = Infinity, storageKey, onResize, onResizeEnd } = options;
  const [value, setValue] = useState(initialValue);
  const { value: isResizing, setTrue: startResizing, setFalse: stopResizing } = useBooleanState();

  useEffect(() => {
    if (storageKey) {
      const savedValue = localStorage.getItem(storageKey);
      if (savedValue) {
        const parsed = parseInt(savedValue, 10);
        if (!isNaN(parsed) && parsed >= minValue && parsed <= maxValue) setValue(parsed);
      }
    }
  }, [storageKey, minValue, maxValue]);

  const handleResize = useStableCallback((startX: number, startValue: number, direction: 'horizontal' | 'vertical' = 'horizontal') => (e: MouseEvent) => {
    const delta = direction === 'horizontal' ? e.clientX - startX : e.clientY - startX;
    const newValue = Math.max(minValue, Math.min(maxValue, startValue + delta));
    setValue(newValue);
    onResize?.(newValue);
  });

  const handleResizeEnd = useStableCallback((finalValue: number) => {
    stopResizing();
    if (storageKey) localStorage.setItem(storageKey, finalValue.toString());
    onResizeEnd?.(finalValue);
  });

  const createResizeHandler = useStableCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => (e: React.MouseEvent) => {
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
  });

  return { value, setValue, isResizing, createResizeHandler };
};

// === Persisted State ===

export const usePersistedState = <T>(
  key: string,
  initialValue: T,
  options: {
    serializer?: { serialize: (value: T) => string; deserialize: (value: string) => T; };
    validator?: (value: unknown) => value is T;
  } = {}
) => {
  const { serializer = { serialize: JSON.stringify, deserialize: JSON.parse }, validator } = options;
  const [state, setState] = useState<T>(() => {
    try {
      const raw = parseStoredJson<string | T | undefined>(key, undefined);
      if (raw === undefined) return initialValue;
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
        if (typeof serialized === 'string') storeJson(key, serialized);
        else storeJson(key, newValue as unknown as object);
      } catch (error) {
        console.warn(`Failed to save persisted state for key "${key}":`, error);
      }
      return newValue;
    });
  });

  return [state, setValue] as const;
};

// === Re-exports ===

export { useDebounced as useDebounce, usePrevious } from '@shared/utils/functionalReact';
