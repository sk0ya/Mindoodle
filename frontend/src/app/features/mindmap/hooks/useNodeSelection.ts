import { useMindMapStore } from '../store';
import { useStableCallback } from '@shared/hooks';

/**
 * Hook to access node selection state and operations
 * Consolidates common selection-related store access patterns
 */
export const useNodeSelection = () => {
  const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
  const selectNode = useMindMapStore(s => s.selectNode);

  const isSelected = useStableCallback((nodeId: string) => {
    return selectedNodeId === nodeId;
  });

  const clearSelection = useStableCallback(() => {
    selectNode(null);
  });

  return {
    selectedNodeId,
    selectNode,
    clearSelection,
    isSelected,
    hasSelection: selectedNodeId !== null,
  };
};
