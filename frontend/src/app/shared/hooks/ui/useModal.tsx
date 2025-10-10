import { useState } from 'react';
import { useBooleanState } from './useBooleanState';
import { useStableCallback } from '../utilities';

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

export const useModalWithData = <T,>(initialData: T | null = null) => {
  const [data, setData] = useState<T | null>(initialData);
  const isOpen = data !== null;

  const open = useStableCallback((newData: T) => setData(newData));
  const close = useStableCallback(() => setData(null));

  return {
    isOpen,
    data,
    open,
    close,
  };
};