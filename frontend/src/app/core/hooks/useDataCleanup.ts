import { useCallback, useState } from 'react';
import { logger } from '../../shared/utils/logger';
import { localStorageManager } from '../../shared/utils/localStorage';

export interface DataCleanupStats {
  localStorageItems: number;
  indexedDBSize: number;
}

export const useDataCleanup = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ローカルストレージのクリーンアップ
  const clearLocalStorage = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      
      // MindFlow関連のキーのみクリア
      const keysToRemove = localStorageManager.getAllMindFlowKeys();
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      logger.info(`🧹 LocalStorage cleaned: ${keysToRemove.length} items removed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      setError(`ローカルストレージのクリアに失敗しました: ${errorMessage}`);
      logger.error('Failed to clear localStorage:', err);
      throw err;
    }
  }, []);

  // すべてのローカルデータをクリア
  const clearAllData = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    setError(null);
    
    try {
      await clearLocalStorage();
      
      logger.info('🧹 All local data cleared successfully');
    } catch (err) {
      // エラーは個別の関数で既に設定されている
      logger.error('Failed to clear all data:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, [clearLocalStorage]);

  // データ使用量の取得
  const getDataStats = useCallback(async (): Promise<DataCleanupStats> => {
    try {
      // ローカルストレージアイテム数
      const localStorageItems = localStorageManager.getAllMindFlowKeys().length;

      let indexedDBSize = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          indexedDBSize = estimate.usage || 0;
        } catch {
          // エラーの場合は0を返す
          indexedDBSize = 0;
        }
      }

      return {
        localStorageItems,
        indexedDBSize
      };
    } catch (err) {
      logger.error('Failed to get data stats:', err);
      return {
        localStorageItems: 0,
        indexedDBSize: 0
      };
    }
  }, []);

  return {
    clearLocalStorage,
    clearAllData,
    getDataStats,
    isClearing,
    error
  };
};
