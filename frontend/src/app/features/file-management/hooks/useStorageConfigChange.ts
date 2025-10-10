import { useEffect, useRef } from 'react';
import { logger } from '@shared/utils';
import type { StorageConfig } from '@core/types';
import type { MindMapData } from '@shared/types';

interface StorageConfigChangeDependencies {
  setData: (_data: MindMapData) => void;
  isInitialized: boolean;
  refreshMapList: () => Promise<void>;
  applyAutoLayout?: () => void;
  currentWorkspaceId?: string | null;
}


export const useStorageConfigChange = (
  storageConfig: StorageConfig | undefined,
  dependencies: StorageConfigChangeDependencies
) => {
  const prevStorageConfigRef = useRef<StorageConfig | null>(storageConfig || null);

  useEffect(() => {
    const currentConfig = storageConfig;
    const prevConfig = prevStorageConfigRef.current;

    const modeChanged = currentConfig?.mode !== prevConfig?.mode;


    if (modeChanged) {
      logger.info('Storage config changed, reloading data', {
        prevMode: prevConfig?.mode,
        newMode: currentConfig?.mode
      });
    }

    prevStorageConfigRef.current = currentConfig || null;
  }, [storageConfig, dependencies]);
};
