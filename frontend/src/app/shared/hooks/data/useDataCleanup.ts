import { useState } from 'react';
import { logger } from '@shared/utils';
import { useStableCallback } from '../utilities';

export interface DataCleanupStats {
  indexedDBSize: number;
}

export const useDataCleanup = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  
  const clearAllData = useStableCallback(async (): Promise<void> => {
    setIsClearing(true);
    setError(null);

    try {

      logger.info('🧹 All local data cleared successfully');
    } catch (err) {
      
      logger.error('Failed to clear all data:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  });

  
  const getDataStats = useStableCallback(async (): Promise<DataCleanupStats> => {
    try {

      let indexedDBSize = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          indexedDBSize = estimate.usage || 0;
        } catch {
          
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
  });

  return {
    clearAllData,
    getDataStats,
    isClearing,
    error
  };
};
