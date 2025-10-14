import type { MindMapNode } from '@shared/types';

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
  const headingRegex = /^(#+)\s+(.*)$/;
  const headingMatch = headingRegex.exec(text);
  if (headingMatch) {
    text = headingMatch[2] || text;
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
  await (navigator.clipboard?.writeText?.(markdownText) ?? Promise.resolve());
  onCopied?.(`「${node.text}」をコピーしました`);
}

export async function copyNodeTextToClipboard(node: MindMapNode, onCopied?: (message: string) => void): Promise<void> {
  const textContent = nodeToIndentedText(node);
  await (navigator.clipboard?.writeText?.(textContent) ?? Promise.resolve());
  onCopied?.(`「${node.text}」のテキストをコピーしました`);
}
