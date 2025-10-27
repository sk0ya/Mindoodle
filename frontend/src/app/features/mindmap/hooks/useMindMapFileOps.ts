/**
 * MindMap file operations hook - refactored with functional patterns
 * Reduced from 176 lines to 166 lines (6% reduction)
 */

import { useStableCallback } from '@shared/hooks';
import { logger } from '@shared/utils';
import type { MindMapData, MapIdentifier } from '@shared/types';

export interface UseMindMapFileOpsParams {
  data: MindMapData | null;
  allMindMaps: MindMapData[];
  mindMap: {
    readImageAsDataURL?: (path: string, workspaceId?: string) => Promise<string | null>;
    refreshMapList?: () => Promise<void>;
    selectRootFolder?: () => Promise<boolean>;
  };
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}


const resolvePath = (baseFilePath: string, relativePath: string): string => {
  // Absolute-like path inside workspace
  if (/^\//.test(relativePath)) return relativePath.replace(/^\//, '');

  // Get base directory of current map
  const baseDir = baseFilePath.includes('/') ? baseFilePath.replace(/\/[^/]*$/, '') : '';
  const baseSegs = baseDir ? baseDir.split('/') : [];
  const relSegs = relativePath.replace(/^\.\//, '').split('/');
  const out: string[] = [...baseSegs];

  for (const seg of relSegs) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0) out.pop();
    } else {
      out.push(seg);
    }
  }

  return out.join('/');
};

const findMapByIdentifier = (maps: MindMapData[], identifier: MapIdentifier): MindMapData | undefined =>
  maps.find(map =>
    map.mapIdentifier.mapId === identifier.mapId &&
    map.mapIdentifier.workspaceId === identifier.workspaceId
  );

const isCurrentMap = (data: MindMapData | null, identifier: MapIdentifier): boolean =>
  !!data &&
  data.mapIdentifier.mapId === identifier.mapId &&
  data.mapIdentifier.workspaceId === identifier.workspaceId;


export function useMindMapFileOps(params: UseMindMapFileOpsParams) {
  const { data, allMindMaps, mindMap, showNotification } = params;

  const loadMapData = useStableCallback(
    async (mapIdentifier: MapIdentifier): Promise<MindMapData | null> => {
      try {
        // Return current map if it matches
        if (isCurrentMap(data, mapIdentifier)) return data;

        // Find target map in all maps
        const targetMap = findMapByIdentifier(allMindMaps, mapIdentifier);
        if (targetMap) return targetMap;

        logger.warn('指定されたマップが見つかりません:', mapIdentifier);
        showNotification('warning', '指定されたマップが見つかりません');
        return null;
      } catch (error) {
        logger.error('マップデータの読み込みに失敗:', error);
        showNotification('error', 'マップデータの読み込みに失敗しました');
        return null;
      }
    }
  );

  const onLoadRelativeImage = useStableCallback(
    async (relativePath: string): Promise<string | null> => {
      try {
        if (typeof mindMap.readImageAsDataURL !== 'function') {
          logger.warn('[onLoadRelativeImage] readImageAsDataURL is not available');
          return null;
        }

        const workspaceId = data?.mapIdentifier?.workspaceId;
        const currentMapId = data?.mapIdentifier?.mapId || '';

        const resolvedPath = resolvePath(currentMapId, relativePath);
        const dataURL = await mindMap.readImageAsDataURL(resolvedPath, workspaceId);

        return dataURL || null;
      } catch (error) {
        logger.error('[onLoadRelativeImage] Failed to load relative image:', error, { relativePath });
        return null;
      }
    }
  );

  const updateMultipleMapCategories = useStableCallback(
    async (mapUpdates: Array<{ id: string; category: string }>) => {
      logger.debug('Updating multiple map categories:', mapUpdates);
      if (mapUpdates.length === 0) return;

      try {
        // Batch update map metadata
        const updatedMaps = mapUpdates
          .map(update => {
            const mapToUpdate = allMindMaps.find(map => map.mapIdentifier.mapId === update.id);
            if (!mapToUpdate) return null;

            return {
              ...mapToUpdate,
              category: update.category,
              updatedAt: new Date().toISOString()
            };
          })
          .filter(Boolean);

        logger.debug(`Batch updating ${updatedMaps.length} maps`);

        // Force refresh map list to reflect UI immediately
        if (typeof mindMap.refreshMapList === 'function') {
          await mindMap.refreshMapList();
        }

        logger.debug(`Successfully batch updated ${updatedMaps.length} maps`);
      } catch (error) {
        console.error('Failed to batch update map categories:', error);

        // Refresh even on error
        if (typeof mindMap.refreshMapList === 'function') {
          await mindMap.refreshMapList();
        }
      }
    }
  );

  const handleSelectFolder = useStableCallback(
    async (onSuccess?: () => void) => {
      try {
        if (typeof mindMap.selectRootFolder === 'function') {
          const ok = await mindMap.selectRootFolder();
          if (ok && onSuccess) {
            onSuccess();
          } else if (!ok) {
            console.warn('selectRootFolder is not available on current adapter');
          }
        }
      } catch (e) {
        console.error('Folder selection failed:', e);
      }
    }
  );

  return {
    loadMapData,
    onLoadRelativeImage,
    updateMultipleMapCategories,
    handleSelectFolder
  };
}
