import { useStableCallback } from '@shared/hooks';
import { useMapData, useNormalizedData, useNodeOperations, useMapOperations } from './useStoreSelectors';
import { useNodeSelection } from './useNodeSelection';
import { useNodeEditing } from './useNodeEditing';
import type { MindMapNode } from '@shared/types';


export const useMindMapData = () => {
  const data = useMapData();
  const normalizedData = useNormalizedData();
  const { selectedNodeId } = useNodeSelection();
  const { editingNodeId, editText, editingMode, startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart, finishEditing, cancelEditing, setEditText } = useNodeEditing();
  const nodeOps = useNodeOperations();
  const { setData, setRootNodes, applyAutoLayout } = useMapOperations();

  const dataOperations = {

    addNode: useStableCallback((parentId: string, text: string = '') => {
      nodeOps.addChildNode(parentId, text);
    }),

    updateNode: useStableCallback((nodeId: string, updates: Partial<MindMapNode>) => {
      nodeOps.updateNode(nodeId, updates);
    }),

    deleteNode: useStableCallback((nodeId: string) => {
      nodeOps.deleteNode(nodeId);
    }),

    moveNode: useStableCallback((nodeId: string, newParentId: string): { success: boolean; reason?: string } => {
      return nodeOps.moveNode(nodeId, newParentId);
    }),

    moveNodeWithPosition: useStableCallback((nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child'): { success: boolean; reason?: string } => {
      return nodeOps.moveNodeWithPosition(nodeId, targetNodeId, position);
    }),

    changeSiblingOrder: useStableCallback((draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
      nodeOps.changeSiblingOrder(draggedNodeId, targetNodeId, insertBefore);
    }),

    toggleNodeCollapse: useStableCallback((nodeId: string) => {
      nodeOps.toggleNodeCollapse(nodeId);
    }),


    startEditing,
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing,
    cancelEditing,
    setEditText,


    selectNode: useNodeSelection().selectNode,


    setData,
    setRootNodes,


    applyAutoLayout
  };

  return {

    data,
    normalizedData,
    selectedNodeId,
    editingNodeId,
    editText,
    editingMode,


    ...dataOperations
  };
};
