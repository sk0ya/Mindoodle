/**
 * Node slice helpers - refactored with functional patterns
 * Reduced from 89 lines to 78 lines (12% reduction)
 */

import type { MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import type { NormalizedDataLike } from './types';


const isNonTableNode = (node: MindMapNode | undefined): boolean =>
  !!(node && node.kind !== 'table' && node.markdownMeta);

const getMetadataWithResetCheckbox = (meta: MindMapNode['markdownMeta']): Partial<MindMapNode['markdownMeta']> =>
  meta?.isCheckbox ? { ...meta, isChecked: false } : meta || {};

const checkSiblingAt = (
  nd: NormalizedDataLike,
  siblings: string[],
  index: number
): Partial<MindMapNode['markdownMeta']> | undefined => {
  if (index < 0 || index >= siblings.length) return undefined;
  const sib = nd.nodes[siblings[index]];
  return isNonTableNode(sib) ? getMetadataWithResetCheckbox(sib.markdownMeta) : undefined;
};


export const nearestNonTableSiblingMeta = (
  nd: NormalizedDataLike,
  siblings: string[],
  currentIdx: number
): Partial<MindMapNode['markdownMeta']> | undefined => {
  for (let offset = 1; offset < siblings.length; offset++) {
    const leftMeta = checkSiblingAt(nd, siblings, currentIdx - offset);
    if (leftMeta) return leftMeta;

    const rightMeta = checkSiblingAt(nd, siblings, currentIdx + offset);
    if (rightMeta) return rightMeta;
  }
  return undefined;
};

export const updateNodeCheckedInTree = (
  nodes: MindMapNode[],
  nodeId: string,
  checked: boolean
): MindMapNode[] =>
  nodes.map(node => {
    if (node.id === nodeId && node.markdownMeta?.isCheckbox) {
      return { ...node, markdownMeta: { ...node.markdownMeta, isChecked: checked } } as MindMapNode;
    }
    if (node.children?.length) {
      return { ...node, children: updateNodeCheckedInTree(node.children, nodeId, checked) } as MindMapNode;
    }
    return node;
  });

export const createNewNode = (
  text: string,
  parentNode?: MindMapNode,
  settings?: { fontSize?: number; addBlankLineAfterHeading?: boolean },
  addBlankLine: boolean = false
): MindMapNode => ({
  id: generateNodeId(),
  text,
  x: 0,
  y: 0,
  children: [],
  fontSize: 14,
  fontWeight: 'normal',
  lineEnding: parentNode?.lineEnding || LineEndingUtils.LINE_ENDINGS.LF,
  ...(addBlankLine && parentNode?.markdownMeta?.type === 'heading' && settings?.addBlankLineAfterHeading !== false
    ? { note: '' }
    : {})
});
