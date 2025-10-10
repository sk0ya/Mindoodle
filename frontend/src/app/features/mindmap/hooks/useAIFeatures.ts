import { useAIOperations, type AIOperationsParams } from './useAIOperations';


export const useAIFeatures = (aiParams: AIOperationsParams) => {
  const aiOps = useAIOperations(aiParams);

  return {
    
    aiOps
  };
};
