import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { logger } from '../../utils/logger';
import { useNotification } from '../ui/useNotification';

export interface ErrorInfo {
  error: Error;
  errorInfo?: React.ErrorInfo;
  context?: string;
  action?: string;
  userId?: string;
}

export interface ErrorHandlerContextType {
  handleError: (error: Error, context?: string, action?: string) => void;
  handleAsyncError: (promise: Promise<unknown>, context?: string, action?: string) => Promise<unknown>;
}

const ErrorHandlerContext = createContext<ErrorHandlerContextType | undefined>(undefined);

interface ErrorHandlerProviderProps {
  children: ReactNode;
  userId?: string;
}


const getErrorType = (error: Error): 'network' | 'validation' | 'storage' | 'unknown' => {
  const message = error.message.toLowerCase();
  
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
    return 'network';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  if (message.includes('storage') || message.includes('indexeddb') || message.includes('localstorage')) {
    return 'storage';
  }
  
  return 'unknown';
};


const generateUserFriendlyMessage = (error: Error, context?: string, action?: string): string => {
  const errorType = getErrorType(error);
  
  switch (errorType) {
    case 'network':
      return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
    case 'validation':
      return '入力内容に問題があります。入力値を確認してください。';
    case 'storage':
      return 'データの保存に失敗しました。ブラウザの容量を確認してください。';
    default:
      if (context && action) {
        return `${action}に失敗しました。しばらく待ってから再試行してください。`;
      }
      return '予期しないエラーが発生しました。しばらく待ってから再試行してください。';
  }
};


const generateErrorReport = (errorInfo: ErrorInfo): object => {
  return {
    timestamp: new Date().toISOString(),
    message: errorInfo.error.message,
    stack: errorInfo.error.stack,
    context: errorInfo.context,
    action: errorInfo.action,
    userId: errorInfo.userId,
    userAgent: navigator.userAgent,
    url: window.location.href,
    type: getErrorType(errorInfo.error),
  };
};

export const ErrorHandlerProvider: React.FC<ErrorHandlerProviderProps> = ({ children, userId }) => {
  const { showNotification } = useNotification();

  const handleError = useCallback((error: Error, context?: string, action?: string) => {
    const errorInfo: ErrorInfo = {
      error,
      context,
      action,
      userId,
    };

    
    const errorReport = generateErrorReport(errorInfo);
    logger.error('Application error occurred:', errorReport);

    
    const userMessage = generateUserFriendlyMessage(error, context, action);
    showNotification('error', userMessage);

    
    if (import.meta.env.DEV) {
      logger.debug('Error Details - Original error:', error);
      logger.debug('Error Details - Context:', context);
      logger.debug('Error Details - Action:', action);
      logger.debug('Error Details - Full report:', errorReport);
    }
  }, [showNotification, userId]);

  const handleAsyncError = useCallback(async (promise: Promise<unknown>, context?: string, action?: string): Promise<unknown> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error as Error, context, action);
      throw error; 
    }
  }, [handleError]);

  return (
    <ErrorHandlerContext.Provider value={{ handleError, handleAsyncError }}>
      {children}
    </ErrorHandlerContext.Provider>
  );
};

export const useErrorHandler = (): ErrorHandlerContextType => {
  const context = useContext(ErrorHandlerContext);
  if (!context) {
    throw new Error('useErrorHandler must be used within an ErrorHandlerProvider');
  }
  return context;
};


export const setupGlobalErrorHandlers = (handleError: (error: Error, context?: string, action?: string) => void) => {
  
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
    handleError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      'Global',
      'Promise rejection'
    );
    event.preventDefault(); 
  });

  
  window.addEventListener('error', (event) => {
    const errorMessage = event.error?.message || event.message || '';
    const errorStack = event.error?.stack || '';

    // CodeMirror Editor関連のエラーを除外
    if (
      errorStack.includes('codemirror') ||
      errorStack.includes('cm-') ||
      errorMessage.includes('CodeMirror') ||
      errorMessage.includes('editor') ||
      errorMessage.includes('keydown') ||
      errorMessage.includes('keyup') ||
      errorMessage.includes('keypress') ||
      errorMessage.includes('ResizeObserver') ||
      errorMessage.includes('Non-Error promise rejection')
    ) {
      return;
    }
    
    logger.error('Global JavaScript error:', event.error);
    handleError(
      event.error || new Error(event.message),
      'Global',
      'JavaScript error'
    );
  });

  logger.debug('Global error handlers set up successfully');
};
