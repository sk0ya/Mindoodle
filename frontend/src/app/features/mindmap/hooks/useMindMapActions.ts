import { useMindMapStore } from '../store';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { logger } from '@shared/utils';
import { safeJsonParse } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';

/**
 * 高レベルアクションに特化したHook
 * マップ管理、履歴操作等の複合的な操作を担当
 */
export const useMindMapActions = () => {
  const store = useMindMapStore();

  const mapActions = {
    // マップ選択
    selectMap: useStableCallback((mapData: MindMapData) => {
      logger.debug('[useMindMapActions.selectMap] selecting', mapData.mapIdentifier.mapId, mapData.title);
      store.setData(mapData);

      // マップ開時に自動整列が有効な場合は適用（一度のみ実行）
      if (mapData.settings?.autoLayout) {
        logger.debug('🎯 Applying auto layout on map open (once only)');
        if (typeof store.applyAutoLayout === 'function') {
          store.applyAutoLayout();
        } else {
          logger.error('❌ applyAutoLayout function not found');
        }
      }

      logger.debug('Selected map:', mapData.title);
    }),

    // マップ削除（データから）
    deleteMapData: useStableCallback(() => {
      const currentData = store.data;
      if (currentData) {
        logger.debug('Deleting map:', currentData.title);
      }
    }),

    // マップ複製
    duplicateMap: useStableCallback((sourceMap: MindMapData, newTitle?: string): MindMapData => {
      const mapId = `map_${Date.now()}`;
      const mapIdentifier = {
        mapId,
        workspaceId: sourceMap.mapIdentifier.workspaceId
      };
      const duplicatedMap = {
        ...sourceMap,
        mapIdentifier,
        title: newTitle || `${sourceMap.title} (複製)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      logger.debug('Duplicated map:', duplicatedMap.title);
      return duplicatedMap;
    }),

    // マップのメタデータ更新
    updateMapMetadata: useStableCallback((mapIdentifier: MapIdentifier, updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
      const currentData = store.data;
      if (currentData && currentData.mapIdentifier.mapId === mapIdentifier.mapId && currentData.mapIdentifier.workspaceId === mapIdentifier.workspaceId) {
        // Do not reset history for metadata changes
        (store as any).updateMapMetadata?.(updates);
        logger.debug('Updated map metadata:', updates);
      }
    })
  };

  const historyActions = {
    // 履歴操作
    undo: useStableCallback(async () => {
      if (store.canUndo()) {
        store.undo();
        logger.debug('Undo performed');
      }
    }),

    redo: useStableCallback(async () => {
      if (store.canRedo()) {
        store.redo();
        logger.debug('Redo performed');
      }
    }),

    // 履歴状態
    canUndo: useStableCallback(() => store.canUndo()),
    canRedo: useStableCallback(() => store.canRedo())
  };

  const fileActions = {
    // ファイル操作（基本的なラッパー）
    exportData: useStableCallback((): string => {
      const currentData = store.data;
      if (currentData) {
        return JSON.stringify(currentData, null, 2);
      }
      return '';
    }),

    importData: useStableCallback((jsonData: string): boolean => {
      try {
        const parseResult = safeJsonParse(jsonData);
        if (!parseResult.success) {
          logger.error('Failed to parse import data:', parseResult.error);
          return false;
        }
        const parsedData = parseResult.data;

        // データの妥当性検証
        if (!parsedData || typeof parsedData !== 'object') {
          return false;
        }

        // MindMapDataの必要な属性をチェック
        if (!('id' in parsedData) || !('title' in parsedData) || !('rootNode' in parsedData)) {
          return false;
        }

        // 型安全性を保つため、明示的にチェック
        const { id, title, rootNode } = parsedData;
        if (typeof id !== 'string' || typeof title !== 'string' || !rootNode) {
          return false;
        }

        // Use setRootNodes to preserve undo/redo history when importing
        const mindMapData = parsedData as MindMapData;
        store.setRootNodes(mindMapData.rootNodes);
        return true;
      } catch (error) {
        logger.error('Failed to import data:', error);
        return false;
      }
    })
  };

  return {
    // 状態
    currentMapId: store.data?.mapIdentifier.mapId || null,
    
    // マップ操作
    ...mapActions,
    
    // 履歴操作
    ...historyActions,
    
    // ファイル操作
    ...fileActions
  };
};
