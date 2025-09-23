import { useEffect } from 'react';
import { setupGlobalErrorHandlers } from './useErrorHandler';

export function useGlobalErrorHandlers(
  handleError: (error: Error, context?: string, action?: string) => void
) {
  useEffect(() => {
    setupGlobalErrorHandlers(handleError);
  }, [handleError]);
}
