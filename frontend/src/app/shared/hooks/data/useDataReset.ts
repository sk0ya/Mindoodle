import { useEffect, useRef } from 'react';
import { logger } from '@shared/utils';
import type { MindMapData } from '@shared/types';

interface DataResetDependencies {
  setData: (_data: MindMapData) => void;
  isInitialized: boolean;
  refreshMapList: () => Promise<void>;
  applyAutoLayout?: () => void;
  currentWorkspaceId?: string | null;
}


export const useDataReset = (
  resetKey: number,
  dependencies: DataResetDependencies
) => {
  const prevResetKeyRef = useRef(0);
  const pendingResetKeyRef = useRef<number | null>(null);

  useEffect(() => {
    const currentResetKey = resetKey;
    const prevResetKey = prevResetKeyRef.current;


    if (currentResetKey !== prevResetKey) {
      logger.info('Reset key changed, forcing data reload:', currentResetKey);


      if (dependencies.isInitialized) {
        logger.info('Persistence initialized, executing reload immediately');
        pendingResetKeyRef.current = null;
      } else {
        logger.info('Waiting for persistence initialization before reload...');
        pendingResetKeyRef.current = currentResetKey;
      }
    }

    
    if (
      dependencies.isInitialized &&
      pendingResetKeyRef.current !== null &&
      currentResetKey === pendingResetKeyRef.current
    ) {
      logger.info('Executing delayed reload for resetKey:', pendingResetKeyRef.current);
      
      pendingResetKeyRef.current = null;
    }

    prevResetKeyRef.current = currentResetKey;
  }, [resetKey, dependencies]);
};
