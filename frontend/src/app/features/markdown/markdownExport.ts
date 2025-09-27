import type { MindMapNode } from '@shared/types';

export function nodeToMarkdown(node: MindMapNode, level = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list' | 'preface'): string {
  const nodeType = node.markdownMeta?.type;
  const indentLevel = node.markdownMeta?.indentLevel ?? 0;

  let prefix = '';
  let md = '';

  // Special handling: table node renders as a markdown table block
  if ((node as any).kind === 'table') {
    // For table nodes, the canonical source is node.text (markdown table)
    md = node.text || '';
    // Append note if present (exactly as saved)
    if (node.note != null && node.note !== '') {
      md += `\n${node.note}`;
    }
    // Children (unlikely) — no extra blank lines injected
    if (node.children && node.children.length > 0) {
      md += '\n';
      node.children.forEach((child: MindMapNode) => {
        md += nodeToMarkdown(child, level + 1, nodeType);
      });
    }
    return md;
  }

  // Determine the appropriate prefix based on node type (メタがある場合のみ)
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
  } else if (nodeType === 'heading') {
    // For heading nodes, use heading format
    prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  } else if (nodeType === 'preface') {
    // For preface nodes, no prefix
    prefix = '';
  } else {
    // メタなしノードはプレーンテキスト
    prefix = '';
  }

  md = `${prefix}${node.text}`;

  // Add note if present; do not trim to preserve intentional spaces
  if (node.note != null && node.note !== '') {
    md += `\n${node.note}`;
  }

  // Add children with proper line breaks (do not inject extra blank lines)
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
