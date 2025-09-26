/**
 * 開発環境でのメモリ使用量監視とレポート
 * パフォーマンス問題の早期発見
 */

import { memoryManager } from './memoryManager';
import { eventManager } from './eventManager';
import { isDevelopment } from './env';

interface MemorySnapshot {
  timestamp: number;
  jsHeapUsed?: number;
  jsHeapTotal?: number;
  jsHeapLimit?: number;
  timers: number;
  eventListeners: number;
  cacheStatus?: Record<string, any>;
}

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  /**
   * 監視を開始
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    this.monitoringInterval = memoryManager.createManagedInterval(() => {
      this.takeSnapshot();
      this.checkThresholds();
    }, intervalMs, 'Memory monitoring');

    console.log('📊 Memory monitoring started');
  }

  /**
   * 監視を停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      memoryManager.clearManagedTimer(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('📊 Memory monitoring stopped');
  }

  /**
   * メモリスナップショットを取得
   */
  takeSnapshot(): MemorySnapshot {
    const timestamp = Date.now();
    const memoryManagerStatus = memoryManager.getStatus();
    const eventManagerStatus = eventManager.getStatus();

    const snapshot: MemorySnapshot = {
      timestamp,
      timers: memoryManagerStatus.activeTimers,
      eventListeners: eventManagerStatus.activeListeners
    };

    // Chromeブラウザのメモリ情報
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.jsHeapUsed = memory.usedJSHeapSize;
      snapshot.jsHeapTotal = memory.totalJSHeapSize;
      snapshot.jsHeapLimit = memory.jsHeapSizeLimit;
    }

    this.snapshots.push(snapshot);

    // 古いスナップショットを削除
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * 閾値チェックと警告
   */
  private checkThresholds(): void {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    // タイマー数の警告
    if (latest.timers > 15) {
      console.warn(`⚠️ High timer count: ${latest.timers} active timers`);
    }

    // イベントリスナー数の警告
    if (latest.eventListeners > 100) {
      console.warn(`⚠️ High event listener count: ${latest.eventListeners} active listeners`);
    }

    // メモリ使用量の警告
    if (latest.jsHeapUsed && latest.jsHeapLimit) {
      const usageRatio = latest.jsHeapUsed / latest.jsHeapLimit;
      if (usageRatio > 0.8) {
        console.warn(`⚠️ High memory usage: ${Math.round(usageRatio * 100)}% of heap limit`);
      }
    }

    // メモリリークの検出（増加傾向）
    if (this.snapshots.length >= 5) {
      const recent = this.snapshots.slice(-5);
      const isIncreasing = recent.every((snap, i) =>
        i === 0 || (snap.jsHeapUsed && recent[i-1].jsHeapUsed && snap.jsHeapUsed > recent[i-1].jsHeapUsed!)
      );

      if (isIncreasing && latest.jsHeapUsed) {
        const first = recent[0];
        const increase = latest.jsHeapUsed - (first.jsHeapUsed || 0);
        const increasePercent = (increase / (first.jsHeapUsed || 1)) * 100;

        if (increasePercent > 20) {
          console.warn(`🚨 Potential memory leak detected: ${increasePercent.toFixed(1)}% increase in 5 samples`);
        }
      }
    }
  }

  /**
   * レポートを生成
   */
  generateReport(): {
    summary: string;
    current: MemorySnapshot;
    trends: {
      memoryTrend: 'increasing' | 'stable' | 'decreasing';
      timerTrend: 'increasing' | 'stable' | 'decreasing';
    };
    recommendations: string[];
  } {
    const current = this.snapshots[this.snapshots.length - 1];
    const recommendations: string[] = [];

    if (!current) {
      return {
        summary: 'No memory data available',
        current: { timestamp: Date.now(), timers: 0, eventListeners: 0 },
        trends: { memoryTrend: 'stable', timerTrend: 'stable' },
        recommendations: ['Start memory monitoring to get insights']
      };
    }

    // 推奨事項の生成
    if (current.timers > 10) {
      recommendations.push('Consider reducing the number of active timers');
    }

    if (current.eventListeners > 50) {
      recommendations.push('Review event listener usage - consider using event delegation');
    }

    if (current.jsHeapUsed && current.jsHeapLimit) {
      const usageRatio = current.jsHeapUsed / current.jsHeapLimit;
      if (usageRatio > 0.6) {
        recommendations.push('Memory usage is high - consider clearing caches or reducing data retention');
      }
    }

    const memoryTrend = this.calculateTrend('jsHeapUsed');
    const timerTrend = this.calculateTrend('timers');

    const summary = this.formatSummary(current);

    return {
      summary,
      current,
      trends: { memoryTrend, timerTrend },
      recommendations
    };
  }

  private calculateTrend(field: keyof MemorySnapshot): 'increasing' | 'stable' | 'decreasing' {
    if (this.snapshots.length < 3) return 'stable';

    const recent = this.snapshots.slice(-3);
    const values = recent.map(s => s[field] as number).filter(v => typeof v === 'number');

    if (values.length < 3) return 'stable';

    const isIncreasing = values[2] > values[1] && values[1] > values[0];
    const isDecreasing = values[2] < values[1] && values[1] < values[0];

    if (isIncreasing) return 'increasing';
    if (isDecreasing) return 'decreasing';
    return 'stable';
  }

  private formatSummary(snapshot: MemorySnapshot): string {
    const parts: string[] = [];

    if (snapshot.jsHeapUsed) {
      parts.push(`Memory: ${Math.round(snapshot.jsHeapUsed / 1024 / 1024)}MB`);
    }

    parts.push(`Timers: ${snapshot.timers}`);
    parts.push(`Listeners: ${snapshot.eventListeners}`);

    return parts.join(' | ');
  }

  /**
   * コンソールに詳細レポートを出力
   */
  printReport(): void {
    const report = this.generateReport();

    console.group('📊 Memory Monitor Report');
    console.log('Summary:', report.summary);
    console.log('Trends:', report.trends);

    if (report.recommendations.length > 0) {
      console.group('💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }

    console.groupEnd();
  }
}

// グローバルインスタンス
export const memoryMonitor = new MemoryMonitor();

// 開発環境での自動監視
if (isDevelopment()) {
  // 5秒後に監視開始（初期化完了後）
  const startId = memoryManager.createManagedTimeout(() => {
    memoryMonitor.startMonitoring(15000); // 15秒ごと

    // 1分ごとにレポート出力
    memoryManager.createManagedInterval(() => {
      memoryMonitor.printReport();
    }, 60000, 'MemoryMonitor report');
  }, 5000, 'MemoryMonitor start');

  // HMR dispose で停止
  if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
      try { memoryMonitor.stopMonitoring(); } catch { /* noop */ }
      try { memoryManager.clearManagedTimer(startId); } catch { /* noop */ }
    });
  }
}
