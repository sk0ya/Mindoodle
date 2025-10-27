import { type MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import { createNode } from './utils/nodeFactory';
import { extractFirstTable } from './utils/tableExtractor';

const DEBUG_MD = false;

interface StructureElement {
  type: 'heading' | 'unordered-list' | 'ordered-list' | 'preface';
  level: number;
  text: string;
  content?: string;
  originalFormat: string;
  indentLevel?: number;
  lineNumber: number;
  isCheckbox?: boolean;
  isChecked?: boolean;
}

// Parsing utilities
const parseHeading = (line: string): { level: number; text: string } | null => {
  if (!line.startsWith('#')) return null;
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  return match ? { level: match[1].length, text: match[2] } : null;
};

const parseListItem = (line: string) => {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
  if (!match) return null;

  const [, indent, marker, text] = match;
  const indentLevel = indent.length;
  const level = Math.floor(indentLevel / 2) + 1;
  const type = marker.endsWith('.') ? 'ordered-list' : 'unordered-list';

  const checkboxMatch = text.match(/^\[([ xX])\]\s+(.+)$/);
  if (checkboxMatch) {
    const [, check, content] = checkboxMatch;
    return { type, level, text: content, marker, indentLevel, isCheckbox: true, isChecked: check.toLowerCase() === 'x' };
  }

  return { type, level, text, marker, indentLevel, isCheckbox: false };
};

// Tree manipulation utilities
const findNodeInTree = <T extends { id: string; children?: T[] }>(
  nodes: T[],
  predicate: (node: T) => boolean,
  parent?: T
): { node: T; parent?: T; siblings: T[] } | null => {
  for (const node of nodes) {
    if (predicate(node)) return { node, parent, siblings: nodes };
    if (node.children) {
      const found = findNodeInTree(node.children, predicate, node);
      if (found) return found;
    }
  }
  return null;
};

const updateNodeInTree = <T extends { id: string; children?: T[] }>(
  nodes: T[],
  predicate: (node: T) => boolean,
  transform: (node: T, parent?: T) => T,
  parent?: T
): T[] => nodes.map(node => {
  if (predicate(node)) return transform(node, parent);
  return node.children
    ? { ...node, children: updateNodeInTree(node.children, predicate, transform, node) }
    : node;
});

export class MarkdownImporter {
  static parseMarkdownToNodes(
    markdownText: string,
    options?: {
      startX?: number;
      startY?: number;
      horizontalSpacing?: number;
      verticalSpacing?: number;
      defaultCollapseDepth?: number;
    }
  ): { rootNodes: MindMapNode[]; headingLevelByText: Record<string, number> } {
    DEBUG_MD && logger.debug('🔍 マークダウンパース開始', {
      textLength: markdownText.length,
      firstLine: markdownText.split(/\r\n|\r|\n/)[0],
    });

    const detectedLineEnding = LineEndingUtils.detectLineEnding(markdownText);
    const lines = markdownText.split(/\r\n|\r|\n/);
    const elements = this.extractStructureElements(lines, detectedLineEnding);

    if (elements.length === 0) {
      throw new Error('構造要素が見つかりません。マークダウンファイルには少なくとも1つの見出しまたはリストが必要です。');
    }

    const headingLevelByText = elements
      .filter((e): e is StructureElement => e.type === 'heading')
      .reduce((acc, e) => ({ ...acc, [e.text]: e.level }), {} as Record<string, number>);

    const rootNodes = this.buildNodeHierarchy(elements, detectedLineEnding, options?.defaultCollapseDepth);
    this.adjustNodePositions(rootNodes, options || {});

    DEBUG_MD && logger.debug('🏗️ ノード構築結果', {
      rootCount: rootNodes.length,
      roots: rootNodes.map(r => ({ text: r.text, childrenCount: r.children?.length || 0, position: { x: r.x, y: r.y } })),
    });

    return { rootNodes, headingLevelByText };
  }

  private static findNodeWithContext(
    nodeList: MindMapNode[],
    targetId: string,
    parentNode?: MindMapNode
  ): { node: MindMapNode; parent?: MindMapNode; siblings: MindMapNode[] } | null {
    return findNodeInTree(nodeList, n => n.id === targetId, parentNode);
  }

  private static extractStructureElements(lines: string[], lineEnding: string): StructureElement[] {
    type State = {
      elements: StructureElement[];
      preface: string[];
      current: StructureElement | null;
      buffer: string[];
      foundFirst: boolean;
    };

    const flushElement = (state: State): StructureElement[] => {
      if (!state.current) return state.elements;
      const element = state.buffer.length > 0
        ? { ...state.current, content: state.buffer.join(lineEnding) }
        : state.current;
      return [...state.elements, element];
    };

    const addPreface = (state: State): StructureElement[] => {
      if (state.foundFirst || state.preface.length === 0) return state.elements;
      return [...state.elements, {
        type: 'preface',
        level: 0,
        text: state.preface.join(lineEnding),
        content: undefined,
        originalFormat: '',
        lineNumber: 0,
      }];
    };

    const processLine = (state: State, line: string, i: number): State => {
      const heading = parseHeading(line);
      if (heading) {
        return {
          elements: flushElement(addPreface(state)),
          preface: [],
          current: { type: 'heading', level: heading.level, text: heading.text, originalFormat: '#'.repeat(heading.level), lineNumber: i },
          buffer: [],
          foundFirst: true,
        };
      }

      const listItem = parseListItem(line);
      if (listItem) {
        return {
          elements: flushElement(addPreface(state)),
          preface: [],
          current: {
            type: listItem.type as 'unordered-list' | 'ordered-list',
            level: listItem.level,
            text: listItem.text,
            originalFormat: listItem.marker,
            indentLevel: listItem.indentLevel,
            lineNumber: i,
            isCheckbox: listItem.isCheckbox,
            isChecked: listItem.isCheckbox ? listItem.isChecked : undefined,
          },
          buffer: [],
          foundFirst: true,
        };
      }

      // Non-structure line
      return state.foundFirst
        ? { ...state, buffer: [...state.buffer, line] }
        : { ...state, preface: [...state.preface, line] };
    };

    const finalState = lines.reduce((state, line, i) => processLine(state, line, i), {
      elements: [],
      preface: [],
      current: null,
      buffer: [],
      foundFirst: false,
    } as State);

    const withPreface = addPreface(finalState);
    return flushElement({ ...finalState, elements: withPreface });
  }

  private static buildNodeHierarchy(
    elements: StructureElement[],
    defaultLineEnding?: string,
    defaultCollapseDepth?: number
  ): MindMapNode[] {
    type Stack<T> = { node: MindMapNode; data: T }[];
    type State = {
      roots: MindMapNode[];
      headingStack: Stack<{ level: number; depth: number }>;
      listStack: Stack<{ indentLevel: number }>;
      currentHeading: MindMapNode | null;
    };

    const shouldCollapse = elements.filter(e => e.type !== 'preface').length > 30;
    const collapseDepth = defaultCollapseDepth ?? 2;
    const lineEnding = defaultLineEnding || '\n';

    const createNodeFromElement = (element: StructureElement, isRoot: boolean): MindMapNode => {
      const node = createNode(element.text, { isRoot });
      node.children = [];
      node.lineEnding = lineEnding;
      if (element.content) node.note = element.content;
      node.markdownMeta = {
        type: element.type,
        level: element.level,
        originalFormat: element.originalFormat,
        indentLevel: element.indentLevel,
        lineNumber: element.lineNumber,
        isCheckbox: element.isCheckbox,
        isChecked: element.isChecked,
      };
      return node;
    };

    const attachTable = (parent: MindMapNode): MindMapNode[] => {
      const tableInfo = extractFirstTable(parent.note, lineEnding);
      if (!tableInfo) return [parent];

      parent.note = tableInfo.before;
      const tableNode = createNode('');
      (tableNode as unknown as Record<string, unknown>).kind = 'table';
      tableNode.text = tableInfo.tableBlock;
      tableNode.note = tableInfo.after;
      tableNode.lineEnding = lineEnding;
      delete (tableNode as unknown as Record<string, unknown>).markdownMeta;

      return [parent, tableNode];
    };

    const addNodes = (parent: MindMapNode | null, nodes: MindMapNode[], state: State): State => {
      if (parent) {
        parent.children = [...(parent.children || []), ...nodes];
        return state;
      }
      return { ...state, roots: [...state.roots, ...nodes] };
    };

    const processElement = (state: State, element: StructureElement): State => {
      if (element.type === 'preface') {
        const node = createNodeFromElement(element, true);
        node.text = '';
        node.note = element.text;
        return { ...state, roots: [node, ...state.roots] };
      }

      const isRoot = element.type === 'heading'
        ? state.headingStack.every(s => s.data.level >= element.level)
        : !state.currentHeading && (element.indentLevel || 0) === 0;

      const node = createNodeFromElement(element, isRoot);
      const nodesWithTable = attachTable(node);

      if (element.type === 'heading') {
        const depth = state.headingStack.filter(s => s.data.level < element.level).length;
        if (shouldCollapse && collapseDepth > 0 && depth >= collapseDepth) {
          node.collapsed = true;
        }

        const newHeadingStack = state.headingStack.filter(s => s.data.level < element.level);
        const parent = newHeadingStack[newHeadingStack.length - 1]?.node || null;
        const newState = addNodes(parent, nodesWithTable, { ...state, headingStack: newHeadingStack, listStack: [] });

        return {
          ...newState,
          headingStack: [...newHeadingStack, { node, data: { level: element.level, depth } }],
          currentHeading: node,
        };
      }

      // List item
      const indentLevel = element.indentLevel || 0;
      const newListStack = state.listStack.filter(s => s.data.indentLevel < indentLevel);
      const parent = newListStack[newListStack.length - 1]?.node || state.currentHeading;
      const newState = addNodes(parent, nodesWithTable, { ...state, listStack: newListStack });

      return {
        ...newState,
        listStack: [...newListStack, { node, data: { indentLevel } }],
      };
    };

    const finalState = elements.reduce(processElement, {
      roots: [],
      headingStack: [],
      listStack: [],
      currentHeading: null,
    } as State);

    return finalState.roots;
  }

  static convertNodesToMarkdown(nodes: MindMapNode[]): string {
    const lineEnding = nodes[0]?.lineEnding || '\n';
    DEBUG_MD && logger.debug('🔵 convertNodesToMarkdown 開始', {
      totalNodes: nodes.length,
      rootNodeTexts: nodes.map(n => n.text),
    });

    const getPrefix = (meta: NonNullable<MindMapNode['markdownMeta']>, parentType?: string): string => {
      if (meta.type === 'heading') return '#'.repeat(meta.level || 1) + ' ';

      const actualIndent = parentType === 'heading' ? 0 : (meta.indentLevel || 0);
      const indent = ' '.repeat(actualIndent);

      if (meta.type === 'unordered-list') {
        const checkbox = meta.isCheckbox ? (meta.isChecked ? '[x] ' : '[ ] ') : '';
        return `${indent}- ${checkbox}`;
      }

      if (meta.type === 'ordered-list') {
        const checkbox = meta.isCheckbox ? (meta.isChecked ? '[x] ' : '[ ] ') : '';
        const number = meta.originalFormat?.match(/^\d+\./) ? meta.originalFormat : '1.';
        return `${indent}${number} ${checkbox}`;
      }

      return '';
    };

    const processNode = (node: MindMapNode, parentType?: string): string[] => {
      if ((node as unknown as Record<string, unknown>).kind === 'table') {
        const tableLines = node.text?.split(/\r\n|\r|\n/) || [];
        const noteLines = node.note?.split(/\r\n|\r|\n/) || [];
        const childLines = (node.children || []).flatMap(c => processNode(c, parentType));
        return [...tableLines, ...noteLines, ...childLines];
      }

      const { markdownMeta } = node;
      if (!markdownMeta) {
        const noteLines = node.note?.split(/\r\n|\r|\n/) || [];
        const childLines = (node.children || []).flatMap(c => processNode(c, parentType));
        return [node.text, ...noteLines, ...childLines];
      }

      if (markdownMeta.type === 'preface') {
        const prefaceLines = node.note?.split(/\r\n|\r|\n/) || [];
        const childLines = (node.children || []).flatMap(c => processNode(c, 'preface'));
        return [...prefaceLines, ...childLines];
      }

      const prefix = getPrefix(markdownMeta, parentType);
      const noteLines = node.note?.split(/\r\n|\r|\n/) || [];
      const childLines = (node.children || []).flatMap(c => processNode(c, markdownMeta.type));

      return [prefix + node.text, ...noteLines, ...childLines];
    };

    const lines = nodes.flatMap(n => processNode(n));
    const result = lines.join(lineEnding);

    DEBUG_MD && logger.debug('🔵 convertNodesToMarkdown 完了', {
      totalLines: lines.length,
      usedLineEnding: lineEnding,
    });

    return result;
  }

  static updateNodeInMarkdown(
    nodes: MindMapNode[],
    nodeId: string,
    newText: string
  ): { updatedNodes: MindMapNode[]; updatedMarkdown: string } {
    const updatedNodes = updateNodeInTree(nodes, n => n.id === nodeId, n => ({ ...n, text: newText }));
    const updatedMarkdown = this.convertNodesToMarkdown(updatedNodes);
    return { updatedNodes, updatedMarkdown };
  }

  static getNodeStructureInfo(node: MindMapNode): {
    type: string;
    level: number;
    originalFormat: string;
    canConvertToMarkdown: boolean;
  } {
    const { markdownMeta } = node;
    return markdownMeta
      ? { type: markdownMeta.type || 'heading', level: markdownMeta.level || 1, originalFormat: markdownMeta.originalFormat || '', canConvertToMarkdown: true }
      : { type: 'unknown', level: 0, originalFormat: '', canConvertToMarkdown: false };
  }

  static changeNodeIndent(
    nodes: MindMapNode[],
    nodeId: string,
    direction: 'increase' | 'decrease'
  ): MindMapNode[] {
    return updateNodeInTree(nodes, n => n.id === nodeId, node => {
      if (!node.markdownMeta) return node;

      const { markdownMeta } = node;
      if (markdownMeta.type === 'heading') {
        const delta = direction === 'increase' ? 1 : -1;
        const newLevel = Math.max(1, Math.min(6, (markdownMeta.level || 1) + delta));
        return {
          ...node,
          markdownMeta: { ...markdownMeta, level: newLevel, originalFormat: '#'.repeat(newLevel) },
        };
      }

      // List item
      const delta = direction === 'increase' ? 2 : -2;
      const newIndent = Math.max(0, (markdownMeta.indentLevel || 0) + delta);
      const newLevel = Math.floor(newIndent / 2) + 1;
      return {
        ...node,
        markdownMeta: { ...markdownMeta, indentLevel: newIndent, level: newLevel },
      };
    });
  }

  static canSafelyConvertToList(
    nodes: MindMapNode[],
    targetNodeId: string
  ): { canConvert: boolean; reason?: string } {
    const context = this.findNodeWithContext(nodes, targetNodeId);
    if (!context) return { canConvert: false, reason: 'ノードが見つかりません' };

    const { node, siblings } = context;
    const nodeIndex = siblings.findIndex(n => n.id === targetNodeId);

    if (node.children?.some(c => c.markdownMeta?.type === 'heading')) {
      return { canConvert: false, reason: '子ノードに見出しがあるため変換できません' };
    }

    if (siblings.slice(0, nodeIndex).some(s => s.markdownMeta?.type === 'heading')) {
      return { canConvert: false, reason: '兄に見出しノードがあるため変換できません' };
    }

    return { canConvert: true };
  }

  static canSafelyConvertToHeading(
    nodes: MindMapNode[],
    targetNodeId: string
  ): { canConvert: boolean; reason?: string } {
    const context = this.findNodeWithContext(nodes, targetNodeId);
    if (!context) return { canConvert: false, reason: 'ノードが見つかりません' };

    const { parent, siblings } = context;
    const nodeIndex = siblings.findIndex(n => n.id === targetNodeId);

    const isListType = (type?: string) => type === 'unordered-list' || type === 'ordered-list';

    if (siblings.slice(nodeIndex + 1).some(s => isListType(s.markdownMeta?.type))) {
      return { canConvert: false, reason: '弟にリストノードがあるため変換できません' };
    }

    if (parent && isListType(parent.markdownMeta?.type)) {
      return { canConvert: false, reason: '親ノードがリストノードのため変換できません' };
    }

    return { canConvert: true };
  }

  static changeNodeType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    const isListType = newType === 'unordered-list' || newType === 'ordered-list';
    const check = isListType
      ? this.canSafelyConvertToList(nodes, nodeId)
      : this.canSafelyConvertToHeading(nodes, nodeId);

    if (!check.canConvert) throw new Error(check.reason);

    return updateNodeInTree(nodes, n => n.id === nodeId, (node, parent) => {
      const currentMeta = node.markdownMeta || { type: 'heading' as const, level: 1, originalFormat: '#', indentLevel: 0, lineNumber: 0 };
      const cleanText = node.text.replace(/^#+\s*|\s*[-*+]\s*|\s*\d+\.\s*/g, '');

      if (newType === 'heading') {
        const parentLevel = parent?.markdownMeta?.type === 'heading' ? (parent.markdownMeta.level || 1) : 0;
        const targetLevel = Math.min(parentLevel + 1 || currentMeta.level || 1, 6);
        return {
          ...node,
          text: cleanText,
          markdownMeta: { type: 'heading', level: targetLevel, originalFormat: '#'.repeat(targetLevel), indentLevel: 0, lineNumber: currentMeta.lineNumber },
        };
      }

      const isParentList = parent?.markdownMeta && (parent.markdownMeta.type === 'unordered-list' || parent.markdownMeta.type === 'ordered-list');
      const targetLevel = isParentList ? Math.max((parent.markdownMeta?.level || 1) + 1, 1) : 1;
      const indentLevel = Math.max(targetLevel - 1, 0) * 2;
      const format = newType === 'unordered-list' ? '-' : '1.';

      return {
        ...node,
        text: cleanText,
        markdownMeta: { type: newType, level: targetLevel, originalFormat: format, indentLevel, lineNumber: currentMeta.lineNumber },
      };
    });
  }

  static changeListType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    return updateNodeInTree(nodes, n => n.id === nodeId, node => {
      if (!node.markdownMeta) return node;
      const format = newType === 'unordered-list' ? '-' : '1.';
      return {
        ...node,
        markdownMeta: { ...node.markdownMeta, type: newType, originalFormat: format },
      };
    });
  }

  static renumberOrderedLists(nodes: MindMapNode[]): MindMapNode[] {
    const process = (nodeList: MindMapNode[]): MindMapNode[] => {
      let counter = 1;
      return nodeList.map(node => {
        if (node.markdownMeta?.type === 'ordered-list') {
          const updatedNode = {
            ...node,
            markdownMeta: { ...node.markdownMeta, originalFormat: `${counter}.` },
          };
          counter++;
          return node.children ? { ...updatedNode, children: process(node.children) } : updatedNode;
        }
        counter = 1;
        return node.children ? { ...node, children: process(node.children) } : node;
      });
    };
    return process(nodes);
  }

  private static adjustNodePositions(
    nodes: MindMapNode[],
    options: {
      startX?: number;
      startY?: number;
      horizontalSpacing?: number;
      verticalSpacing?: number;
    }
  ): void {
    const { startX = 100, startY = 100, horizontalSpacing = 12, verticalSpacing = 18 } = options;

    const positionNode = (node: MindMapNode, x: number, y: number): number => {
      node.x = x;
      node.y = y;

      if (!node.children?.length) return y;

      const childX = x + horizontalSpacing;
      let nextY = y;

      node.children.forEach(child => {
        nextY = positionNode(child, childX, nextY);
        nextY += verticalSpacing;
      });

      if (node.children.length > 1) {
        node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
      }

      return nextY - verticalSpacing;
    };

    let currentY = startY;
    nodes.forEach(root => {
      currentY = positionNode(root, startX, currentY);
      currentY += verticalSpacing * 2;
    });
  }
}
