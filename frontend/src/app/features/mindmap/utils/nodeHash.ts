/**
 * Node hashing utilities for memoization
 * Provides fast structural hash for detecting node changes
 */

import type { MindMapNode } from '@shared/types';

/**
 * Generates a fast structural hash of node tree
 * Only considers: id, text, note, children structure
 * Ignores: position, UI state, metadata
 */
export function hashNodeTree(nodes: MindMapNode[]): string {
  const parts: string[] = [];

  const hashNode = (node: MindMapNode) => {
    // Hash format: "id:text:note:childCount"
    const noteHash = (node.note || '').length; // Just length for performance
    parts.push(`${node.id}:${node.text}:${noteHash}:${node.children?.length || 0}`);

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
