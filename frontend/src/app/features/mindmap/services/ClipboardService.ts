import type { MindMapNode } from '@shared/types';

export function nodeToMarkdownTree(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if (node.note !== null) md += `${node.note}\n`;
  if (node.children?.length) node.children.forEach(c => { md += nodeToMarkdownTree(c, level + 1); });
  return md;
}

export async function copyNodeToClipboard(node: MindMapNode, onCopied?: (message: string) => void): Promise<void> {
  const markdownText = nodeToMarkdownTree(node);
  await (navigator.clipboard?.writeText?.(markdownText) ?? Promise.resolve());
  onCopied?.(`「${node.text}」をコピーしました`);
}

