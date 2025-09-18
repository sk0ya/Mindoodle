import type { MindMapNode } from '../types/dataTypes';

export function nodeToMarkdown(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if ((node.note || '').trim()) md += `${node.note}\n`;
  (node.children || []).forEach(child => { md += nodeToMarkdown(child, level + 1); });
  return md;
}

