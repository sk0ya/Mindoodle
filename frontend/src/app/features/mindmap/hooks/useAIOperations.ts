import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { useStableCallback } from '@shared/hooks';

export interface AIOperationsParams {
  ai: {
    generateChildNodes: (node: MindMapNode) => Promise<string[]>;
  };
  addNode: (parentId: string, text: string) => void;
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  onComplete?: () => void;
}


export function useAIOperations({
  ai,
  addNode,
  showNotification,
  onComplete,
}: AIOperationsParams) {

  
  const handleAIGenerate = useStableCallback(async (node: MindMapNode) => {
    
    showNotification('info', 'AI子ノード生成中... 🤖');

    try {
      const childTexts = await ai.generateChildNodes(node);

      
      childTexts.forEach(text => {
        addNode(node.id, text.trim());
      });

      showNotification('success', `✅ ${childTexts.length}個の子ノードを生成しました`);
    } catch (error) {
      logger.error('AI child node generation failed:', error);
      showNotification('error', '❌ AI子ノード生成に失敗しました');
    } finally {
      onComplete?.();
    }
  });

  return {
    handleAIGenerate,
  };
}
