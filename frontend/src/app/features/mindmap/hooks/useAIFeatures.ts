import { useAIOperations, type AIOperationsParams } from './useAIOperations';

/**
 * AI機能の統合Hook
 *
 * AI操作を統合（将来的に追加のAI機能を含める可能性あり）
 */
export const useAIFeatures = (aiParams: AIOperationsParams) => {
  const aiOps = useAIOperations(aiParams);

  return {
    // AI操作
    aiOps
  };
};
