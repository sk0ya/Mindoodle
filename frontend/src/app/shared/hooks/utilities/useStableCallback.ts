import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@shared/utils';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);


  useEffect(() => {
    callbackRef.current = callback;
  });


  return useCallback((
    ((...args: Parameters<T>) => {
      if (!callbackRef || typeof callbackRef.current !== 'function') {
        logger.error('[useStableCallback] callbackRef or callbackRef.current is invalid', {
          hasRef: !!callbackRef,
          currentType: typeof callbackRef?.current
        });
        return undefined;
      }
      return callbackRef.current(...args);
    }) as T
  ), []);
}
