import type { MindMapNode } from '@shared/types';
import { findNodeLineRange, convertNodeToMarkdown } from './shortcutHandlerUtils';

/**
 * マークダウンコンテンツからノードのテキストを抽出
 */
export const extractNodeMarkdown = (
  nodeId: string,
  roots: MindMapNode[],
  node: MindMapNode,
  markdownContent: string
): string => {
  try {
    const lines = markdownContent.split('\n');
    const range = findNodeLineRange(roots, nodeId);

    if (range) {
      const extractedLines = lines.slice(range.startLine, range.endLine + 1);
      return extractedLines.join('\n');
    }
  } catch (error) {
    console.warn('Failed to extract markdown from content:', error);
  }

  // フォールバック
  return convertNodeToMarkdown(node);
};

/**
 * ノードをクリップボードにコピー
 */
export const copyNodeWithMarkdown = async (
  node: MindMapNode,
  markdownText: string,
  onSuccess: (message: string) => void
): Promise<void> => {
  const { copyNodeToClipboard } = await import('@mindmap/services/NodeClipboardService');
  await copyNodeToClipboard(node, markdownText, onSuccess);
};

/**
 * ノードのテキストのみをコピー
 */
export const copyNodeTextOnly = async (
  node: MindMapNode,
  onSuccess: (message: string) => void
): Promise<void> => {
  const { copyNodeTextToClipboard } = await import('@mindmap/services/NodeClipboardService');
  await copyNodeTextToClipboard(node);
  onSuccess(`「${node.text}」のテキストをコピーしました`);
};
