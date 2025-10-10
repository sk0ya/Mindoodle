import type { MindMapNode } from '@shared/types';
import { statusMessages } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';

export interface MarkdownOperationsParams {
  data: { rootNodes: MindMapNode[] } | null;
  markdownSync: {
    changeNodeType: (
      rootNodes: MindMapNode[],
      nodeId: string,
      newType: 'heading' | 'unordered-list' | 'ordered-list',
      onSuccess: (updatedNodes: MindMapNode[]) => void
    ) => void;
  };
  store: {
    setRootNodes?: (nodes: MindMapNode[], options: { emit: boolean; source: string }) => void;
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
        
        if ((updatedNodes as any).__conversionError) {
          const errorMessage = (updatedNodes as any).__conversionError;
          const typeDisplayName = newType === 'heading' ? '見出し' :
            newType === 'unordered-list' ? '箇条書きリスト' : '番号付きリスト';
          statusMessages.customError(`${typeDisplayName}への変換に失敗しました: ${errorMessage}`);
          return;
        }

        
        (store as any).setRootNodes(updatedNodes, { emit: true, source: 'changeNodeType' });
        
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
