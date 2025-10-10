/**
 * useMindMapFileOps
 *
 * Handles file and folder operations for MindMap.
 * Extracted from MindMapApp.tsx to reduce component complexity.
 */

import { useStableCallback } from '@shared/hooks';
import { logger } from '@shared/utils';

import type { MindMapData, MapIdentifier } from '@shared/types';

export interface UseMindMapFileOpsParams {
  data: MindMapData | null;
  allMindMaps: any[]; // Array of map metadata
  mindMap: any; // mindMap instance with methods
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export function useMindMapFileOps(params: UseMindMapFileOpsParams) {
  const { data, allMindMaps, mindMap, showNotification } = params;

  /**
   * Load map data by identifier
   */
  const loadMapData = useStableCallback(
    async (mapIdentifier: MapIdentifier): Promise<MindMapData | null> => {
      try {
        if (
          data &&
          mapIdentifier.mapId === data.mapIdentifier.mapId &&
          mapIdentifier.workspaceId === data.mapIdentifier.workspaceId
        ) {
          // Return current map data
          return data;
        }

        // Load other map data
        const targetMap = allMindMaps.find(
          (map: any) =>
            map.mapIdentifier.mapId === mapIdentifier.mapId &&
            map.mapIdentifier.workspaceId === mapIdentifier.workspaceId
        );

        if (targetMap) {
          return targetMap;
        }

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

  /**
   * Load relative image path and return data URL
   */
  const onLoadRelativeImage = useStableCallback(
    async (relativePath: string): Promise<string | null> => {
      try {
        if (typeof (mindMap).readImageAsDataURL !== 'function') {
          return null;
        }

        const workspaceId = data?.mapIdentifier?.workspaceId;
        const currentMapId = data?.mapIdentifier?.mapId || '';

        // Resolve relative path against current map directory
        const resolvePath = (baseFilePath: string, rel: string): string => {
          // Absolute-like path inside workspace
          if (/^\//.test(rel)) {
            return rel.replace(/^\//, '');
          }

          // Get base directory of current map
          const baseDir = baseFilePath.includes('/')
            ? baseFilePath.replace(/\/[^/]*$/, '')
            : '';
          const baseSegs = baseDir ? baseDir.split('/') : [];
          const relSegs = rel.replace(/^\.\//, '').split('/');
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

        const resolvedPath = resolvePath(currentMapId, relativePath);
        const dataURL = await (mindMap).readImageAsDataURL(resolvedPath, workspaceId);

        return dataURL || null;
      } catch (error) {
        logger.error('Failed to load relative image:', error);
        return null;
      }
    }
  );

  /**
   * Update multiple map categories in batch
   */
  const updateMultipleMapCategories = useStableCallback(
    async (mapUpdates: Array<{ id: string; category: string }>) => {
      logger.debug('Updating multiple map categories:', mapUpdates);

      if (mapUpdates.length === 0) return;

      try {
        // Batch update map metadata
        const updatedMaps = mapUpdates
          .map(update => {
            const mapToUpdate = allMindMaps.find(
              (map: any) => map.mapIdentifier.mapId === update.id
            );
            if (!mapToUpdate) return null;

            return {
              ...mapToUpdate,
              category: update.category,
              updatedAt: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        logger.debug(`Batch updating ${updatedMaps.length} maps`);

        // Force refresh map list to reflect UI immediately
        if (typeof (mindMap).refreshMapList === 'function') {
          await (mindMap).refreshMapList();
        }

        logger.debug(`Successfully batch updated ${updatedMaps.length} maps`);
      } catch (error) {
        console.error('Failed to batch update map categories:', error);

        // Try to sync state even on error
        if (typeof (mindMap).refreshMapList === 'function') {
          await (mindMap).refreshMapList();
        }
      }
    }
  );

  /**
   * Handle folder selection for local storage mode
   */
  const handleSelectFolder = useStableCallback(
    async (onSuccess?: () => void) => {
      try {
        if (typeof (mindMap).selectRootFolder === 'function') {
          const ok = await (mindMap).selectRootFolder();
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
    handleSelectFolder,
  };
}
