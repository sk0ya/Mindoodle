/**
 * メモリ分析とクリーンアップのユーティリティ
 */

/**
 * メモリ使用量の詳細分析を実行
 */
export function analyzeMemoryUsage(): {
  current: any;
  recommendations: string[];
  actions: (() => void)[];
} {
  const recommendations: string[] = [];
  const actions: (() => void)[] = [];

  // ブラウザメモリ情報
  const memory = ('memory' in performance) ? (performance as any).memory : null;
  const current = memory ? {
    used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
    total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
    usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
  } : null;

  if (current) {
    // メモリ使用量の分析
    if (current.usagePercent > 70) {
      recommendations.push('メモリ使用量が高い - 積極的なクリーンアップが必要');
      actions.push(() => forceMemoryCleanup());
    } else if (current.usagePercent > 50) {
      recommendations.push('メモリ使用量が中程度 - 定期的なクリーンアップを推奨');
    } else if (current.usagePercent < 20) {
      recommendations.push('メモリ使用量は良好');
    }

    // ヒープサイズの分析
    const heapGrowth = current.total - current.used;
    if (heapGrowth > 50) {
      recommendations.push(`ヒープに未使用領域が多い (${heapGrowth}MB) - ガベージコレクションを促進`);
      actions.push(() => suggestGarbageCollection());
    }
  }

  return { current, recommendations, actions };
}

/**
 * 強制的なメモリクリーンアップを実行
 */
export function forceMemoryCleanup(): void {
  console.log('🧹 強制メモリクリーンアップを実行...');

  // キャッシュのクリアを試行
  try {
    // グローバルキャッシュがあれば手動でクリア
    if (typeof window !== 'undefined') {
      const win = window as any;

      // 可能性のあるキャッシュをクリア
      if (win.caches) {
        win.caches.keys().then((names: string[]) => {
          names.forEach((name: string) => {
            win.caches.delete(name);
          });
        });
      }
    }
  } catch (error) {
    console.warn('キャッシュクリア中にエラー:', error);
  }

  // DOM要素の参照をクリア
  try {
    // 不要なDOM参照をクリア
    const elements = document.querySelectorAll('[data-temp]');
    elements.forEach(el => el.remove());
  } catch (error) {
    console.warn('DOM要素クリア中にエラー:', error);
  }

  console.log('✅ 強制メモリクリーンアップ完了');
}

/**
 * ガベージコレクションを促進
 */
export function suggestGarbageCollection(): void {
  console.log('🗑️ ガベージコレクションを促進...');

  // 開発環境でのGC
  if (process.env.NODE_ENV === 'development') {
    const win = window as any;
    if (typeof win.gc === 'function') {
      win.gc();
      console.log('✅ 手動GCを実行');
      return;
    }
  }

  // GCを間接的に促進
  try {
    // 大きな配列を作成して即座に削除（GCのトリガー）
    const temp = new Array(1000000).fill(0);
    temp.length = 0;

    // Promise解決でマイクロタスクキューを消費
    Promise.resolve().then(() => {
      console.log('✅ GC促進完了');
    });
  } catch (error) {
    console.warn('GC促進中にエラー:', error);
  }
}

/**
 * メモリ効率化のためのベストプラクティスをチェック
 */
export function checkMemoryBestPractices(): {
  issues: string[];
  fixes: string[];
} {
  const issues: string[] = [];
  const fixes: string[] = [];

  // DOM要素数チェック
  const elementCount = document.querySelectorAll('*').length;
  if (elementCount > 5000) {
    issues.push(`DOM要素数が多い (${elementCount}個)`);
    fixes.push('仮想化やページネーションを検討');
  }

  // イベントリスナー数チェック
  const win = window as any;
  if (win.eventManager) {
    const status = win.eventManager.getStatus();
    if (status.activeListeners > 100) {
      issues.push(`イベントリスナーが多い (${status.activeListeners}個)`);
      fixes.push('イベント委譲パターンの使用を検討');
    }
  }

  // タイマー数チェック
  if (win.memoryManager) {
    const status = win.memoryManager.getStatus();
    if (status.activeTimers > 20) {
      issues.push(`アクティブタイマーが多い (${status.activeTimers}個)`);
      fixes.push('不要なタイマーの停止と統合を検討');
    }
  }

  return { issues, fixes };
}

/**
 * 包括的なメモリレポートを生成
 */
export function generateMemoryReport(): void {
  console.group('📊 包括的メモリレポート');

  const analysis = analyzeMemoryUsage();
  const practices = checkMemoryBestPractices();

  console.log('💾 現在のメモリ状況:', analysis.current);

  if (analysis.recommendations.length > 0) {
    console.group('💡 推奨事項:');
    analysis.recommendations.forEach(rec => console.log(`• ${rec}`));
    console.groupEnd();
  }

  if (practices.issues.length > 0) {
    console.group('⚠️ 発見された問題:');
    practices.issues.forEach((issue, i) => {
      console.log(`• ${issue}`);
      if (practices.fixes[i]) {
        console.log(`  → 修正案: ${practices.fixes[i]}`);
      }
    });
    console.groupEnd();
  }

  if (analysis.actions.length > 0) {
    console.log('🔧 自動修正アクションを実行中...');
    analysis.actions.forEach(action => action());
  }

  console.groupEnd();
}

// 開発環境でのグローバル露出
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const win = window as any;
  win.memoryUtils = {
    analyze: analyzeMemoryUsage,
    cleanup: forceMemoryCleanup,
    gc: suggestGarbageCollection,
    check: checkMemoryBestPractices,
    report: generateMemoryReport
  };

  console.log('🔧 開発ツール: window.memoryUtils で手動メモリ分析が可能');
}