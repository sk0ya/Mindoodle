import { useCallback, useState } from 'react';

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