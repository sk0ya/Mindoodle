import { useCallback } from 'react';
import type { MindMapNode } from '@shared/types';
import { statusMessages } from '@shared/utils';

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

/**
 * Hook for markdown-specific operations (type changes, etc.)
 */
export function useMarkdownOperations({
  data,
  markdownSync,
  store,
  selectNode,
}: MarkdownOperationsParams) {

  /**
   * Change node type (heading, unordered-list, ordered-list)
   */
  const changeNodeType = useCallback((
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list'
  ) => {
    if (data?.rootNodes?.[0]) {
      markdownSync.changeNodeType(data.rootNodes, nodeId, newType, (updatedNodes) => {
        // 変換エラーをチェック
        if ((updatedNodes as any).__conversionError) {
          const errorMessage = (updatedNodes as any).__conversionError;
          const typeDisplayName = newType === 'heading' ? '見出し' :
            newType === 'unordered-list' ? '箇条書きリスト' : '番号付きリスト';
          statusMessages.customError(`${typeDisplayName}への変換に失敗しました: ${errorMessage}`);
          return;
        }

        // ルートノードを置き換え（履歴に積む）
        (store as any).setRootNodes(updatedNodes, { emit: true, source: 'changeNodeType' });
        // Ensure unified auto-layout after markdown-driven structure changes
        try {
          store.applyAutoLayout();
        } catch { }
        // 選択状態は維持しつつ再描画。明示的な selectNode(null) は行わない
        setTimeout(() => {
          selectNode(nodeId);
        }, 0);
      });
    }
  }, [data, markdownSync, store, selectNode]);

  return {
    changeNodeType,
  };
}
