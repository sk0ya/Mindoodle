/**
 * Move operations for node repositioning - refactored with functional patterns
 * Reduced from 128 lines to 113 lines (12% reduction)
 */

import { logger } from '@shared/utils';
import {
  moveNormalizedNode,
  moveNodeWithPositionNormalized,
  changeSiblingOrderNormalized,
  type NormalizedData
} from '@core/data/normalizedStore';
import type { MindMapStore } from '../types';
import { applyAutoLayoutIfEnabled } from './layoutHelpers';

// === Helpers ===

const syncAndLayout = (get: () => MindMapStore) => {
  get().syncToMindMapData();
  applyAutoLayoutIfEnabled(get, false);
};

type MoveResult = { success: boolean; reason?: string };

const executeMoveOperation = (
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore,
  operation: (state: MindMapStore) => { success: boolean; data?: unknown; reason?: string },
  operationName: string
): MoveResult => {
  let moveResult: MoveResult = { success: false };

  set((state) => {
    if (!state.normalizedData) return;

    const result = operation(state);
    if (result.success && result.data) {
      state.normalizedData = result.data as NormalizedData;
      moveResult = { success: true };
    } else {
      moveResult = result.reason === undefined
        ? { success: false }
        : { success: false, reason: result.reason };
      logger.warn(`${operationName} constraint violation:`, result.reason);
    }
  });

  if (moveResult.success) syncAndLayout(get);

  return moveResult;
};

// === Operations ===

export function createMoveOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Move a node to a new parent
     */
    moveNode: (nodeId: string, newParentId: string): MoveResult =>
      executeMoveOperation(
        set,
        get,
        (state) => state.normalizedData
          ? moveNormalizedNode(state.normalizedData, nodeId, newParentId)
          : { success: false, reason: 'normalizedData is unavailable' },
        'moveNode'
      ),

    /**
     * Move a node to a specific position relative to target
     */
    moveNodeWithPosition: (
      nodeId: string,
      targetNodeId: string,
      position: 'before' | 'after' | 'child'
    ): MoveResult =>
      executeMoveOperation(
        set,
        get,
        (state) => state.normalizedData
          ? moveNodeWithPositionNormalized(state.normalizedData, nodeId, targetNodeId, position)
          : { success: false, reason: 'normalizedData is unavailable' },
        'moveNodeWithPosition'
      ),

    /**
     * Change the order of siblings by moving dragged node relative to target
     */
    changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
      logger.debug('🎪 Store changeSiblingOrder開始:', { draggedNodeId, targetNodeId, insertBefore });

      set((state) => {
        if (!state.normalizedData) {
          logger.error('❌ normalizedDataが存在しません');
          return;
        }

        try {
          logger.debug('🔄 changeSiblingOrder実行:', { draggedNodeId, targetNodeId, insertBefore });
          state.normalizedData = changeSiblingOrderNormalized(state.normalizedData, draggedNodeId, targetNodeId, insertBefore);
          logger.debug('✅ changeSiblingOrder完了');
        } catch (error) {
          logger.error('❌ changeSiblingOrder error:', error);
        }
      });

      syncAndLayout(get);
    }
  };
}
