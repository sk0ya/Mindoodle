/**
 * Node hashing utilities for memoization - refactored with functional patterns
 * Reduced from 133 lines to 90 lines (32% reduction)
 */

import type { MindMapNode } from '@shared/types';


const extractNodeMetadata = (node: MindMapNode): string => {
  const noteHash = (node.note || '').length;
  const kind = (node as MindMapNode & { kind?: string }).kind || 'text';
  const mm = (node as MindMapNode & { markdownMeta?: unknown }).markdownMeta as {
    type?: string;
    level?: number;
    indentLevel?: number;
    originalFormat?: string;
    isCheckbox?: boolean;
    isChecked?: boolean;
  } | undefined || {};

  return [
    node.id,
    node.text,
    noteHash,
    kind,
    mm.type || '',
    typeof mm.level === 'number' ? mm.level : -1,
    typeof mm.indentLevel === 'number' ? mm.indentLevel : -1,
    mm.originalFormat || '',
    mm.isCheckbox ? 1 : 0,
    mm.isCheckbox && mm.isChecked ? 1 : 0,
    node.children?.length || 0,
  ].join(':');
};

const hashNodeRecursive = (node: MindMapNode, parts: string[]) => {
  parts.push(extractNodeMetadata(node));
  node.children?.forEach(child => hashNodeRecursive(child, parts));
};


export const hashNodeTree = (nodes: MindMapNode[]): string => {
  const parts: string[] = [];
  nodes.forEach(node => hashNodeRecursive(node, parts));
  return parts.join('|');
};

export class MarkdownMemoizer {
  private lastHash = '';
  private cachedMarkdown = '';
  private hitCount = 0;
  private missCount = 0;

  convert(nodes: MindMapNode[], converter: (nodes: MindMapNode[]) => string): string {
    const currentHash = hashNodeTree(nodes);

    if (currentHash === this.lastHash && this.cachedMarkdown) {
      this.hitCount++;
      return this.cachedMarkdown;
    }

    this.missCount++;
    const markdown = converter(nodes);
    this.lastHash = currentHash;
    this.cachedMarkdown = markdown;
    return markdown;
  }

  invalidate(): void {
    this.lastHash = '';
    this.cachedMarkdown = '';
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total ? this.hitCount / total : 0
    };
  }

  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}
