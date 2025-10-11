import type { MindMapNode } from '@shared/types';

export function nodeToMarkdown(node: MindMapNode, level = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list' | 'preface'): string {
  const nodeType = node.markdownMeta?.type;
  const indentLevel = node.markdownMeta?.indentLevel ?? 0;

  
  const lineEnding = node.lineEnding || '\n';

  let prefix = '';
  let md = '';

  // Special handling: table node renders as a markdown table block
  // Type guard: Check for extended 'kind' property
  if ('kind' in node && (node as unknown as { kind: string }).kind === 'table') {
    
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
    
    const actualIndent = node.markdownMeta?.indentLevel ??
                        (parentType === 'heading' ? 0 : indentLevel);
    const indentSpaces = ' '.repeat(actualIndent);

    if (nodeType === 'unordered-list') {
      
      const marker = node.markdownMeta?.originalFormat || '-';

      
      if (node.markdownMeta?.isCheckbox) {
        const checkMark = node.markdownMeta.isChecked ? 'x' : ' ';
        prefix = `${indentSpaces}${marker} [${checkMark}] `;
      } else {
        prefix = `${indentSpaces}${marker} `;
      }
    } else {
      
      const marker = node.markdownMeta?.originalFormat || '1.';
      prefix = `${indentSpaces}${marker} `;
    }
  } else if (nodeType === 'heading') {
    
    const headingLevel = node.markdownMeta?.level || (level + 1);
    prefix = '#'.repeat(Math.min(headingLevel, 6)) + ' ';
  } else if (nodeType === 'preface') {
    // preface はプレフィックス無し
  } else {
    // メタなしノードはプレーンテキスト（プレフィックス無し）
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

  
  if ((node.children && node.children.length > 0) || (node.note != null)) {
    md += lineEnding;
  }

  return md;
}
