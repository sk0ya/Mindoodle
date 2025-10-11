import type { MindMapNode } from '@shared/types';

export function selectNodeIdByMarkdownLine(rootNodes: MindMapNode[], line: number): string | null {
  const stack = [...rootNodes];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.markdownMeta?.lineNumber === line) return n.id;
    if (n.children?.length) stack.push(...n.children);
  }
  return null;
}

export function findParentNode(rootNodes: MindMapNode[], targetId: string): MindMapNode | null {
  const dfs = (node: MindMapNode, parent: MindMapNode | null): MindMapNode | null => {
    if (node.id === targetId) return parent;
    for (const c of node.children || []) {
      const p = dfs(c, node);
      if (p) return p;
    }
    return null;
  };
  for (const root of rootNodes) {
    const res = dfs(root, null);
    if (res) return res;
  }
  return null;
}

export function getSiblingNodes(root: MindMapNode, targetId: string): { siblings: MindMapNode[]; currentIndex: number } {
  const parent = findParentNode([root], targetId);
  const siblings = parent?.children || [root];
  const currentIndex = siblings.findIndex(n => n.id === targetId);
  return { siblings, currentIndex };
}

export function flattenVisibleNodes(root: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [];
  const stack: MindMapNode[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node);
    if (!node.collapsed && node.children?.length) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
    }
  }
  return result;
}
