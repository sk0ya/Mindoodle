/**
 * Node factory utilities for creating MindMapNode instances
 */

import type { MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';

/**
 * Default node properties
 */
const DEFAULT_NODE_PROPS = {
  x: 0,
  y: 300,
  fontSize: 14,
  fontWeight: 'normal' as const,
  lineEnding: '\n'
};

/**
 * Create a new MindMapNode with default properties
 */
export function createNode(
  text: string,
  options?: {
    isRoot?: boolean;
    lineEnding?: string;
    x?: number;
    y?: number;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    note?: string;
  }
): MindMapNode {
  return {
    id: generateNodeId(),
    text,
    x: options?.x ?? DEFAULT_NODE_PROPS.x,
    y: options?.y ?? DEFAULT_NODE_PROPS.y,
    children: [],
    fontSize: options?.fontSize ?? DEFAULT_NODE_PROPS.fontSize,
    fontWeight: options?.fontWeight ?? DEFAULT_NODE_PROPS.fontWeight,
    note: options?.note,
    lineEnding: options?.lineEnding ?? DEFAULT_NODE_PROPS.lineEnding
  };
}

/**
 * Create a root node
 */
export function createRootNode(text: string, lineEnding?: string): MindMapNode {
  return createNode(text, { isRoot: true, lineEnding });
}

/**
 * Create a child node
 */
export function createChildNode(
  text: string,
  parent: MindMapNode,
  options?: {
    note?: string;
    fontSize?: number;
  }
): MindMapNode {
  return createNode(text, {
    lineEnding: parent.lineEnding,
    fontSize: options?.fontSize,
    note: options?.note
  });
}

/**
 * Clone a node with new properties
 */
export function cloneNode(
  node: MindMapNode,
  overrides?: Partial<MindMapNode>
): MindMapNode {
  return {
    ...node,
    ...overrides,
    id: overrides?.id ?? generateNodeId()
  };
}

/**
 * Create multiple nodes from text array
 */
export function createNodesFromTexts(
  texts: string[],
  options?: {
    lineEnding?: string;
    startX?: number;
    startY?: number;
    verticalSpacing?: number;
  }
): MindMapNode[] {
  const spacing = options?.verticalSpacing ?? 80;
  const startY = options?.startY ?? DEFAULT_NODE_PROPS.y;

  return texts.map((text, index) =>
    createNode(text, {
      lineEnding: options?.lineEnding,
      x: options?.startX,
      y: startY + index * spacing
    })
  );
}
