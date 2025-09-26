/**
 * グローバルイベントリスナー管理
 * 複数のコンポーネントが同じイベントを監視する場合の効率化
 */
import { memoryManager } from './memoryManager';
import { isDevelopment } from './env';

type EventHandler = (event: Event) => void;

interface ManagedEventListener {
  element: EventTarget;
  event: string;
  handler: EventHandler;
  id: string;
  description?: string;
}

class EventManager {
  private listeners = new Map<string, ManagedEventListener>();
  private globalHandlers = new Map<string, Set<EventHandler>>();

  /**
   * イベントリスナーを登録（自動的にIDを生成）
   */
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventHandler,
    description?: string
  ): string {
    const id = this.generateId();

    const listener: ManagedEventListener = {
      element,
      event,
      handler,
      id,
      description
    };

    this.listeners.set(id, listener);
    element.addEventListener(event, handler);

    return id;
  }

  /**
   * グローバルイベントハンドラー（複数のハンドラーを統合）
   */
  addGlobalHandler(
    event: string,
    handler: EventHandler
  ): string {
    const id = this.generateId();

    if (!this.globalHandlers.has(event)) {
      this.globalHandlers.set(event, new Set());

      // 統合ハンドラーを作成
      const unifiedHandler = (e: Event) => {
        const handlers = this.globalHandlers.get(event);
        if (handlers) {
          handlers.forEach(h => {
            try {
              h(e);
            } catch (error) {
              console.warn(`Error in global ${event} handler:`, error);
            }
          });
        }
      };

      // グローバル要素にリスナーを追加
      const target = event.startsWith('key') ? document : window;
      this.addEventListener(target, event, unifiedHandler, `Global ${event} handler`);
    }

    this.globalHandlers.get(event)!.add(handler);
    return id;
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(id: string): boolean {
    const listener = this.listeners.get(id);
    if (!listener) return false;

    listener.element.removeEventListener(listener.event, listener.handler);
    this.listeners.delete(id);
    return true;
  }

  /**
   * 特定の要素のすべてのリスナーを削除
   */
  removeAllListenersForElement(element: EventTarget): number {
    let removed = 0;

    for (const [id, listener] of this.listeners.entries()) {
      if (listener.element === element) {
        this.removeEventListener(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * すべてのリスナーをクリーンアップ
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.listeners.size} event listeners`);

    for (const [id, listener] of this.listeners.entries()) {
      try {
        listener.element.removeEventListener(listener.event, listener.handler);
      } catch (error) {
        console.warn(`Failed to remove listener ${id}:`, error);
      }
    }

    this.listeners.clear();
    this.globalHandlers.clear();
  }

  /**
   * React Hook: useEffect互換のイベントリスナー管理
   */
  useEventListener(
    element: EventTarget | null,
    event: string,
    handler: EventHandler,
    description?: string
  ): () => void {
    if (!element) {
      return () => {}; // noop
    }

    const id = this.addEventListener(element, event, handler, description);
    return () => this.removeEventListener(id);
  }

  /**
   * 現在の状況を報告
   */
  getStatus(): {
    activeListeners: number;
    globalHandlers: number;
    listenersByEvent: Record<string, number>;
  } {
    const listenersByEvent: Record<string, number> = {};

    for (const listener of this.listeners.values()) {
      listenersByEvent[listener.event] = (listenersByEvent[listener.event] || 0) + 1;
    }

    return {
      activeListeners: this.listeners.size,
      globalHandlers: this.globalHandlers.size,
      listenersByEvent
    };
  }

  private generateId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// グローバルインスタンス
export const eventManager = new EventManager();

// 自動クリーンアップ
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
  });
}

/**
 * React Hook: 管理されたイベントリスナー
 */
export function useManagedEventListener(
  element: EventTarget | null,
  event: string,
  handler: EventHandler,
  description?: string,
  deps: any[] = []
): void {
  // React.useEffectをimportせずに使うため、グローバル関数として想定
  if (typeof window !== 'undefined' && 'React' in window) {
    const React = (window as any).React;
    React.useEffect(() => {
      return eventManager.useEventListener(element, event, handler, description);
    }, [element, event, handler, description, ...deps]);
  }
}

// 開発時の監視
if (isDevelopment()) {
  memoryManager.createManagedInterval(() => {
    const status = eventManager.getStatus();
    if (status.activeListeners > 50) {
      console.warn(`⚠️ High listener count: ${status.activeListeners} active listeners`, status.listenersByEvent);
    }
  }, 30000, 'EventManager dev monitor');
}

// HMR cleanup for listeners
if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    try { eventManager.cleanup(); } catch { /* noop */ }
  });
}
