import type { MindMapNode } from '@shared/types';
import { generateObjectHash } from '@shared/utils';

/**
 * Custom MIME type for Mindoodle clipboard data with hash
 */
export const MINDOODLE_CLIPBOARD_MIME_TYPE = 'application/x-mindoodle-hash';

export function nodeToMarkdownTree(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if (node.note != null) md += `${node.note}\n`;
  if (node.children?.length) node.children.forEach(c => { md += nodeToMarkdownTree(c, level + 1); });
  return md;
}

export function nodeToIndentedText(node: MindMapNode, level = 0): string {
  const indent = '  '.repeat(level);

  let text = node.text;

  // Remove heading markers (# ## ###)
  const headingRegex = /^(#{1,6})\s+/;
  const headingMatch = headingRegex.exec(text);
  if (headingMatch) {
    text = text.slice(headingMatch[0].length);
  }

  // Add list markers based on markdownMeta.type
  let prefix = '';
  if (node.markdownMeta?.type === 'unordered-list') {
    if (node.markdownMeta.isCheckbox) {
      prefix = node.markdownMeta.isChecked ? '- [x] ' : '- [ ] ';
    } else {
      prefix = '- ';
    }
  } else if (node.markdownMeta?.type === 'ordered-list') {
    prefix = '1. ';
  }

  let result = `${indent}${prefix}${text}\n`;

  if (node.children?.length) {
    node.children.forEach(child => {
      result += nodeToIndentedText(child, level + 1);
    });
  }

  return result;
}

export async function copyNodeToClipboard(node: MindMapNode, onCopied?: (message: string) => void): Promise<void> {
  const markdownText = nodeToMarkdownTree(node);
  const nodeHash = generateObjectHash(node);

  try {
    // Modern Clipboard API with multiple formats
    if (navigator.clipboard && 'write' in navigator.clipboard) {
      const textBlob = new Blob([markdownText], { type: 'text/plain' });
      const hashBlob = new Blob([nodeHash], { type: MINDOODLE_CLIPBOARD_MIME_TYPE });

      const clipboardItem = new ClipboardItem({
        'text/plain': textBlob,
        [MINDOODLE_CLIPBOARD_MIME_TYPE]: hashBlob,
      });

      await navigator.clipboard.write([clipboardItem]);
      onCopied?.(`「${node.text}」をコピーしました`);
      return;
    }
  } catch (error) {
    console.warn('Failed to write custom clipboard format, falling back to text-only', error);
  }

  // Fallback to simple text-only clipboard
  try {
    if (navigator.clipboard && 'writeText' in navigator.clipboard) {
      await navigator.clipboard.writeText(markdownText);
      onCopied?.(`「${node.text}」をコピーしました`);
    }
  } catch (error) {
    console.error('Failed to write to clipboard', error);
  }
}

export async function copyNodeTextToClipboard(node: MindMapNode, onCopied?: (message: string) => void): Promise<void> {
  const textContent = nodeToIndentedText(node);
  await (navigator.clipboard?.writeText?.(textContent) ?? Promise.resolve());
  onCopied?.(`「${node.text}」のテキストをコピーしました`);
}
