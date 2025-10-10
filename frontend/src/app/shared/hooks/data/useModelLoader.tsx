import { useState, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { useLoadingState } from '../ui/useBooleanState';

interface UseModelLoaderOptions {
  getAvailableModels: () => Promise<string[]>;
  currentModel: string;
  updateModel: (model: string) => void;
  onCORSError?: (error: string) => void;
}

interface UseModelLoaderReturn {
  availableModels: string[];
  isLoadingModels: boolean;
  loadModels: () => Promise<void>;
  setAvailableModels: (models: string[]) => void;
}

export const useModelLoader = ({
  getAvailableModels,
  currentModel,
  updateModel,
  onCORSError
}: UseModelLoaderOptions): UseModelLoaderReturn => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const { isLoading: isLoadingModels, startLoading: startLoadingModels, stopLoading: stopLoadingModels } = useLoadingState();

  const loadModels = useCallback(async () => {
    startLoadingModels();
    try {
      const models = await getAvailableModels();
      setAvailableModels(models);
      
      
      if (models.length > 0 && !models.includes(currentModel)) {
        updateModel(models[0]);
      }
    } catch (error) {
      logger.error('Failed to load models:', error);
      setAvailableModels([]);
      
      
      const errorMessage = error instanceof Error ? error.message : '';
      if ((errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) && onCORSError) {
        const corsError = 'CORSポリシーエラー: デプロイされたアプリからローカルOllamaにアクセスできません。ローカル開発環境（localhost）で実行してください。';
        onCORSError(corsError);
      }
    } finally {
      stopLoadingModels();
    }
  }, [getAvailableModels, currentModel, updateModel, onCORSError]);

  return {
    availableModels,
    isLoadingModels,
    loadModels,
    setAvailableModels
  };
};