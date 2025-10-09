import { useEffect, useRef } from 'react';

/**
 * オプション設定
 */
export interface UseEventListenerOptions {
  /** イベントターゲット（デフォルト: window） */
  target?: Window | Document | HTMLElement | null;
  /** キャプチャフェーズでイベントをキャプチャするか */
  capture?: boolean;
  /** パッシブリスナーとして登録するか（スクロールパフォーマンス向上） */
  passive?: boolean;
  /** イベントリスナーを有効にするか（デフォルト: true） */
  enabled?: boolean;
}

/**
 * 統合イベントリスナーフック
 *
 * イベントリスナーの登録/解除を自動管理し、コンポーネント間で一貫したパターンを提供
 *
 * @example
 * ```tsx
 * // Window イベント
 * useEventListener('resize', handleResize);
 *
 * // Document イベント
 * useEventListener('mousedown', handleClickOutside, { target: document });
 *
 * // 条件付き有効化
 * useEventListener('keydown', handleKeyDown, { enabled: isOpen });
 *
 * // 要素参照
 * const ref = useRef<HTMLDivElement>(null);
 * useEventListener('scroll', handleScroll, { target: ref.current });
 * ```
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: UseEventListenerOptions
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: UseEventListenerOptions & { target: Document }
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: UseEventListenerOptions & { target: HTMLElement }
): void;

export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options: UseEventListenerOptions = {}
): void {
  const {
    target = typeof window !== 'undefined' ? window : null,
    capture = false,
    passive = false,
    enabled = true
  } = options;

  // ハンドラーの最新版を保持（依存配列を安定させるため）
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // 無効化されている、またはターゲットが存在しない場合は何もしない
    if (!enabled || !target) return;

    // 安定したハンドラー参照を使用
    const eventListener = (event: Event) => {
      handlerRef.current(event as WindowEventMap[K]);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture,
      passive
    };

    // イベントリスナー登録
    target.addEventListener(eventName, eventListener, listenerOptions);

    // クリーンアップ：コンポーネントアンマウント時にリスナー解除
    return () => {
      target.removeEventListener(eventName, eventListener, listenerOptions);
    };
  }, [eventName, target, capture, passive, enabled]);
}
