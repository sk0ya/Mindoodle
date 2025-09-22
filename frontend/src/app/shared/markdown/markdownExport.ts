import type { MindMapNode } from '../types/dataTypes';

export function nodeToMarkdown(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}`;

  // Add note if present; do not trim to preserve intentional spaces
  if (node.note != null && node.note !== '') {
    md += `\n${node.note}`;
  }

  // Add children with proper line breaks
  if (node.children && node.children.length > 0) {
    md += '\n';
    node.children.forEach(child => {
      md += nodeToMarkdown(child, level + 1);
    });
  }

  // Only add final newline if this is not a leaf node or if we have notes
  if ((node.children && node.children.length > 0) || (node.note != null && node.note !== '')) {
    md += '\n';
  }

  return md;
}
