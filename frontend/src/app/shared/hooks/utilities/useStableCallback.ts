import { useCallback, useEffect, useRef } from 'react';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);


  useEffect(() => {
    callbackRef.current = callback;
  });


  return useCallback((
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T
  ), []);
}
