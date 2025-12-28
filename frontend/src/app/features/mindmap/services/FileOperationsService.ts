/**
 * FileOperationsService
 *
 * Service for file import/export operations.
 * Extracted from useMindMapActions.ts to centralize file handling logic.
 */

import type { MindMapData } from '@shared/types';
import { logger, safeJsonParse } from '@shared/utils';

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
    if (!parsedData || typeof parsedData !== 'object') {
      return false;
    }

    // Legacy format validation
    if (!('id' in parsedData) || !('title' in parsedData) || !('rootNode' in parsedData)) {
      return false;
    }

    const { id, title, rootNode } = parsedData as {
      id?: unknown;
      title?: unknown;
      rootNode?: unknown;
    };

    if (typeof id !== 'string' || typeof title !== 'string' || !rootNode) {
      return false;
    }

    return true;
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

      return {
        success: true,
        data: parsedData as unknown as MindMapData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse import data:', error);
      return { success: false, error: errorMessage };
    }
  }
}
