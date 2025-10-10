import { useEditingState } from './useEditingState';
import { useMarkdownOperations, type MarkdownOperationsParams } from './useMarkdownOperations';
import { useMindMapClipboard, type ClipboardOperationsParams } from './useMindMapClipboard';

/**
 * 編集機能の統合Hook
 *
 * 編集状態管理、マークダウン操作、クリップボード操作を統合
 */
export const useEditingFeatures = (
  markdownParams: MarkdownOperationsParams,
  clipboardParams: ClipboardOperationsParams
) => {
  const editingState = useEditingState();
  const markdownOps = useMarkdownOperations(markdownParams);
  const clipboardOps = useMindMapClipboard(clipboardParams);

  return {
    // 編集状態
    editingState,

    // マークダウン操作
    markdownOps,

    // クリップボード操作
    clipboardOps
  };
};
