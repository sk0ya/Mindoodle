import type { MindMapNode } from '@shared/types';

export function selectNodeIdByMarkdownLine(rootNodes: MindMapNode[], line: number): string | null {
  const stack = [...rootNodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.markdownMeta?.lineNumber === line) return n.id;
    if (n.children?.length) stack.push(...n.children);
  }
  return null;
}

