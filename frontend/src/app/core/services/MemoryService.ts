/**
 * Unified Memory Management Service
 * Consolidates timer management, memory monitoring, and cleanup utilities
 */

import { isDevelopment } from '@shared/utils/env';

interface ManagedTimer {
  id: NodeJS.Timeout;
  cleanup: () => void;
  description: string;
}

interface MemorySnapshot {
  timestamp: number;
  jsHeapUsed?: number;
  jsHeapTotal?: number;
  jsHeapLimit?: number;
  timers: number;
  eventListeners: number;
}

interface MemoryReport {
  summary: string;
  current: MemorySnapshot;
  trends: {
    memoryTrend: 'increasing' | 'stable' | 'decreasing';
    timerTrend: 'increasing' | 'stable' | 'decreasing';
  };
  recommendations: string[];
}

/**
 * Unified Memory Service
 * Combines timer management, monitoring, and analysis
 */
class MemoryService {
  // Timer Management
  private timers = new Set<ManagedTimer>();
  private cleanupCallbacks = new Set<() => void>();

  // Memory Monitoring
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  /**
   * Create a managed interval timer
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
   * Create a managed timeout timer
   */
  createManagedTimeout(
    callback: () => void,
    timeoutMs: number,
    description: string = 'Unnamed timeout'
  ): NodeJS.Timeout {
    const id = setTimeout(() => {
      callback();
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
   * Register a cleanup callback
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Clear a specific managed timer
   */
  clearManagedTimer(id: NodeJS.Timeout): void {
    const timer = Array.from(this.timers).find(t => t.id === id);
    if (timer) {
      timer.cleanup();
      this.timers.delete(timer);
    }
  }

  /**
   * Get current timer status
   */
  getTimerStatus(): {
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

  /**
   * Cleanup all timers and resources
   */
  cleanup(): void {
    if (isDevelopment()) {
      console.log(`🧹 Cleaning up ${this.timers.size} timers and ${this.cleanupCallbacks.size} callbacks`);
    }

    // Cleanup timers
    this.timers.forEach(timer => {
      try {
        timer.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup timer: ${timer.description}`, error);
      }
    });
    this.timers.clear();

    // Execute cleanup callbacks
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
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = this.createManagedInterval(() => {
      this.takeSnapshot();
      this.checkThresholds();
    }, intervalMs, 'Memory monitoring');

    if (isDevelopment()) {
      console.log('📊 Memory monitoring started');
    }
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      this.clearManagedTimer(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (isDevelopment()) {
      console.log('📊 Memory monitoring stopped');
    }
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const timestamp = Date.now();
    const timerStatus = this.getTimerStatus();

    // Get event listener count from eventManager if available
    let eventListeners = 0;
    try {
      const eventManager = (window as any).eventManager;
      if (eventManager?.getStatus) {
        eventListeners = eventManager.getStatus().activeListeners;
      }
    } catch {
      // Event manager not available
    }

    const snapshot: MemorySnapshot = {
      timestamp,
      timers: timerStatus.activeTimers,
      eventListeners
    };

    // Chrome browser memory info
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.jsHeapUsed = memory.usedJSHeapSize;
      snapshot.jsHeapTotal = memory.totalJSHeapSize;
      snapshot.jsHeapLimit = memory.jsHeapSizeLimit;
    }

    this.snapshots.push(snapshot);

    // Remove old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Check memory thresholds and warn
   */
  private checkThresholds(): void {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    // Timer count warning
    if (latest.timers > 15) {
      console.warn(`⚠️ High timer count: ${latest.timers} active timers`);
    }

    // Event listener warning
    if (latest.eventListeners > 100) {
      console.warn(`⚠️ High event listener count: ${latest.eventListeners} active listeners`);
    }

    // Memory usage warning
    if (latest.jsHeapUsed && latest.jsHeapLimit) {
      const usageRatio = latest.jsHeapUsed / latest.jsHeapLimit;
      if (usageRatio > 0.8) {
        console.warn(`⚠️ High memory usage: ${Math.round(usageRatio * 100)}% of heap limit`);
      }
    }

    // Memory leak detection
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
   * Generate memory report
   */
  generateReport(): MemoryReport {
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

    // Generate recommendations
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

  /**
   * Calculate trend for a specific metric
   */
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

  /**
   * Format snapshot summary
   */
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
   * Print detailed report to console
   */
  printReport(): void {
    const report = this.generateReport();

    // eslint-disable-next-line no-console
    console.group('📊 Memory Service Report');
    console.log('Summary:', report.summary);
    console.log('Trends:', report.trends);

    if (report.recommendations.length > 0) {
      // eslint-disable-next-line no-console
      console.group('💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  /**
   * Analyze current memory usage
   */
  analyzeMemoryUsage(): {
    current: any;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const memory = ('memory' in performance) ? (performance as any).memory : null;

    const current = memory ? {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    } : null;

    if (current) {
      if (current.usagePercent > 70) {
        recommendations.push('メモリ使用量が高い - 積極的なクリーンアップが必要');
      } else if (current.usagePercent > 50) {
        recommendations.push('メモリ使用量が中程度 - 定期的なクリーンアップを推奨');
      }
    }

    return { current, recommendations };
  }

  /**
   * Force memory cleanup
   */
  forceMemoryCleanup(): void {
    console.log('🧹 強制メモリクリーンアップを実行...');

    // Clear browser caches
    try {
      if (typeof window !== 'undefined' && (window as any).caches) {
        (window as any).caches.keys().then((names: string[]) => {
          names.forEach((name: string) => {
            (window as any).caches.delete(name);
          });
        });
      }
    } catch (error) {
      console.warn('キャッシュクリア中にエラー:', error);
    }

    // Clear temporary DOM elements
    try {
      const elements = document.querySelectorAll('[data-temp]');
      elements.forEach(el => el.remove());
    } catch (error) {
      console.warn('DOM要素クリア中にエラー:', error);
    }

    console.log('✅ 強制メモリクリーンアップ完了');
  }
}

// Global instance
export const memoryService = new MemoryService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  const handleBeforeUnload = () => memoryService.cleanup();
  window.addEventListener('beforeunload', handleBeforeUnload);

  // HMR cleanup
  if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      memoryService.cleanup();
    });
  }
}

// Development mode auto-monitoring
if (isDevelopment()) {
  memoryService.createManagedTimeout(() => {
    memoryService.startMonitoring(15000);
    memoryService.createManagedInterval(() => {
      memoryService.printReport();
    }, 60000, 'MemoryService report');
  }, 5000, 'MemoryService start');
}

// Expose to window for development
if (isDevelopment() && typeof window !== 'undefined') {
  (window as any).memoryService = memoryService;
  console.log('🔧 開発ツール: window.memoryService で手動メモリ管理が可能');
}
