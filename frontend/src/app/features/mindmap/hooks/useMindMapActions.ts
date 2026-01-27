import { useMapData, useHistoryState, useMapOperations } from './useStoreSelectors';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { logger } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';
import { FileOperationsService } from '@mindmap/services/FileOperationsService';


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
          applyAutoLayout(true);
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
      return FileOperationsService.exportMapAsJson(data);
    }),

    importData: useStableCallback((jsonData: string): boolean => {
      const result = FileOperationsService.parseImportData(jsonData);

      if (!result.success || !result.data) {
        logger.error('Failed to import data:', result.error);
        return false;
      }

      setRootNodes(result.data.rootNodes);
      return true;
    })
  };

  return {

    currentMapId: data?.mapIdentifier.mapId || null,


    ...mapActions,


    ...historyActions,


    ...fileActions
  };
};
