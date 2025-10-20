import { useMindMapStore } from '../store';
import { useStableCallback } from '@shared/hooks';

/**
 * Hook to access node editing state and operations
 * Consolidates common editing-related store access patterns
 */
export const useNodeEditing = () => {
  const editingNodeId = useMindMapStore(s => s.editingNodeId);
  const editingMode = useMindMapStore(s => s.editingMode);
  const startEditing = useMindMapStore(s => s.startEditing);
  const startEditingWithCursorAtEnd = useMindMapStore(s => s.startEditingWithCursorAtEnd);
  const startEditingWithCursorAtStart = useMindMapStore(s => s.startEditingWithCursorAtStart);
  const cancelEditing = useMindMapStore(s => s.cancelEditing);
  const finishEditing = useMindMapStore(s => s.finishEditing);
  const editText = useMindMapStore(s => s.editText);
  const setEditText = useMindMapStore(s => s.setEditText);

  const isEditing = useStableCallback((nodeId?: string) => {
    if (nodeId) {
      return editingNodeId === nodeId;
    }
    return editingNodeId !== null;
  });

  return {
    editingNodeId,
    editingMode,
    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    cancelEditing,
    finishEditing,
    editText,
    setEditText,
    isEditing,
  };
};
