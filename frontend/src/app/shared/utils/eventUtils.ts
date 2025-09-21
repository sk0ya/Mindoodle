/**
 * イベントハンドリング用のユーティリティ関数
 * 共通的なイベント処理パターンを提供
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * イベントの伝播を停止し、デフォルト動作を防ぐ
 */
export function stopEventPropagation(e: Event | React.SyntheticEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * イベントの伝播のみを停止（デフォルト動作は継続）
 */
export function stopPropagationOnly(e: Event | React.SyntheticEvent): void {
  e.stopPropagation();
}

/**
 * デフォルト動作のみを防ぐ（伝播は継続）
 */
export function preventDefaultOnly(e: Event | React.SyntheticEvent): void {
  e.preventDefault();
}

/**
 * クリックアウトサイドハンドラーのカスタムフック
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  enabled: boolean = true
) {
  const ref = useRef<T>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      callback();
    }
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, enabled]);

  return ref;
}

/**
 * 条件付きクリックハンドラー
 * 指定した条件が満たされた場合のみコールバックを実行
 */
export function createConditionalClickHandler(
  condition: boolean | (() => boolean),
  callback: () => void
) {
  return () => {
    const shouldExecute = typeof condition === 'function' ? condition() : condition;
    if (shouldExecute) {
      callback();
    }
  };
}

/**
 * イベントハンドラーの組み合わせ
 * 複数のハンドラーを順次実行
 */
export function combineEventHandlers<T extends Event | React.SyntheticEvent>(
  ...handlers: Array<(e: T) => void | undefined>
) {
  return (e: T) => {
    handlers.forEach(handler => {
      if (handler) {
        handler(e);
      }
    });
  };
}

/**
 * 安全なクリックハンドラー（エラーハンドリング付き）
 */
export function createSafeClickHandler(
  callback: () => void,
  onError?: (error: Error) => void
) {
  return () => {
    try {
      callback();
    } catch (error) {
      console.error('Click handler error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };
}

/**
 * ダブルクリック防止機能付きクリックハンドラー
 */
export function createDebounceClickHandler(
  callback: () => void,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let isExecuting = false;

  return () => {
    if (isExecuting) return;

    isExecuting = true;
    callback();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      isExecuting = false;
      timeoutId = null;
    }, delay);
  };
}