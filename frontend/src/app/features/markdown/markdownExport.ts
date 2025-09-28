import type { MindMapNode } from '@shared/types';

export function nodeToMarkdown(node: MindMapNode, level = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list' | 'preface'): string {
  const nodeType = node.markdownMeta?.type;
  const indentLevel = node.markdownMeta?.indentLevel ?? 0;

  // Use the node's line ending preference, or default to LF
  const lineEnding = node.lineEnding || '\n';

  let prefix = '';
  let md = '';

  // Special handling: table node renders as a markdown table block
  if ((node as any).kind === 'table') {
    // For table nodes, the canonical source is node.text (markdown table)
    md = node.text || '';
    // Append note if present (exactly as saved, including empty lines)
    if (node.note != null) {
      md += `${lineEnding}${node.note}`;
    }
    // Children (unlikely) — no extra blank lines injected
    if (node.children && node.children.length > 0) {
      md += lineEnding;
      node.children.forEach((child: MindMapNode) => {
        md += nodeToMarkdown(child, level + 1, nodeType);
      });
    }
    return md;
  }

  // Determine the appropriate prefix based on node type (メタがある場合のみ)
  if (nodeType === 'unordered-list' || nodeType === 'ordered-list') {
    // Use original indent level if available, otherwise calculate
    const actualIndent = node.markdownMeta?.indentLevel ??
                        (parentType === 'heading' ? 0 : indentLevel);
    const indentSpaces = ' '.repeat(actualIndent);

    if (nodeType === 'unordered-list') {
      // Use original marker if available, otherwise default to '-'
      const marker = node.markdownMeta?.originalFormat || '-';

      // チェックボックス処理
      if (node.markdownMeta?.isCheckbox) {
        const checkMark = node.markdownMeta.isChecked ? 'x' : ' ';
        prefix = `${indentSpaces}${marker} [${checkMark}] `;
      } else {
        prefix = `${indentSpaces}${marker} `;
      }
    } else {
      // Use original number format if available, otherwise default to '1.'
      const marker = node.markdownMeta?.originalFormat || '1.';
      prefix = `${indentSpaces}${marker} `;
    }
  } else if (nodeType === 'heading') {
    // Use original heading level if available, otherwise calculate
    const headingLevel = node.markdownMeta?.level || (level + 1);
    prefix = '#'.repeat(Math.min(headingLevel, 6)) + ' ';
  } else if (nodeType === 'preface') {
    // For preface nodes, no prefix
    prefix = '';
  } else {
    // メタなしノードはプレーンテキスト
    prefix = '';
  }

  md = `${prefix}${node.text}`;

  // Add note if present; do not trim to preserve intentional spaces (including empty lines)
  if (node.note != null) {
    md += `${lineEnding}${node.note}`;
  }

  // Add children with proper line breaks (do not inject extra blank lines)
  if (node.children && node.children.length > 0) {
    md += lineEnding;
    node.children.forEach((child: MindMapNode) => {
      const childLevel = nodeType === 'unordered-list' || nodeType === 'ordered-list' ? level : level + 1;
      md += nodeToMarkdown(child, childLevel, nodeType);
    });
  }

  // Only add final newline if this is not a leaf node or if we have notes
  if ((node.children && node.children.length > 0) || (node.note != null)) {
    md += lineEnding;
  }

  return md;
}
