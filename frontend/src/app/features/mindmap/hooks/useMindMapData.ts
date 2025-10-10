import { useStableCallback } from '@shared/hooks';
import { useMindMapStore } from '../store';
import type { MindMapNode, MindMapData } from '@shared/types';

/**
 * データ操作に特化したHook
 * ノードとマップの基本的なCRUD操作を担当
 */
export const useMindMapData = () => {
  const store = useMindMapStore();

  const dataOperations = {
    // ノード操作
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

    // 編集状態
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

    // 選択状態
    selectNode: useStableCallback((nodeId: string | null) => {
      store.selectNode(nodeId);
    }),

    // データ設定
    setData: useStableCallback((data: MindMapData) => {
      store.setData(data);
    }),
    setRootNodes: useStableCallback((rootNodes: MindMapNode[]) => {
      (store as any).setRootNodes(rootNodes);
    }),

    // レイアウト
    applyAutoLayout: useStableCallback(() => {
      store.applyAutoLayout();
    })
  };

  return {
    // 状態
    data: store.data,
    normalizedData: store.normalizedData,
    selectedNodeId: store.selectedNodeId,
    editingNodeId: store.editingNodeId,
    editText: store.editText,
    editingMode: store.editingMode,
    
    // 操作
    ...dataOperations
  };
};
