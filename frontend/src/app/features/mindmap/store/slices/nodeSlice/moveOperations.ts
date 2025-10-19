import { logger } from '@shared/utils';
import {
  moveNormalizedNode,
  moveNodeWithPositionNormalized,
  changeSiblingOrderNormalized,
} from '@core/data/normalizedStore';
import type { MindMapStore } from '../types';

/**
 * Move operations for node repositioning
 * Handles moving nodes between parents and reordering siblings
 */
export function createMoveOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Move a node to a new parent
     * Returns success/failure with reason
     */
    moveNode: (nodeId: string, newParentId: string): { success: boolean; reason?: string } => {
      let moveResult: { success: boolean; reason?: string } = { success: false };

      set((state) => {
        if (!state.normalizedData) return;

        const result = moveNormalizedNode(state.normalizedData, nodeId, newParentId);
        if (result.success) {
          state.normalizedData = result.data;
          moveResult = { success: true };
        } else {
          moveResult = { success: false, reason: result.reason };
          logger.warn('moveNode constraint violation:', result.reason);
        }
      });

      if (moveResult.success) {
        // Sync to tree structure
        get().syncToMindMapData();

        // Apply auto layout
        const { data } = get();
        if (data?.settings?.autoLayout) {
          get().applyAutoLayout();
        }
      }

      return moveResult;
    },

    /**
     * Move a node to a specific position relative to target
     * Position can be 'before', 'after', or 'child'
     */
    moveNodeWithPosition: (
      nodeId: string,
      targetNodeId: string,
      position: 'before' | 'after' | 'child'
    ): { success: boolean; reason?: string } => {
      let moveResult: { success: boolean; reason?: string } = { success: false };

      set((state) => {
        if (!state.normalizedData) return;

        const result = moveNodeWithPositionNormalized(state.normalizedData, nodeId, targetNodeId, position);
        if (result.success) {
          state.normalizedData = result.data;
          moveResult = { success: true };
        } else {
          moveResult = { success: false, reason: result.reason };
          logger.warn('moveNodeWithPosition constraint violation:', result.reason);
        }
      });

      if (moveResult.success) {
        // Sync to tree structure
        get().syncToMindMapData();

        // Apply auto layout
        const { data } = get();
        if (data?.settings?.autoLayout) {
          get().applyAutoLayout();
        }
      }

      return moveResult;
    },

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
          const originalData = state.normalizedData;
          state.normalizedData = changeSiblingOrderNormalized(state.normalizedData, draggedNodeId, targetNodeId, insertBefore);

          // Check if changes occurred
          const hasChanged = JSON.stringify(originalData.childrenMap) !== JSON.stringify(state.normalizedData.childrenMap);
          logger.debug('🔄 変更チェック:', { hasChanged });

          logger.debug('🔄 データ更新完了');
          logger.debug('✅ changeSiblingOrder完了');
        } catch (error) {
          logger.error('❌ changeSiblingOrder error:', error);
        }
      });

      // Sync to tree structure
      get().syncToMindMapData();

      // Apply auto layout
      const { data } = get();
      if (data?.settings?.autoLayout) {
        logger.debug('🔄 自動レイアウト適用中...');
        get().applyAutoLayout();
      }
    },
  };
}
