/**
 * React Hooksのユーティリティ関数
 * 共通的なuseCallbackパターンを提供
 */

import { useCallback } from 'react';

/**
 * セッター関数のuseCallbackラッパー
 */
export function useCallbackSetter<T>(setter: (value: T) => void) {
  return useCallback((value: T) => setter(value), [setter]);
}

/**
 * 真偽値セッター関数のuseCallbackラッパー
 */
export function useBooleanSetters(
  setTrue: () => void,
  setFalse: () => void,
  toggle: () => void
) {
  return {
    setTrue: useCallback(() => setTrue(), [setTrue]),
    setFalse: useCallback(() => setFalse(), [setFalse]),
    toggle: useCallback(() => toggle(), [toggle])
  };
}

/**
 * モード設定用のuseCallbackラッパー
 */
export function useModeSetters<T extends string>(
  setMode: (mode: T) => void,
  modes: T[]
) {
  const setters = {} as Record<`set${Capitalize<T>}Mode`, () => void>;

  modes.forEach(mode => {
    const key = `set${mode.charAt(0).toUpperCase() + mode.slice(1)}Mode` as `set${Capitalize<T>}Mode`;
    setters[key] = useCallback(() => setMode(mode), [setMode, mode]);
  });

  return setters;
}

/**
 * UI状態リセット用のuseCallbackラッパー
 */
export function useResetCallbacks<T extends Record<string, () => void>>(resetters: T): T {
  const callbacks = {} as T;

  Object.entries(resetters).forEach(([key, resetter]) => {
    callbacks[key as keyof T] = useCallback(() => resetter(), [resetter]) as T[keyof T];
  });

  return callbacks;
}

/**
 * 条件付き実行のuseCallbackラッパー
 */
export function useConditionalCallback(
  callback: () => void,
  condition: boolean | (() => boolean),
  deps: React.DependencyList = []
) {
  return useCallback(() => {
    const shouldExecute = typeof condition === 'function' ? condition() : condition;
    if (shouldExecute) {
      callback();
    }
  }, [callback, condition, ...deps]);
}

/**
 * 非同期処理のuseCallbackラッパー
 */
export function useAsyncCallback<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  deps: React.DependencyList = []
) {
  return useCallback(async (...args: T): Promise<R> => {
    return asyncFn(...args);
  }, deps);
}

/**
 * エラーハンドリング付きのuseCallbackラッパー
 */
export function useSafeCallback<T extends any[]>(
  callback: (...args: T) => void,
  onError?: (error: Error) => void,
  deps: React.DependencyList = []
) {
  return useCallback((...args: T) => {
    try {
      callback(...args);
    } catch (error) {
      console.error('Callback error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [callback, onError, ...deps]);
}

/**
 * デバウンス機能付きuseCallbackラッパー
 */
export function useDebounceCallback<T extends any[]>(
  callback: (...args: T) => void,
  delay: number,
  deps: React.DependencyList = []
) {
  let timeoutId: NodeJS.Timeout | null = null;

  return useCallback((...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, delay);
  }, [callback, delay, ...deps]);
}

/**
 * 一度だけ実行するuseCallbackラッパー
 */
export function useOnceCallback<T extends any[]>(
  callback: (...args: T) => void,
  deps: React.DependencyList = []
) {
  let hasExecuted = false;

  return useCallback((...args: T) => {
    if (!hasExecuted) {
      hasExecuted = true;
      callback(...args);
    }
  }, [callback, ...deps]);
}

/**
 * ハンドラー関数群を一括でuseCallbackに変換
 */
export function useHandlerCallbacks<T extends Record<string, (...args: any[]) => void>>(
  handlers: T,
  deps: React.DependencyList = []
): T {
  const callbacks = {} as T;

  Object.entries(handlers).forEach(([key, handler]) => {
    callbacks[key as keyof T] = useCallback(handler, [...deps, handler]) as T[keyof T];
  });

  return callbacks;
}

/**
 * ゲッター関数のuseCallbackラッパー
 */
export function useGetterCallback<T>(
  getter: () => T,
  deps: React.DependencyList = []
) {
  return useCallback((): T => getter(), [getter, ...deps]);
}