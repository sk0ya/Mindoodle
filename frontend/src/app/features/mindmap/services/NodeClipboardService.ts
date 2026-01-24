/**
 * Node clipboard service - refactored with functional patterns
 * Reduced from 85 lines to 71 lines (16% reduction)
 */

import type { MindMapNode } from '@shared/types';
import { generateObjectHash, logger } from '@shared/utils';

// === State ===

let lastCopiedHash: string | null = null;

export const getLastCopiedHash = (): string | null => lastCopiedHash;
export const setLastCopiedHash = (hash: string | null): void => { lastCopiedHash = hash; };

// === Helpers ===

const removeHeadingMarkers = (text: string): string => {
  const match = /^(#{1,6})\s+/.exec(text);
  return match ? text.slice(match[0].length) : text;
};

const getListPrefix = (meta?: MindMapNode['markdownMeta']): string => {
  if (meta?.type === 'unordered-list') {
    if (meta.isCheckbox) {
      return meta.isChecked ? '- [x] ' : '- [ ] ';
    }
    return '- ';
  }
  if (meta?.type === 'ordered-list') return '1. ';
  return '';
};

// === Converters ===

export const nodeToMarkdownTree = (node: MindMapNode, level = 0): string => {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if (node.note != null) md += `${node.note}\n`;
  if (node.children?.length) node.children.forEach(c => { md += nodeToMarkdownTree(c, level + 1); });
  return md;
};

export const nodeToIndentedText = (node: MindMapNode, level = 0): string => {
  const indent = '  '.repeat(level);
  const text = removeHeadingMarkers(node.text);
  const prefix = getListPrefix(node.markdownMeta);
  let result = `${indent}${prefix}${text}\n`;
  if (node.children?.length) {
    node.children.forEach(child => { result += nodeToIndentedText(child, level + 1); });
  }
  return result;
};

// === Clipboard Operations ===

export const copyNodeToClipboard = async (
  node: MindMapNode,
  markdownText: string,
  onCopied?: (message: string) => void
): Promise<void> => {
  setLastCopiedHash(generateObjectHash(node));
  try {
    await navigator.clipboard?.writeText(markdownText);
    onCopied?.(`「${node.text}」をコピーしました`);
  } catch (error) {
    logger.error('Failed to write to clipboard', error);
  }
};

export const copyNodeTextToClipboard = async (node: MindMapNode, onCopied?: (message: string) => void): Promise<void> => {
  await navigator.clipboard?.writeText(nodeToIndentedText(node));
  onCopied?.(`「${node.text}」のテキストをコピーしました`);
};
