/**
 * FileOperationsService
 *
 * Service for file import/export operations.
 * Extracted from useMindMapActions.ts to centralize file handling logic.
 */

import { DEFAULT_WORKSPACE_ID, type MindMapData, type MindMapNode } from '@shared/types';
import { logger, safeJsonParse } from '@shared/utils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMindMapNode = (value: unknown): value is MindMapNode => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    Array.isArray(value.children)
  );
};

const isCurrentMapData = (value: unknown): value is MindMapData => {
  if (!isRecord(value) || !Array.isArray(value.rootNodes)) return false;
  if (!value.rootNodes.every(isMindMapNode)) return false;

  const identifier = value.mapIdentifier;
  return (
    isRecord(identifier) &&
    typeof identifier.mapId === 'string' &&
    typeof identifier.workspaceId === 'string'
  );
};

const isLegacyMapData = (
  value: unknown
): value is { id: string; title: string; rootNode: MindMapNode } => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isMindMapNode(value.rootNode)
  );
};

export class FileOperationsService {
  /**
   * Export map data as JSON string
   */
  static exportMapAsJson(data: MindMapData | null): string {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  }

  /**
   * Validate imported map data structure
   */
  static validateImportData(parsedData: unknown): boolean {
    return isCurrentMapData(parsedData) || isLegacyMapData(parsedData);
  }

  /**
   * Parse and validate JSON import data
   */
  static parseImportData(jsonData: string): {
    success: boolean;
    data?: MindMapData;
    error?: string;
  } {
    try {
      const parseResult = safeJsonParse(jsonData);
      if (!parseResult.success) {
        logger.error('Failed to parse import data:', parseResult.error);
        return { success: false, error: parseResult.error };
      }

      const parsedData = parseResult.data;

      if (!this.validateImportData(parsedData)) {
        return { success: false, error: 'Invalid map data structure' };
      }

      if (isCurrentMapData(parsedData)) {
        return { success: true, data: parsedData };
      }

      if (!isLegacyMapData(parsedData)) {
        return { success: false, error: 'Invalid map data structure' };
      }

      // Normalize the legacy single-root format so callers can always consume
      // the current MindMapData shape.
      const now = new Date().toISOString();
      const legacyData: MindMapData = {
        title: parsedData.title,
        category: '',
        createdAt: now,
        updatedAt: now,
        mapIdentifier: {
          mapId: parsedData.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
        rootNodes: [parsedData.rootNode],
        settings: {
          autoSave: true,
          autoLayout: true,
          showGrid: false,
          animationEnabled: true,
        },
      };

      return {
        success: true,
        data: legacyData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse import data:', error);
      return { success: false, error: errorMessage };
    }
  }
}
