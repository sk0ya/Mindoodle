/**
 * MarkdownConversionService
 *
 * Service for markdown-related node conversions and structural analysis.
 * Extracted from useMindMap.ts to separate business logic from React hooks.
 */

import type { MindMapNode } from '@shared/types';

type FlatItem = {
  id?: string;
  text: string;
  note?: string;
  t?: string;
  lvl?: number;
  ind?: number;
  k?: string;
};

export class MarkdownConversionService {
  /**
   * Flatten node tree into flat array for structural comparison
   */
  static flattenNodes(nodes: MindMapNode[]): FlatItem[] {
    return (nodes || []).flatMap(n => [
      {
        id: n?.id,
        text: String(n?.text ?? ''),
        note: n?.note,
        t: n?.markdownMeta?.type,
        lvl: typeof n?.markdownMeta?.level === 'number' ? n.markdownMeta.level : undefined,
        ind: typeof n?.markdownMeta?.indentLevel === 'number' ? n.markdownMeta.indentLevel : undefined,
        k: typeof n?.kind === 'string' ? n.kind : undefined,
      },
      ...this.flattenNodes(n?.children || [])
    ]);
  }

  /**
   * Check if two flattened node structures match (ignoring content changes)
   */
  static checkStructureMatch(prev: FlatItem[], next: FlatItem[]): boolean {
    if (prev.length !== next.length) return false;

    return prev.every((a, i) => {
      const b = next[i];
      if (a.t !== b.t || a.lvl !== b.lvl || a.k !== b.k) return false;

      if (a.t === 'unordered-list' || a.t === 'ordered-list') {
        const ia = typeof a.ind === 'number' ? a.ind : 0;
        const ib = typeof b.ind === 'number' ? b.ind : 0;
        if (ia !== ib) return false;
      }

      return true;
    });
  }

  /**
   * Build bidirectional mapping between markdown line numbers and node IDs
   */
  static buildLineMapping(roots: MindMapNode[]): {
    lineToNode: Record<number, string>;
    nodeToLine: Record<string, number>;
  } {
    const lineToNode: Record<number, string> = {};
    const nodeToLine: Record<string, number> = {};

    const walk = (nodes: MindMapNode[]) => {
      for (const n of nodes || []) {
        const ln = n?.markdownMeta?.lineNumber;
        if (typeof ln === 'number' && ln >= 0 && typeof n?.id === 'string') {
          const line1 = ln + 1;
          lineToNode[line1] = n.id;
          nodeToLine[n.id] = line1;
        }
        if (n?.children?.length) walk(n.children);
      }
    };

    walk(roots);
    return { lineToNode, nodeToLine };
  }

  /**
   * Get node ID by markdown line number (with fallback to nearest previous line)
   */
  static getNodeIdByLine(lineToNodeMap: Record<number, string>, line: number): string | null {
    if (lineToNodeMap[line]) return lineToNodeMap[line];

    let bestLine = 0;
    for (const k of Object.keys(lineToNodeMap)) {
      const ln = parseInt(k, 10);
      if (ln <= line && ln > bestLine) bestLine = ln;
    }

    return bestLine ? lineToNodeMap[bestLine] : null;
  }
}
