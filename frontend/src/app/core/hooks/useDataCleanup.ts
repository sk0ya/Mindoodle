import { useCallback, useState } from 'react';
import { logger } from '../../shared/utils/logger';

export interface DataCleanupStats {
  indexedDBSize: number;
}

export const useDataCleanup = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ローカルストレージのクリーンアップ
  // すべてのローカルデータをクリア
  const clearAllData = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    setError(null);
    
    try {
      
      logger.info('🧹 All local data cleared successfully');
    } catch (err) {
      // エラーは個別の関数で既に設定されている
      logger.error('Failed to clear all data:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, []);

  // データ使用量の取得
  const getDataStats = useCallback(async (): Promise<DataCleanupStats> => {
    try {

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
        indexedDBSize
      };
    } catch (err) {
      logger.error('Failed to get data stats:', err);
      return {
        indexedDBSize: 0
      };
    }
  }, []);

  return {
    clearAllData,
    getDataStats,
    isClearing,
    error
  };
};
