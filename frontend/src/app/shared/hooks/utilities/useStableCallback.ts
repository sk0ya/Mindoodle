import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@shared/utils';


export function useStableCallback<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const callbackRef = useRef(callback);


  useEffect(() => {
    callbackRef.current = callback;
  });


  return useCallback((...args: TArgs): TReturn => {
    if (!callbackRef || typeof callbackRef.current !== 'function') {
      logger.error('[useStableCallback] callbackRef or callbackRef.current is invalid', {
        hasRef: !!callbackRef,
        currentType: typeof callbackRef?.current
      });
      return undefined as TReturn;
    }
    return callbackRef.current(...args);
  }, []);
}
