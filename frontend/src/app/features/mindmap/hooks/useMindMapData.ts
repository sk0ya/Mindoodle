import { useStableCallback } from '@shared/hooks';
import { useMindMapStore } from '../store';
import type { MindMapNode, MindMapData } from '@shared/types';


export const useMindMapData = () => {
  const store = useMindMapStore();

  const dataOperations = {
    
    addNode: useStableCallback((parentId: string, text: string = '') => {
      store.addChildNode(parentId, text);
    }),

    updateNode: useStableCallback((nodeId: string, updates: Partial<MindMapNode>) => {
      store.updateNode(nodeId, updates);
    }),

    deleteNode: useStableCallback((nodeId: string) => {
      store.deleteNode(nodeId);
    }),

    moveNode: useStableCallback((nodeId: string, newParentId: string): { success: boolean; reason?: string } => {
      return store.moveNode(nodeId, newParentId);
    }),

    moveNodeWithPosition: useStableCallback((nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child'): { success: boolean; reason?: string } => {
      return store.moveNodeWithPosition(nodeId, targetNodeId, position);
    }),

    changeSiblingOrder: useStableCallback((draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
      store.changeSiblingOrder(draggedNodeId, targetNodeId, insertBefore);
    }),

    toggleNodeCollapse: useStableCallback((nodeId: string) => {
      store.toggleNodeCollapse(nodeId);
    }),

    
    startEditing: useStableCallback((nodeId: string) => {
      store.startEditing(nodeId);
    }),

    startEditingWithCursorAtEnd: useStableCallback((nodeId: string) => {
      store.startEditingWithCursorAtEnd(nodeId);
    }),

    startEditingWithCursorAtStart: useStableCallback((nodeId: string) => {
      store.startEditingWithCursorAtStart(nodeId);
    }),

    finishEditing: useStableCallback((nodeId: string, text: string) => {
      store.finishEditing(nodeId, text);
    }),

    cancelEditing: useStableCallback(() => {
      store.cancelEditing();
    }),

    setEditText: useStableCallback((text: string) => {
      store.setEditText(text);
    }),

    
    selectNode: useStableCallback((nodeId: string | null) => {
      store.selectNode(nodeId);
    }),

    
    setData: useStableCallback((data: MindMapData) => {
      store.setData(data);
    }),
    setRootNodes: useStableCallback((rootNodes: MindMapNode[]) => {
      (store as any).setRootNodes(rootNodes);
    }),

    
    applyAutoLayout: useStableCallback(() => {
      store.applyAutoLayout();
    })
  };

  return {
    
    data: store.data,
    normalizedData: store.normalizedData,
    selectedNodeId: store.selectedNodeId,
    editingNodeId: store.editingNodeId,
    editText: store.editText,
    editingMode: store.editingMode,
    
    
    ...dataOperations
  };
};
