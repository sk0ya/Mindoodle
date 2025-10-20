import { useMapData, useHistoryState, useMapOperations } from './useStoreSelectors';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { logger, safeJsonParse } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';


export const useMindMapActions = () => {
  const data = useMapData();
  const { canUndo, canRedo, undo, redo } = useHistoryState();
  const { setData, setRootNodes, updateMapMetadata, applyAutoLayout } = useMapOperations();

  const mapActions = {

    selectMap: useStableCallback((mapData: MindMapData) => {
      logger.debug('[useMindMapActions.selectMap] selecting', mapData.mapIdentifier.mapId, mapData.title);
      setData(mapData);


      if (mapData.settings?.autoLayout) {
        logger.debug('🎯 Applying auto layout on map open (once only)');
        if (typeof applyAutoLayout === 'function') {
          applyAutoLayout();
        } else {
          logger.error('❌ applyAutoLayout function not found');
        }
      }

      logger.debug('Selected map:', mapData.title);
    }),


    deleteMapData: useStableCallback(() => {
      if (data) {
        logger.debug('Deleting map:', data.title);
      }
    }),


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


    updateMapMetadata: useStableCallback((mapIdentifier: MapIdentifier, updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
      if (data && data.mapIdentifier.mapId === mapIdentifier.mapId && data.mapIdentifier.workspaceId === mapIdentifier.workspaceId) {

        updateMapMetadata?.(updates);
        logger.debug('Updated map metadata:', updates);
      }
    })
  };

  const historyActions = {

    undo: useStableCallback(async () => {
      if (canUndo) {
        undo();
        logger.debug('Undo performed');
      }
    }),

    redo: useStableCallback(async () => {
      if (canRedo) {
        redo();
        logger.debug('Redo performed');
      }
    }),


    canUndo: useStableCallback(() => canUndo),
    canRedo: useStableCallback(() => canRedo)
  };

  const fileActions = {

    exportData: useStableCallback((): string => {
      if (data) {
        return JSON.stringify(data, null, 2);
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


        if (!('id' in parsedData) || !('title' in parsedData) || !('rootNode' in parsedData)) {
          return false;
        }


        const { id, title, rootNode } = parsedData;
        if (typeof id !== 'string' || typeof title !== 'string' || !rootNode) {
          return false;
        }


        const mindMapData = parsedData as unknown as MindMapData;
        setRootNodes(mindMapData.rootNodes);
        return true;
      } catch (error) {
        logger.error('Failed to import data:', error);
        return false;
      }
    })
  };

  return {

    currentMapId: data?.mapIdentifier.mapId || null,


    ...mapActions,


    ...historyActions,


    ...fileActions
  };
};
