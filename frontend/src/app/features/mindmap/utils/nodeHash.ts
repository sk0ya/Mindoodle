/**
 * Node hashing utilities for memoization
 * Provides fast structural hash for detecting node changes
 */

import type { MindMapNode } from '@shared/types';

/**
 * Generates a fast structural hash of node tree
 * Includes fields that affect Markdown conversion to ensure stream updates
 * when structure/format changes (e.g., heading level, list type/indent, checkboxes, kind).
 * Still ignores visual-only state (position, collapse, etc.).
 */
export function hashNodeTree(nodes: MindMapNode[]): string {
  const parts: string[] = [];

  const hashNode = (node: MindMapNode) => {
    // Hash fields relevant to markdown output
    const noteHash = (node.note || '').length; // length is sufficient to reflect note presence/changes
    const kind = (node as MindMapNode & { kind?: string }).kind || 'text';
    const mm = (node as MindMapNode & { markdownMeta?: {
      type?: string;
      level?: number;
      indentLevel?: number;
      originalFormat?: string;
      isCheckbox?: boolean;
      isChecked?: boolean;
    }}).markdownMeta || {};

    const metaType = mm.type || '';
    const metaLevel = typeof mm.level === 'number' ? mm.level : -1;
    const metaIndent = typeof mm.indentLevel === 'number' ? mm.indentLevel : -1;
    const metaFmt = mm.originalFormat || '';
    const metaCb = mm.isCheckbox ? 1 : 0;
    // Extract nested ternary to separate statement
    let metaChecked = 0;
    if (mm.isCheckbox) {
      metaChecked = mm.isChecked ? 1 : 0;
    }

    // Hash format captures order as we traverse children in-order
    parts.push([
      node.id,
      node.text,
      noteHash,
      kind,
      metaType,
      metaLevel,
      metaIndent,
      metaFmt,
      metaCb,
      metaChecked,
      node.children?.length || 0,
    ].join(':'));

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        hashNode(child);
      }
    }
  };

  for (const node of nodes) {
    hashNode(node);
  }

  // Simple string join - fast and collision-resistant for our use case
  return parts.join('|');
}

/**
 * Memoized markdown converter with hash-based cache invalidation
 */
export class MarkdownMemoizer {
  private lastHash: string = '';
  private cachedMarkdown: string = '';
  private hitCount: number = 0;
  private missCount: number = 0;

  /**
   * Convert nodes to markdown with memoization
   * @param nodes Root nodes to convert
   * @param converter Conversion function
   * @returns Markdown string (cached if structure unchanged)
   */
  convert(
    nodes: MindMapNode[],
    converter: (nodes: MindMapNode[]) => string
  ): string {
    const currentHash = hashNodeTree(nodes);

    // Cache hit: structure unchanged
    if (currentHash === this.lastHash && this.cachedMarkdown) {
      this.hitCount++;
      return this.cachedMarkdown;
    }

    // Cache miss: convert and update cache
    this.missCount++;
    const markdown = converter(nodes);
    this.lastHash = currentHash;
    this.cachedMarkdown = markdown;

    return markdown;
  }

  /**
   * Force cache invalidation
   */
  invalidate(): void {
    this.lastHash = '';
    this.cachedMarkdown = '';
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getStats() {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}
