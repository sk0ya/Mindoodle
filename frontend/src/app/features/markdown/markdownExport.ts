import type { MindMapNode } from '@shared/types';

export function nodeToMarkdown(node: MindMapNode, level = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list'): string {
  const nodeType = node.markdownMeta?.type;
  const indentLevel = node.markdownMeta?.indentLevel ?? 0;

  let prefix = '';
  let md = '';

  // Determine the appropriate prefix based on node type
  if (nodeType === 'unordered-list' || nodeType === 'ordered-list') {
    // For list items, calculate indent based on actual indentLevel
    // If parent is heading, start list items from level 0 (no indent)
    const actualIndent = parentType === 'heading' ? 0 : indentLevel;
    const indentSpaces = '  '.repeat(actualIndent);

    if (nodeType === 'unordered-list') {
      prefix = `${indentSpaces}- `;
    } else {
      prefix = `${indentSpaces}1. `;
    }
  } else {
    // For heading nodes or nodes without type, use heading format
    prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  }

  md = `${prefix}${node.text}`;

  // Add note if present; do not trim to preserve intentional spaces
  if (node.note != null && node.note !== '') {
    md += `\n${node.note}`;
  }

  // Add children with proper line breaks
  if (node.children && node.children.length > 0) {
    md += '\n';
    node.children.forEach((child: MindMapNode) => {
      const childLevel = nodeType === 'unordered-list' || nodeType === 'ordered-list' ? level : level + 1;
      md += nodeToMarkdown(child, childLevel, nodeType);
    });
  }

  // Only add final newline if this is not a leaf node or if we have notes
  if ((node.children && node.children.length > 0) || (node.note != null && node.note !== '')) {
    md += '\n';
  }

  return md;
}
