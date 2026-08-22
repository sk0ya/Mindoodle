import { useEffect, useRef } from 'react';
import { logger } from '@shared/utils';
import type { StorageConfig } from '@core/types';

interface StorageConfigChangeDependencies {
  clearData: () => void;
  cancelPendingWrites?: () => void;
}


export const useStorageConfigChange = (
  storageConfig: StorageConfig | undefined,
  dependencies: StorageConfigChangeDependencies
) => {
  const prevStorageConfigRef = useRef<StorageConfig | null>(storageConfig || null);
  const { clearData, cancelPendingWrites } = dependencies;

  useEffect(() => {
    const currentConfig = storageConfig;
    const currentMode = currentConfig?.mode;
    const previousMode = prevStorageConfigRef.current?.mode;

    if (currentMode !== previousMode) {
      logger.info('Storage config changed, clearing the active map before reload', {
        prevMode: previousMode,
        newMode: currentMode
      });
      cancelPendingWrites?.();
      clearData();
    }

    prevStorageConfigRef.current = currentConfig || null;
  }, [cancelPendingWrites, clearData, storageConfig]);
};
