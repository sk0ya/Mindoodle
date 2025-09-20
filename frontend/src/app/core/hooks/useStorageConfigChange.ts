import { useEffect, useRef } from 'react';
import { logger } from '../../shared/utils/logger';
import type { StorageConfig } from '../storage/types';
import type { MindMapData } from '@shared/types';

interface StorageConfigChangeDependencies {
  setData: (_data: MindMapData) => void;
  isInitialized: boolean;
  refreshMapList: () => Promise<void>;
  applyAutoLayout?: () => void;
  currentWorkspaceId?: string | null;
}

/**
 * ストレージ設定変更時のデータ再読み込みを管理するhook
 */
export const useStorageConfigChange = (
  storageConfig: StorageConfig | undefined,
  dependencies: StorageConfigChangeDependencies
) => {
  const prevStorageConfigRef = useRef<StorageConfig | null>(storageConfig || null);

  useEffect(() => {
    const currentConfig = storageConfig;
    const prevConfig = prevStorageConfigRef.current;

    const modeChanged = currentConfig?.mode !== prevConfig?.mode;
    const authChanged = false; // 認証は削除されました


    if (modeChanged || authChanged) {
      logger.info('Storage config changed, reloading data', {
        prevMode: prevConfig?.mode,
        newMode: currentConfig?.mode
      });
    }

    prevStorageConfigRef.current = currentConfig || null;
  }, [storageConfig, dependencies]);
};
