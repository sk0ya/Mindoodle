/**
 * メモリ管理とリークPrevention
 * グローバルタイマーとキャッシュの適切な管理
 */
import { isDevelopment } from './env';

interface ManagedTimer {
  id: NodeJS.Timeout;
  cleanup: () => void;
  description: string;
}

class MemoryManager {
  private timers = new Set<ManagedTimer>();
  private cleanupCallbacks = new Set<() => void>();

  /**
   * 管理対象のタイマーを作成
   */
  createManagedInterval(
    callback: () => void,
    intervalMs: number,
    description: string = 'Unnamed interval'
  ): NodeJS.Timeout {
    const id = setInterval(callback, intervalMs);

    const timer: ManagedTimer = {
      id,
      cleanup: () => clearInterval(id),
      description
    };

    this.timers.add(timer);

    return id;
  }

  /**
   * 管理対象のタイムアウトを作成
   */
  createManagedTimeout(
    callback: () => void,
    timeoutMs: number,
    description: string = 'Unnamed timeout'
  ): NodeJS.Timeout {
    const id = setTimeout(() => {
      callback();
      // タイムアウトは一度実行されたら自動的に管理対象から除外
      this.timers.delete(timer);
    }, timeoutMs);

    const timer: ManagedTimer = {
      id,
      cleanup: () => clearTimeout(id),
      description
    };

    this.timers.add(timer);

    return id;
  }

  /**
   * クリーンアップコールバックを登録
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * 特定のタイマーを停止
   */
  clearManagedTimer(id: NodeJS.Timeout): void {
    const timer = Array.from(this.timers).find(t => t.id === id);
    if (timer) {
      timer.cleanup();
      this.timers.delete(timer);
    }
  }

  /**
   * すべてのタイマーとリソースをクリーンアップ
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.timers.size} timers and ${this.cleanupCallbacks.size} callbacks`);

    // タイマーをクリーンアップ
    this.timers.forEach(timer => {
      try {
        timer.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup timer: ${timer.description}`, error);
      }
    });
    this.timers.clear();

    // その他のクリーンアップコールバックを実行
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Failed to execute cleanup callback', error);
      }
    });
    this.cleanupCallbacks.clear();
  }

  /**
   * 現在の管理状況を報告
   */
  getStatus(): {
    activeTimers: number;
    cleanupCallbacks: number;
    timerDescriptions: string[];
  } {
    return {
      activeTimers: this.timers.size,
      cleanupCallbacks: this.cleanupCallbacks.size,
      timerDescriptions: Array.from(this.timers).map(t => t.description)
    };
  }
}

// グローバルインスタンス
export const memoryManager = new MemoryManager();

// ページ離脱時の自動クリーンアップ（HMR セーフ）
let boundBeforeUnload: ((this: Window, ev: BeforeUnloadEvent) => any) | null = null;
let boundVisibility: ((this: Document, ev: Event) => any) | null = null;

if (typeof window !== 'undefined') {
  const handleBeforeUnload = () => {
    memoryManager.cleanup();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // ページが非表示になった時は部分的なクリーンアップ（必要に応じて拡張）
      // ここではログのみ
      if (isDevelopment()) console.log('🔄 Page hidden, performing partial cleanup');
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  boundBeforeUnload = handleBeforeUnload;
  boundVisibility = handleVisibilityChange;
}

// 開発時のメモリ監視（managed interval + HMR クリーンアップ）
if (isDevelopment()) {
  memoryManager.createManagedInterval(() => {
    const status = memoryManager.getStatus();
    if (status.activeTimers > 10) {
      console.warn(`⚠️ High timer count: ${status.activeTimers} active timers`, status.timerDescriptions);
    }

    // ブラウザのメモリ情報（Chrome DevToolsで使用可能）
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log('📊 Memory:', {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
        timers: status.activeTimers
      });
    }
  }, 30000, 'MemoryManager dev monitor');
}

// HMR で再読み込み時に後始末
if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    if (boundBeforeUnload) {
      window.removeEventListener('beforeunload', boundBeforeUnload);
      boundBeforeUnload = null;
    }
    if (boundVisibility) {
      document.removeEventListener('visibilitychange', boundVisibility);
      boundVisibility = null;
    }
    memoryManager.cleanup();
  });
}
