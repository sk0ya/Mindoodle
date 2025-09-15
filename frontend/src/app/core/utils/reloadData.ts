import { createInitialData } from '../../shared/types/dataTypes';
import { logger } from '../../shared/utils/logger';
import type { MindMapData } from '@shared/types';
import { DEFAULT_WORKSPACE_ID } from '@shared/types';

export interface DataReloadDependencies {
  setData: (data: MindMapData) => void;
  isInitialized: boolean;
  loadInitialData: () => Promise<MindMapData>;
  refreshMapList?: () => Promise<void>;
  applyAutoLayout?: () => void;
  currentWorkspaceId?: string;
}

export async function executeDataReload(
  dependencies: DataReloadDependencies,
  context: string = 'useMindMap'
): Promise<void> {
  try {
    logger.info(`🔄 ${context}: Clearing data before reload...`);
    
    // 現在のデータを明示的にクリア（一時的な空のマップで置き換え）
    const tempClearData = createInitialData({ mapId: `temp_${Date.now()}`, workspaceId: dependencies.currentWorkspaceId || DEFAULT_WORKSPACE_ID });
    tempClearData.title = '読み込み中...';
    dependencies.setData(tempClearData);
    
    // 初期化済みでない場合はエラーとして扱う
    if (!dependencies.isInitialized) {
      throw new Error(`${context}: Storage not initialized`);
    }
    
    logger.debug(`📥 ${context}: Loading initial data from storage...`);
    const initialData = await dependencies.loadInitialData();
    logger.debug(`📋 ${context}: Data loaded:`, {
      id: initialData.mapIdentifier.mapId,
      title: initialData.title,
    });
    
    dependencies.setData(initialData);
    // Apply auto layout after reload
    try {
      dependencies.applyAutoLayout?.();
    } catch (e) {
      logger.warn('Auto layout after reload failed:', e);
    }
    
    // マップ一覧も再読み込み（オプショナル）
    if (dependencies.refreshMapList) {
      await dependencies.refreshMapList();
    }
    
    logger.debug(`✅ ${context}: Data reloaded successfully:`, initialData.title);
  } catch (error) {
    logger.error(`❌ ${context}: Failed to reload data:`, error);
    throw error;
  }
}

// 初期化待機は useInitializationWaiter フックを使用するように変更
