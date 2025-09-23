import { useState, useCallback } from 'react';
import { useBooleanState } from './useBooleanState';

/**
 * 単一モーダルの状態管理フック
 */
export const useModal = (initialOpen = false) => {
  const { value: isOpen, setTrue: open, setFalse: close, toggle } = useBooleanState({ 
    initialValue: initialOpen 
  });

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};

/**
 * データ付きモーダルの状態管理フック
 */
export const useModalWithData = <T,>(initialData: T | null = null) => {
  const [data, setData] = useState<T | null>(initialData);
  const isOpen = data !== null;

  const open = useCallback((newData: T) => setData(newData), []);
  const close = useCallback(() => setData(null), []);

  return {
    isOpen,
    data,
    open,
    close,
  };
};