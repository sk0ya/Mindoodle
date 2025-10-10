import { useCallback, useEffect, useRef } from 'react';


export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  
  useEffect(() => {
    callbackRef.current = callback;
  });

  
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}
