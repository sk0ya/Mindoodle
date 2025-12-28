/**
 * MapOperationsService
 *
 * Service for map CRUD operations and data creation.
 * Extracted from useMindMap.ts to separate business logic from React hooks.
 */

import type { MindMapData, MindMapNode, MapIdentifier } from '@shared/types';
import { PathResolutionService } from './PathResolutionService';

export class MapOperationsService {
  /**
   * Create MindMapData object from components
   */
  static createMapData(
    mapId: string,
    workspaceId: string,
    rootNodes: MindMapNode[],
    updatedAt: string,
    titleOverride?: string
  ): MindMapData {
    return {
      title: titleOverride || mapId,
      category: PathResolutionService.extractCategory(mapId),
      rootNodes,
      createdAt: updatedAt,
      updatedAt,
      settings: {
        autoSave: true,
        autoLayout: true,
        showGrid: false,
        animationEnabled: true
      },
      mapIdentifier: { mapId, workspaceId }
    };
  }

  /**
   * Check if given identifier matches current map
   */
  static isCurrentMap(
    currentData: MindMapData | null,
    identifier: MapIdentifier
  ): boolean {
    return !!(
      currentData &&
      currentData.mapIdentifier.mapId === identifier.mapId &&
      currentData.mapIdentifier.workspaceId === identifier.workspaceId
    );
  }

  /**
   * Find map in collection by identifier
   */
  static findMapByIdentifier(
    maps: MindMapData[],
    identifier: MapIdentifier
  ): MindMapData | undefined {
    return maps.find(
      map =>
        map.mapIdentifier.mapId === identifier.mapId &&
        map.mapIdentifier.workspaceId === identifier.workspaceId
    );
  }

  /**
   * Extract workspace ID from path string
   */
  static extractWorkspaceId(path: string): string | null {
    const match = /^\/?(ws_[^/]+|cloud)/.exec(path);
    return match ? match[1] : null;
  }
}
