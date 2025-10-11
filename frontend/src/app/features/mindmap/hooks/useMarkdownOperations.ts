import type { MindMapNode } from '@shared/types';
import { statusMessages } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';

interface UpdatedNodesWithError extends Array<MindMapNode> {
  __conversionError?: string;
}

export interface MarkdownOperationsParams {
  data: { rootNodes: MindMapNode[] } | null;
  markdownSync: {
    changeNodeType: (
      rootNodes: MindMapNode[],
      nodeId: string,
      newType: 'heading' | 'unordered-list' | 'ordered-list',
      onSuccess: (updatedNodes: MindMapNode[] | UpdatedNodesWithError) => void
    ) => void;
  };
  store: {
    setRootNodes: (nodes: MindMapNode[], options: { emit: boolean; source: string }) => void;
    applyAutoLayout: () => void;
  };
  selectNode: (nodeId: string) => void;
}


export function useMarkdownOperations({
  data,
  markdownSync,
  store,
  selectNode,
}: MarkdownOperationsParams) {

  
  const changeNodeType = useStableCallback((
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list'
  ) => {
    if (data?.rootNodes?.[0]) {
      markdownSync.changeNodeType(data.rootNodes, nodeId, newType, (updatedNodes) => {

        const nodesWithError = updatedNodes as UpdatedNodesWithError;
        if (nodesWithError.__conversionError) {
          const errorMessage = nodesWithError.__conversionError;
          let typeDisplayName: string;
          switch (newType) {
            case 'heading':
              typeDisplayName = '見出し';
              break;
            case 'unordered-list':
              typeDisplayName = '箇条書きリスト';
              break;
            case 'ordered-list':
            default:
              typeDisplayName = '番号付きリスト';
              break;
          }
          statusMessages.customError(`${typeDisplayName}への変換に失敗しました: ${errorMessage}`);
          return;
        }


        store.setRootNodes(updatedNodes, { emit: true, source: 'changeNodeType' });
        
        try {
          store.applyAutoLayout();
        } catch { }
        
        setTimeout(() => {
          selectNode(nodeId);
        }, 0);
      });
    }
  });

  return {
    changeNodeType,
  };
}
