import type { MindMapNode } from '@shared/types';
import type { MindMapStore } from '../types';

/**
 * Query operations for efficient node lookups
 * These use normalized data structure for O(1) access
 */
export function createQueryOperations(get: () => MindMapStore) {
  return {
    /**
     * Find a node by ID using normalized data (O(1))
     */
    findNode: (nodeId: string): MindMapNode | null => {
      const { normalizedData } = get();
      if (!normalizedData || !nodeId) return null;
      return normalizedData.nodes[nodeId] || null;
    },

    /**
     * Get all direct children of a node (O(1) lookup + O(k) mapping)
     */
    getChildNodes: (nodeId: string): MindMapNode[] => {
      const { normalizedData } = get();
      if (!normalizedData || !nodeId) return [];
      const childIds = normalizedData.childrenMap[nodeId] || [];
      return childIds.map((childId: string) => normalizedData.nodes[childId]).filter(Boolean);
    },
  };
}
