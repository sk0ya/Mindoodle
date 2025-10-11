import type { MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';


const createNewNode = (text: string, parentLineEnding?: string): MindMapNode => ({
  id: generateNodeId(),
  text,
  x: 0,
  y: 0,
  children: [],
  fontSize: 14,
  fontWeight: 'normal',
  lineEnding: parentLineEnding || '\n'
});


const calculateNodePosition = (parentX: number, parentY: number, childIndex: number): { x: number; y: number } => ({
  x: parentX + 28,
  y: parentY + (childIndex * 28)
});

function createMergedNode(parsed: MindMapNode, matched: MindMapNode): MindMapNode {
  const merged = clonePreservingLayout(parsed, matched);
  merged.children = mergeNodesPreservingLayout(matched.children || [], parsed.children || [], merged);
  return merged;
}

function createNewNodeFromParsed(parsed: MindMapNode, parent: MindMapNode | null, index: number): MindMapNode {
  const base = createNewNode(parsed.text);

  if (parent) {
    const pos = calculateNodePosition(parent.x, parent.y, index);
    base.x = pos.x;
    base.y = pos.y;
  }
  base.markdownMeta = parsed.markdownMeta;

  // Type guard: Copy extended properties if present
  const pExt = parsed as unknown as { kind?: string; tableData?: unknown };
  const baseExt = base as unknown as { kind?: string; tableData?: unknown };
  if (pExt.kind) baseExt.kind = pExt.kind;
  if (pExt.tableData) baseExt.tableData = pExt.tableData;
  base.children = mergeNodesPreservingLayout([], parsed.children || [], base);
  return base;
}

function clonePreservingLayout(target: MindMapNode, source: MindMapNode): MindMapNode {
  // Type guard: Extract extended properties (kind, tableData) not in base type
  const targetExt = target as unknown as { kind?: string; tableData?: unknown };
  const sourceExt = source as unknown as { kind?: string; tableData?: unknown };
  const kind = targetExt.kind ?? sourceExt.kind;
  const tableData = targetExt.tableData ?? sourceExt.tableData;

  const cloned: Record<string, unknown> = {
    id: source.id,
    text: target.text,
    x: source.x,
    y: source.y,
    children: [], 
    
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
    
    markdownMeta: target.markdownMeta
  };
  if (kind) cloned.kind = kind;
  if (tableData) cloned.tableData = tableData;
  // Type: Convert cloned object with extended properties back to MindMapNode
  return cloned as unknown as MindMapNode;
}

export function mergeNodesPreservingLayout(existing: MindMapNode[], parsed: MindMapNode[], parent: MindMapNode | null = null): MindMapNode[] {
  const result: MindMapNode[] = [];
  const usedExisting = new Set<number>();

  
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


    const byText = claimExistingByText(p.text);
    const matched = byText ? byText.node : claimExistingByIndex(i);

    if (matched) {
      result.push(createMergedNode(p, matched));
    } else {
      result.push(createNewNodeFromParsed(p, parent, i));
    }
  }

  
  return result;
}
