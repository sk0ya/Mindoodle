import type { MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';

// Helper functions for node creation and positioning
const createNewNode = (text: string): MindMapNode => ({
  id: generateNodeId(),
  text,
  x: 0,
  y: 0,
  children: [],
  fontSize: 14,
  fontWeight: 'normal'
});

const calculateNodePosition = (parentX: number, parentY: number, childIndex: number): { x: number; y: number } => ({
  x: parentX + 250,
  y: parentY + (childIndex * 100)
});

function clonePreservingLayout(target: MindMapNode, source: MindMapNode): MindMapNode {
  return {
    id: source.id,
    text: target.text,
    x: source.x,
    y: source.y,
    children: [], // set later via recursion
    // preserve visual/functional fields
    fontSize: source.fontSize,
    fontFamily: source.fontFamily,
    fontWeight: source.fontWeight,
    fontStyle: source.fontStyle,
    color: source.color,
    collapsed: source.collapsed,
    links: source.links,
    customImageWidth: source.customImageWidth,
    customImageHeight: source.customImageHeight,
    note: source.note,
    // update markdown meta from parsed target
    markdownMeta: target.markdownMeta
  };
}

export function mergeNodesPreservingLayout(existing: MindMapNode[], parsed: MindMapNode[], parent: MindMapNode | null = null): MindMapNode[] {
  const result: MindMapNode[] = [];
  const usedExisting = new Set<number>();

  // Build map from text to indexes for quick match; many nodes may share text, so keep multi-index
  const textIndex = new Map<string, number[]>();
  existing.forEach((n, i) => {
    const list = textIndex.get(n.text) || [];
    list.push(i);
    textIndex.set(n.text, list);
  });

  const claimExistingByIndex = (idx: number): MindMapNode | null => {
    if (idx < 0 || idx >= existing.length) return null;
    if (usedExisting.has(idx)) return null;
    usedExisting.add(idx);
    return existing[idx];
  };

  const claimExistingByText = (text: string): { node: MindMapNode; index: number } | null => {
    const list = textIndex.get(text);
    if (!list || list.length === 0) return null;
    // find first unmatched index
    for (let k = 0; k < list.length; k++) {
      const idx = list[k];
      if (!usedExisting.has(idx)) {
        usedExisting.add(idx);
        return { node: existing[idx], index: idx };
      }
    }
    return null;
  };

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];

    // 1) try exact text match first
    const byText = claimExistingByText(p.text);
    let matched: MindMapNode | null = null;
    if (byText) {
      matched = byText.node;
    } else {
      // 2) fall back to same index
      matched = claimExistingByIndex(i);
    }

    if (matched) {
      const merged = clonePreservingLayout(p, matched);
      merged.children = mergeNodesPreservingLayout(matched.children || [], p.children || [], merged);
      result.push(merged);
    } else {
      // New node: create preserving relative layout to parent
      const base = createNewNode(p.text);
      // place new child at reasonable position relative to parent and sibling index
      if (parent) {
        const pos = calculateNodePosition(parent.x, parent.y, i);
        base.x = pos.x; base.y = pos.y;
      }
      base.markdownMeta = p.markdownMeta;
      base.children = mergeNodesPreservingLayout([], p.children || [], base);
      result.push(base);
    }
  }

  // Deletions: any existing not matched are dropped (no need to carry over)
  return result;
}

