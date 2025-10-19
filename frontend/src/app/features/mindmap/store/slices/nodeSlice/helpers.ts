import type { MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import type { NormalizedDataLike } from './types';

/**
 * Find the nearest non-table sibling's markdown metadata
 * Used for inheriting metadata when creating new nodes near table nodes
 */
export function nearestNonTableSiblingMeta(
  nd: NormalizedDataLike,
  siblings: string[],
  currentIdx: number
): Partial<MindMapNode['markdownMeta']> | undefined {
  const n = siblings.length;
  for (let offset = 1; offset < n; offset++) {
    const left = currentIdx - offset;
    const right = currentIdx + offset;
    if (left >= 0) {
      const sib = nd.nodes[siblings[left]];
      if (sib && sib.kind !== 'table' && sib.markdownMeta) {
        if (sib.markdownMeta.isCheckbox) {
          return { ...sib.markdownMeta, isChecked: false };
        }
        return sib.markdownMeta;
      }
    }
    if (right < n) {
      const sib = nd.nodes[siblings[right]];
      if (sib && sib.kind !== 'table' && sib.markdownMeta) {
        if (sib.markdownMeta.isCheckbox) {
          return { ...sib.markdownMeta, isChecked: false };
        }
        return sib.markdownMeta;
      }
    }
  }
  return undefined;
}

/**
 * Update checkbox state in tree structure (recursive)
 */
export function updateNodeCheckedInTree(
  nodes: MindMapNode[],
  nodeId: string,
  checked: boolean
): MindMapNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      if (node.markdownMeta?.isCheckbox) {
        return { ...node, markdownMeta: { ...node.markdownMeta, isChecked: checked } } as MindMapNode;
      }
      return node;
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateNodeCheckedInTree(node.children, nodeId, checked) } as MindMapNode;
    }
    return node;
  });
}

/**
 * Create a new node with default properties
 */
export function createNewNode(
  text: string,
  parentNode?: MindMapNode,
  settings?: { fontSize?: number; addBlankLineAfterHeading?: boolean },
  addBlankLine: boolean = false
): MindMapNode {
  const newNode: MindMapNode = {
    id: generateNodeId(),
    text,
    x: 0,
    y: 0,
    children: [],
    fontSize: 14,
    fontWeight: 'normal',
    lineEnding: parentNode?.lineEnding || LineEndingUtils.LINE_ENDINGS.LF
  };

  // Add blank line note after heading if configured
  if (addBlankLine && parentNode?.markdownMeta?.type === 'heading' && settings?.addBlankLineAfterHeading !== false) {
    newNode.note = '';
  }

  return newNode;
}
