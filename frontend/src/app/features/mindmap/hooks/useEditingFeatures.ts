import { useEditingState } from './useEditingState';
import { useMarkdownOperations, type MarkdownOperationsParams } from './useMarkdownOperations';
import { useMindMapClipboard, type ClipboardOperationsParams } from './useMindMapClipboard';


export const useEditingFeatures = (
  markdownParams: MarkdownOperationsParams,
  clipboardParams: ClipboardOperationsParams
) => {
  const editingState = useEditingState();
  const markdownOps = useMarkdownOperations(markdownParams);
  const clipboardOps = useMindMapClipboard(clipboardParams);

  return {
    
    editingState,

    
    markdownOps,

    
    clipboardOps
  };
};
