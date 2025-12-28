import { useCallback } from 'react';
// removed unused imports
import { statusMessages } from '@shared/utils';
import type { MindMapNode } from '@shared/types';

interface UseContextMenuHandlersProps {
  data: any;
  markdownSync: any;
  store: any;
  selectNode: (nodeId: string | null) => void;
  handleContextMenuClose: () => void;
}

export const useContextMenuHandlers = ({
  data,
  markdownSync,
  store,
  selectNode,
  handleContextMenuClose,
}: UseContextMenuHandlersProps) => {

  const handleMarkdownNodeType = useCallback((
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list',
    options?: { isCheckbox?: boolean; isChecked?: boolean }
  ) => {
    if (data?.rootNodes?.[0]) {
      handleContextMenuClose();

      markdownSync.changeNodeType(data.rootNodes, nodeId, newType, (updatedNodes: MindMapNode[]) => {
        const nodesWithError = updatedNodes as unknown as { __conversionError?: string };
        if (nodesWithError.__conversionError) {
          const errorMessage = nodesWithError.__conversionError;
          const typeNames = {
            'heading': '見出し',
            'unordered-list': '箇条書きリスト',
            'ordered-list': '番号付きリスト'
          };
          statusMessages.customError(`${typeNames[newType]}への変換に失敗しました: ${errorMessage}`);
          return;
        }

        const storeWithSetRootNodes = store as unknown as {
          setRootNodes: (nodes: MindMapNode[], options: { emit: boolean; source: string }) => void;
        };
        storeWithSetRootNodes.setRootNodes(updatedNodes, { emit: true, source: 'contextMenu.changeNodeType' });

        try { store.applyAutoLayout(); } catch {}

        setTimeout(() => {
          try { selectNode(nodeId); } catch {  }
        }, 0);
      }, options);
    }
  }, [data, markdownSync, store, selectNode, handleContextMenuClose]);

  const handleAddLinkFromContextMenu = useCallback((
    nodeId: string,
    setLinkModalNodeId: (id: string) => void,
    setShowLinkModal: (show: boolean) => void
  ) => {
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
    handleContextMenuClose();
  }, [handleContextMenuClose]);

  return {
    handleMarkdownNodeType,
    handleAddLinkFromContextMenu,
  };
};
