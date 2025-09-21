import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import { createInitialData } from '../../shared/types/dataTypes';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { logger } from '../../shared/utils/logger';
import { safeJsonParse } from '../../shared/utils/safeJson';

/**
 * 高レベルアクションに特化したHook
 * マップ管理、履歴操作等の複合的な操作を担当
 */
export const useMindMapActions = () => {
  const store = useMindMapStore();

  const mapActions = {
    // マップ作成
    createMap: useCallback((title: string, workspaceId: string, category?: string): MindMapData => {
      // ファイルパスベースのmapIdを生成（カテゴリ/タイトルの形式）
      const sanitizedTitle = title.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Untitled';
      const categoryPath = category ? category.replace(/[/\\:*?"<>|]/g, '_').trim() : '';
      const mapId = categoryPath ? `${categoryPath}/${sanitizedTitle}` : sanitizedTitle;
      const mapIdentifier = {
        mapId,
        workspaceId
      };
      const newMap = createInitialData(mapIdentifier);
      newMap.title = title;
      newMap.category = category || '';

      // rootNodesの最初のノードのテキストもマップタイトルに合わせる
      if (newMap.rootNodes && newMap.rootNodes.length > 0) {
        newMap.rootNodes[0].text = title;
      }

      logger.debug('Created new map:', newMap);
      return newMap;
    }, []),

    // マップ選択
    selectMap: useCallback((mapData: MindMapData) => {
      logger.debug('[useMindMapActions.selectMap] selecting', mapData.mapIdentifier.mapId, mapData.title);
      // ここではオートレイアウトを実行しない（連打時の負荷・揺れ対策）
      store.setData(mapData);
      logger.debug('Selected map:', mapData.title);
    }, [store]),

    // マップ削除（データから）
    deleteMapData: useCallback(() => {
      const currentData = store.data;
      if (currentData) {
        logger.debug('Deleting map:', currentData.title);
      }
    }, [store]),

    // マップ複製
    duplicateMap: useCallback((sourceMap: MindMapData, newTitle?: string): MindMapData => {
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
    }, []),

    // マップのメタデータ更新
    updateMapMetadata: useCallback((mapIdentifier: MapIdentifier, updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
      const currentData = store.data;
      if (currentData && currentData.mapIdentifier.mapId === mapIdentifier.mapId && currentData.mapIdentifier.workspaceId === mapIdentifier.workspaceId) {
        const updatedData = {
          ...currentData,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        store.setData(updatedData);
        logger.debug('Updated map metadata:', updates);
      }
    }, [store])
  };

  const historyActions = {
    // 履歴操作
    undo: useCallback(async () => {
      if (store.canUndo()) {
        store.undo();
        logger.debug('Undo performed');
      }
    }, [store]),

    redo: useCallback(async () => {
      if (store.canRedo()) {
        store.redo();
        logger.debug('Redo performed');
      }
    }, [store]),

    // 履歴状態
    canUndo: useCallback(() => store.canUndo(), [store]),
    canRedo: useCallback(() => store.canRedo(), [store])
  };

  const fileActions = {
    // ファイル操作（基本的なラッパー）
    exportData: useCallback((): string => {
      const currentData = store.data;
      if (currentData) {
        return JSON.stringify(currentData, null, 2);
      }
      return '';
    }, [store]),

    importData: useCallback((jsonData: string): boolean => {
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
        
        store.setData(parsedData as MindMapData);
        return true;
      } catch (error) {
        logger.error('Failed to import data:', error);
        return false;
      }
    }, [store])
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
