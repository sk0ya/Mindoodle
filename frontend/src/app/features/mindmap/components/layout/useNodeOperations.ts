import { useCallback } from 'react';
import { useMindMapStore } from '../../store';
import { findNodeInRoots } from '@mindmap/utils';
import { nodeToMarkdown } from '../../../markdown';
import { pasteFromClipboard } from '../../utils/clipboardPaste';
import type { MindMapNode, MapIdentifier } from '@shared/types';
import type { NotificationType } from '@shared/hooks';
import type { UIState } from '@shared/types/ui.types';

interface UseNodeOperationsProps {
  data: { rootNodes: MindMapNode[]; mapIdentifier?: MapIdentifier } | null;
  ui: UIState;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  selectNode: (nodeId: string | null) => void;
  deleteNode: (nodeId: string) => void;
  showNotification: (type: NotificationType, message: string, duration?: number) => void;
}

export const useNodeOperations = ({
  data,
  ui,
  updateNode,
  selectNode,
  deleteNode,
  showNotification,
}: UseNodeOperationsProps) => {
  const store = useMindMapStore();

  const findNode = useCallback((nodeId: string): MindMapNode | null => {
    return findNodeInRoots(data?.rootNodes || [], nodeId);
  }, [data?.rootNodes]);

  const handleCopyNode = useCallback((node: MindMapNode) => {
    store.setClipboard(node);
    const markdownText = nodeToMarkdown(node);
    navigator.clipboard?.writeText?.(markdownText).catch(() => { });
    showNotification('success', `「${node.text}」をコピーしました`);
  }, [store, showNotification]);

  const handlePasteNode = useCallback(async (parentId: string) => {
    await pasteFromClipboard(
      parentId,
      ui.clipboard,
      store.addChildNode,
      updateNode,
      selectNode,
      showNotification
    );
  }, [ui.clipboard, store, updateNode, selectNode, showNotification]);

  const handleAddChild = useCallback((parentId: string, text?: string): string | undefined => {
    return store.addChildNode(parentId, text || 'New Node');
  }, [store]);

  const nodeOperations = {
    findNode,
    onDeleteNode: deleteNode,
    onUpdateNode: updateNode,
    onCopyNode: handleCopyNode,
    onPasteNode: handlePasteNode,
    onAddChild: handleAddChild,
  };

  return {
    nodeOperations,
    findNode,
    handleCopyNode,
    handlePasteNode,
    handleAddChild,
  };
};
