import { type MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';
import { logger } from '@shared/utils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';


const createNewNode = (text: string, _isRoot: boolean = false, parentLineEnding?: string): MindMapNode => {
  
  const calculateInitialX = () => 0;

  return {
    id: generateNodeId(),
    text,
    x: calculateInitialX(),
    y: 300, 
    children: [],
    fontSize: 14,
    fontWeight: 'normal',
    note: undefined,
    lineEnding: parentLineEnding || '\n'
  };
};

const DEBUG_MD = true; 




interface StructureElement {
  type: 'heading' | 'unordered-list' | 'ordered-list' | 'preface';
  level: number;
  text: string;
  content?: string | undefined; 
  originalFormat: string; 
  indentLevel?: number; 
  lineNumber: number; 
  
  isCheckbox?: boolean; 
  isChecked?: boolean;  
}

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
    if (DEBUG_MD) {
      logger.debug('🔍 マークダウンパース開始', {
        textLength: markdownText.length,
        firstLine: markdownText.split(/\r\n|\r|\n/)[0],
      });
    }

    
    const detectedLineEnding = LineEndingUtils.detectLineEnding(markdownText);

    const lines = markdownText.split(/\r\n|\r|\n/);
    const elements = this.extractStructureElements(lines, detectedLineEnding);

    if (DEBUG_MD) {
      logger.debug('📝 構造要素抽出結果', {
        elementsCount: elements.length,
        elements: elements.map((e) => ({ type: e.type, level: e.level, text: e.text })),
        detectedLineEnding: detectedLineEnding
      });
    }

    if (elements.length === 0) {
      
      throw new Error('構造要素が見つかりません。マークダウンファイルには少なくとも1つの見出しまたはリストが必要です。');
    }

    
    const headingLevelByText: Record<string, number> = {};
    elements.forEach((element: StructureElement) => {
      if (element.type === 'heading' && !(element.text in headingLevelByText)) {
        headingLevelByText[element.text] = element.level;
      }
    });

    
    const rootNodes = this.buildNodeHierarchy(elements, detectedLineEnding, options?.defaultCollapseDepth);

    
    this.adjustNodePositions(rootNodes, options || {});

    if (DEBUG_MD) {
      logger.debug('🏗️ ノード構築結果', {
        rootCount: rootNodes.length,
        roots: rootNodes.map((r) => ({
          text: r.text,
          childrenCount: r.children?.length || 0,
          position: { x: r.x, y: r.y },
          lineEnding: r.lineEnding
        })),
      });
    }

    return { rootNodes, headingLevelByText };
  }

    private static extractStructureElements(lines: string[], lineEnding: string): StructureElement[] {
    const elements: StructureElement[] = [];
    let currentContent: string[] = [];
    let currentElement: StructureElement | null = null;
    const prefaceLines: string[] = [];
    let foundFirstStructureElement = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        
        if (!foundFirstStructureElement && prefaceLines.length > 0) {
          const prefaceText = prefaceLines.join(lineEnding);
          
          elements.push({
            type: 'preface',
            level: 0,
            text: prefaceText,
            content: undefined,
            originalFormat: '',
            lineNumber: 0
          });
        }
        foundFirstStructureElement = true;

        // 前の要素を保存
        if (currentElement) {
          if(currentContent.length > 0) {
            currentElement.content = currentContent.join(lineEnding);
          }
          elements.push(currentElement);
        }

        currentElement = {
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2],
          content: undefined,
          originalFormat: headingMatch[1], 
          lineNumber: i
        };
        currentContent = [];
        continue;
      }

      
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        
        if (!foundFirstStructureElement && prefaceLines.length > 0) {
          const prefaceText = prefaceLines.join(lineEnding);
          
          elements.push({
            type: 'preface',
            level: 0,
            text: prefaceText,
            content: undefined,
            originalFormat: '',
            lineNumber: 0
          });
        }
        foundFirstStructureElement = true;

        // 前の要素を保存
        if (currentElement) {
          if(currentContent.length > 0) {
            currentElement.content = currentContent.join(lineEnding);
          }
          elements.push(currentElement);
        }

        const indent = listMatch[1];
        const marker = listMatch[2];
        let text = listMatch[3];
        const level = Math.floor(indent.length / 2) + 1; // 2スペースで1レベル

        // チェックボックスパターンを検出
        let isCheckbox = false;
        let isChecked = false;
        const checkboxMatch = text.match(/^\[([ xX])\]\s*(.*)$/);
        if (checkboxMatch && marker.match(/^[-*+]$/)) { // チェックボックスは順序なしリストのみ
          isCheckbox = true;
          isChecked = checkboxMatch[1].toLowerCase() === 'x';
          text = checkboxMatch[2]; 
        }

        currentElement = {
          type: marker.match(/\d+\./) ? 'ordered-list' : 'unordered-list',
          level: level,
          text: text,
          content: undefined,
          originalFormat: marker,
          indentLevel: indent.length,
          lineNumber: i,
          
          isCheckbox: isCheckbox,
          isChecked: isCheckbox ? isChecked : undefined
        };
        currentContent = [];
        continue;
      }

      
      if (!foundFirstStructureElement) {
        
        prefaceLines.push(line);
      } else if (currentElement) {
        
        currentContent.push(line);
      }
    }

    
    if (!foundFirstStructureElement && prefaceLines.length > 0) {
      const prefaceText = prefaceLines.join(lineEnding);
      
      elements.push({
        type: 'preface',
        level: 0,
        text: prefaceText,
        content: undefined,
        originalFormat: '',
        lineNumber: 0
      });
    }

    // 最後の要素を保存
    if (currentElement) {
      if (currentContent.length > 0) {
        currentElement.content = currentContent.join(lineEnding);
      }
      elements.push(currentElement);
    }

    return elements;
  }

  /**
   * Extract first Markdown table from text
   */
  private static extractFirstTable(text?: string, lineEnding?: string): {
    headers?: string[];
    rows: string[][];
    before?: string;
    tableBlock: string;
    after?: string;
  } | null {
    if (!text) return null;
    const defaultLineEnding = lineEnding || '\n';
    const lines = text.split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      const headerLine = lines[i];
      const sepLine = lines[i + 1];
      const isHeader = /^\s*\|.*\|\s*$/.test(headerLine);
      const isSep = /^\s*\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)\|?\s*$/.test(sepLine);
      if (!isHeader || !isSep) continue;

      
      let j = i + 2;
      const rowLines: string[] = [];
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        rowLines.push(lines[j]);
        j++;
      }

      const toCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|');
      const headers = toCells(headerLine);
      const rows = rowLines.map(toCells);

      // 前後の空行情報を適切に保持
      const before = i > 0 ? lines.slice(0, i).join(defaultLineEnding) : undefined;
      const tableBlock = lines.slice(i, j).join(defaultLineEnding);
      const after = j < lines.length ? lines.slice(j).join(defaultLineEnding) : undefined;

      return { headers, rows, before, tableBlock, after };
    }
    return null;
  }

  /**
   * 構造要素リストからノード階層を構築
   * 見出しが親、リストがその子という正しい階層関係を構築
   * リスト項目同士もインデントレベルに基づいて親子関係を構築
   */
  private static buildNodeHierarchy(elements: StructureElement[], defaultLineEnding?: string, defaultCollapseDepth?: number): MindMapNode[] {
    const rootNodes: MindMapNode[] = [];
    const headingStack: { node: MindMapNode; level: number; depth: number }[] = [];
    const listStack: { node: MindMapNode; indentLevel: number }[] = [];
    let currentHeading: MindMapNode | null = null;

    // ノード総数を計算（前文を除く構造要素の数）
    const totalNodeCount = elements.filter(e => e.type !== 'preface').length;
    
    const shouldApplyCollapse = totalNodeCount > 30;

    for (const element of elements) {
      
      if (element.type === 'preface') {
        const prefaceNode = createNewNode('', true); // テキストは空
        prefaceNode.children = [];
        prefaceNode.note = element.text; // 前文はnoteに格納
        prefaceNode.lineEnding = defaultLineEnding || '\n';
        
        
        prefaceNode.markdownMeta = {
          type: 'preface',
          level: 0,
          originalFormat: '',
          indentLevel: 0,
          lineNumber: element.lineNumber
        };

        // 前文は常にルートレベルに配置し、他の要素より先に表示
        rootNodes.unshift(prefaceNode);
        continue;
      }

      // Determine if this will be a root node before creating it
      const isRoot = (element.type === 'heading' && (
        headingStack.length === 0 ||
        headingStack.every(item => item.level >= element.level)
      )) || (element.type !== 'heading' && currentHeading === null && (element.indentLevel || 0) === 0);

      const newNode = createNewNode(element.text, isRoot);
      
      if (element.content != undefined) {
        newNode.note = element.content;
      }
      newNode.children = [];
      newNode.lineEnding = defaultLineEnding || '\n';

      
      newNode.markdownMeta = {
        type: element.type,
        level: element.level,
        originalFormat: element.originalFormat,
        indentLevel: element.indentLevel,
        lineNumber: element.lineNumber,
        
        isCheckbox: element.isCheckbox,
        isChecked: element.isChecked
      };

      
      
      
      
      const tableInfo = this.extractFirstTable(newNode.note, defaultLineEnding);
      let pendingSiblingTableNode: MindMapNode | null = null;
      if (tableInfo) {
        
        newNode.note = tableInfo.before;

        
        const tnode = createNewNode('');
        (tnode as any).kind = 'table';
        tnode.text = tableInfo.tableBlock;
        delete (tnode as any).note;
        tnode.note = tableInfo.after;
        tnode.lineEnding = defaultLineEnding || '\n';
        
        delete (tnode as any).markdownMeta;
        pendingSiblingTableNode = tnode;
      }

      if (element.type === 'heading') {
        

        
        listStack.length = 0;

        
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= element.level) {
          headingStack.pop();
        }

        
        const currentDepth = headingStack.length;

        if (headingStack.length === 0) {
          
          rootNodes.push(newNode);
          
          if (pendingSiblingTableNode) rootNodes.push(pendingSiblingTableNode);
        } else {
          
          const parentHeading = headingStack[headingStack.length - 1].node;
          parentHeading.children = parentHeading.children || [];
          parentHeading.children.push(newNode);
          
          if (pendingSiblingTableNode) parentHeading.children.push(pendingSiblingTableNode);
        }

        
        
        
        
        
        
        const collapseDepth = defaultCollapseDepth !== undefined ? defaultCollapseDepth : 2;
        if (shouldApplyCollapse && collapseDepth > 0 && currentDepth >= collapseDepth) {
          newNode.collapsed = true;
        }

        
        headingStack.push({ node: newNode, level: element.level, depth: currentDepth });
        currentHeading = newNode;

      } else {
        
        const currentIndentLevel = element.indentLevel || 0;

        
        while (listStack.length > 0 && listStack[listStack.length - 1].indentLevel >= currentIndentLevel) {
          listStack.pop();
        }

        
        let parentNode: MindMapNode | null = null;

        if (listStack.length > 0) {
          
          parentNode = listStack[listStack.length - 1].node;
        } else if (currentHeading) {
          
          parentNode = currentHeading;
        }

        if (parentNode) {
          
          parentNode.children = parentNode.children || [];
          parentNode.children.push(newNode);
          
          if (pendingSiblingTableNode) parentNode.children.push(pendingSiblingTableNode);
        } else {
          
          rootNodes.push(newNode);
          
          if (pendingSiblingTableNode) rootNodes.push(pendingSiblingTableNode);
        }

        
        listStack.push({ node: newNode, indentLevel: currentIndentLevel });
      }
    }

    return rootNodes;
  }


    static convertNodesToMarkdown(nodes: MindMapNode[]): string {
    const lines: string[] = [];
    let detectedLineEnding: string = '\n'; 

    
    if (nodes.length > 0 && nodes[0].lineEnding) {
      detectedLineEnding = nodes[0].lineEnding;
    }

    if (DEBUG_MD) {
      logger.debug('🔵 convertNodesToMarkdown 開始', {
        totalNodes: nodes.length,
        rootNodeTexts: nodes.map(n => n.text),
        rootNodeMetas: nodes.map(n => ({ id: n.id, meta: n.markdownMeta })),
        detectedLineEnding: detectedLineEnding
      });
    }

    const processNode = (node: MindMapNode, parentLevel: number = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list' | 'preface'): void => {
      
      if ((node as any).kind === 'table') {
        const tableMd = String(node.text || '');
        if (tableMd) {
          const tableLines = tableMd.split(/\r\n|\r|\n/);
          for (const ln of tableLines) lines.push(ln);
        }
        // 表ノードのnoteには after（表の後のコンテンツ）が含まれている
        if (node.note != undefined) {
          // afterの内容を行ごとに分割して追加（空行も保持）
          const afterLines = node.note.split(/\r\n|\r|\n/);
          for (const afterLine of afterLines) {
            lines.push(afterLine);
          }
        }
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => processNode(child, parentLevel + 1, parentType));
        }
        return;
      }
      const markdownMeta = node.markdownMeta;
      const nodeType = markdownMeta?.type;

      if (DEBUG_MD) {
        logger.debug('📄 processNode', {
          nodeId: node.id,
          text: node.text,
          hasMarkdownMeta: !!markdownMeta,
          markdownMeta: markdownMeta,
          parentLevel: parentLevel,
          parentType: parentType
        });
      }

      if (markdownMeta) {
        
        let prefix = '';

        if (markdownMeta.type === 'preface') {
          
          
          if (node.note != undefined) {
            
            const prefaceLines = node.note.split(/\r\n|\r|\n/);
            for (const prefaceLine of prefaceLines) {
              lines.push(prefaceLine);
            }
          }
          
          if (node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
              const child = node.children[i] as any;
              processNode(child, 0, nodeType);
            }
          }
          return;
        } else if (markdownMeta.type === 'heading') {
          
          prefix = '#'.repeat(markdownMeta.level || 1) + ' ';
        } else if (markdownMeta.type === 'unordered-list') {
          
          
          const actualIndent = parentType === 'heading' ? 0 : (markdownMeta.indentLevel || 0);
          const indent = ' '.repeat(actualIndent);
          prefix = indent + '- ';
        } else if (markdownMeta.type === 'ordered-list') {
          
          
          const actualIndent = parentType === 'heading' ? 0 : (markdownMeta.indentLevel || 0);
          const indent = ' '.repeat(actualIndent);
          
          let numberFormat = '1.';
          if (markdownMeta.originalFormat && /^\d+\./.test(markdownMeta.originalFormat)) {
            numberFormat = markdownMeta.originalFormat;
          }
          prefix = indent + numberFormat + ' ';
        }

        if(markdownMeta.isCheckbox) {
          
          const checkboxMark = markdownMeta.isChecked ? '[x] ' : '[ ] ';
          prefix += checkboxMark;
        }

        if (DEBUG_MD) {
          logger.debug('📄 マークダウンメタデータあり', {
            nodeId: node.id,
            nodeText: node.text,
            type: markdownMeta.type,
            level: markdownMeta.level,
            indentLevel: markdownMeta.indentLevel,
            actualIndent: parentType === 'heading' && (markdownMeta.type === 'unordered-list' || markdownMeta.type === 'ordered-list') ? 0 : (markdownMeta.indentLevel || 0),
            originalFormat: markdownMeta.originalFormat,
            generatedPrefix: prefix,
            finalLine: prefix + node.text
          });
        }

        lines.push(prefix + node.text);
      } else {
        
        
        lines.push(node.text);
      }

      
      if (node.note != undefined) {
        
        const noteLines = node.note.split(/\r\n|\r|\n/);
        for (const noteLine of noteLines) {
          lines.push(noteLine);
        }
      }

      
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i] as any;
          
          let childParentLevel = parentLevel;

          if (markdownMeta) {
            if (markdownMeta.type === 'heading') {
              
              childParentLevel = 0;
            } else if (markdownMeta.type === 'preface') {
              
              childParentLevel = 0;
            } else {
              
              childParentLevel = (markdownMeta.indentLevel || 0) / 2 + 1;
            }
          } else {
            
            childParentLevel = parentLevel + 1;
          }

          processNode(child, childParentLevel, nodeType);
        }
      }
    };

    for (const rootNode of nodes) {
      processNode(rootNode, 0);
    }

    
    const result = lines.join(detectedLineEnding);

    if (DEBUG_MD) {
      logger.debug('🔵 convertNodesToMarkdown 完了', {
        totalLines: lines.length,
        finalMarkdown: result,
        usedLineEnding: detectedLineEnding
      });
    }

    return result;
  }

    static updateNodeInMarkdown(
    nodes: MindMapNode[], 
    nodeId: string, 
    newText: string
  ): { updatedNodes: MindMapNode[], updatedMarkdown: string } {
    const updatedNodes = this.updateNodeInTree(nodes, nodeId, { text: newText });
    const updatedMarkdown = this.convertNodesToMarkdown(updatedNodes);
    return { updatedNodes, updatedMarkdown };
  }

    private static updateNodeInTree(
    nodes: MindMapNode[], 
    nodeId: string, 
    updates: Partial<MindMapNode>
  ): MindMapNode[] {
    return nodes.map((node: MindMapNode) => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: this.updateNodeInTree(node.children, nodeId, updates)
        };
      }
      return node;
    });
  }

    static getNodeStructureInfo(node: MindMapNode): {
    type: string;
    level: number;
    originalFormat: string;
    canConvertToMarkdown: boolean;
  } {
    const markdownMeta = node.markdownMeta;
    if (markdownMeta) {
      return {
        type: markdownMeta.type || 'heading',
        level: markdownMeta.level || 1,
        originalFormat: markdownMeta.originalFormat || '',
        canConvertToMarkdown: true
      };
    }
    return {
      type: 'unknown',
      level: 0,
      originalFormat: '',
      canConvertToMarkdown: false
    };
  }

  /**
   * ノードのインデントレベルを変更
   * 見出しとリストで処理を分離
   */
  static changeNodeIndent(
    nodes: MindMapNode[],
    nodeId: string,
    direction: 'increase' | 'decrease'
  ): MindMapNode[] {
    const updateIndent = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map((node: MindMapNode) => {
        if (node.id === nodeId && node.markdownMeta) {
          const meta = node.markdownMeta;

          if (meta.type === 'heading') {
            
            let newLevel = meta.level || 1;

            if (direction === 'increase' && newLevel < 6) {
              newLevel += 1;
            } else if (direction === 'decrease' && newLevel > 1) {
              newLevel -= 1;
            }

            return {
              ...node,
              markdownMeta: {
                ...meta,
                level: newLevel,
                originalFormat: '#'.repeat(newLevel)
              }
            };
          } else {
            
            let newIndentLevel = meta.indentLevel || 0;
            let newLevel = meta.level || 1;

            if (direction === 'increase') {
              newIndentLevel += 2; 
              newLevel += 1;
            } else if (direction === 'decrease' && newIndentLevel >= 2) {
              newIndentLevel -= 2; 
              newLevel -= 1;
            }

            return {
              ...node,
              markdownMeta: {
                ...meta,
                indentLevel: newIndentLevel,
                level: newLevel
              }
            };
          }
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: updateIndent(node.children)
          };
        }
        return node;
      });
    };

    return updateIndent(nodes);
  }

    static canSafelyConvertToList(
    nodes: MindMapNode[],
    targetNodeId: string
  ): { canConvert: boolean; reason?: string } {
    const findNodeWithContext = (nodeList: MindMapNode[], parentNode?: MindMapNode): { node: MindMapNode; parent?: MindMapNode; siblings: MindMapNode[] } | null => {
      for (let i = 0; i < nodeList.length; i++) {
        const node: MindMapNode = nodeList[i];
        if (node.id === targetNodeId) {
          return {
            node,
            parent: parentNode,
            siblings: nodeList
          };
        }
        if (node.children && node.children.length > 0) {
          const found = findNodeWithContext(node.children, node);
          if (found) return found;
        }
      }
      return null;
    };

    const context = findNodeWithContext(nodes);
    if (!context) return { canConvert: false, reason: 'ノードが見つかりません' };

    const { node, siblings } = context;
    const nodeIndex = siblings.findIndex(n => n.id === targetNodeId);

    
    if (node.children && node.children.some((child: MindMapNode) => child.markdownMeta?.type === 'heading')) {
      return { canConvert: false, reason: '子ノードに見出しがあるため変換できません' };
    }

    
    const elderSiblings = siblings.slice(0, nodeIndex);
    const hasElderHeadings = elderSiblings.some((sibling: MindMapNode) =>
      sibling.markdownMeta?.type === 'heading'
    );
    
    if (hasElderHeadings) {
      return { canConvert: false, reason: '兄に見出しノードがあるため変換できません' };
    }

    return { canConvert: true };
  }

  static canSafelyConvertToHeading(
    nodes: MindMapNode[],
    targetNodeId: string
  ): { canConvert: boolean; reason?: string } {
    const findNodeWithContext = (nodeList: MindMapNode[], parentNode?: MindMapNode): { node: MindMapNode; parent?: MindMapNode; siblings: MindMapNode[] } | null => {
      for (let i = 0; i < nodeList.length; i++) {
        const node: MindMapNode = nodeList[i];
        if (node.id === targetNodeId) {
          return {
            node,
            parent: parentNode,
            siblings: nodeList
          };
        }
        if (node.children && node.children.length > 0) {
          const found = findNodeWithContext(node.children, node);
          if (found) return found;
        }
      }
      return null;
    };

    const context = findNodeWithContext(nodes);
    if (!context) return { canConvert: false, reason: 'ノードが見つかりません' };

    const { parent, siblings } = context;
    const nodeIndex = siblings.findIndex(n => n.id === targetNodeId);

    
    
    
    const youngerSiblings = siblings.slice(nodeIndex + 1);
    const hasYoungerLists = youngerSiblings.some((sibling: MindMapNode) =>
      sibling.markdownMeta?.type === 'unordered-list' || sibling.markdownMeta?.type === 'ordered-list'
    );
    
    if (hasYoungerLists) {
      return { canConvert: false, reason: '弟にリストノードがあるため変換できません' };
    }

    
    if (parent && (parent.markdownMeta?.type === 'unordered-list' || parent.markdownMeta?.type === 'ordered-list')) {
      return { canConvert: false, reason: '親ノードがリストノードのため変換できません' };
    }

    return { canConvert: true };
  }

    static changeNodeType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    
    const findTarget = (list: MindMapNode[]): MindMapNode | null => {
      for (const n of list) {
        if (n.id === nodeId) return n;
        if (n.children) {
          const found = findTarget(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const targetNode = findTarget(nodes);

    
    
    if (targetNode?.markdownMeta) {
      if (newType === 'unordered-list' || newType === 'ordered-list') {
        const safetyCheck = this.canSafelyConvertToList(nodes, nodeId);
        if (!safetyCheck.canConvert) {
          throw new Error(safetyCheck.reason);
        }
      }
      if (newType === 'heading') {
        const safetyCheck = this.canSafelyConvertToHeading(nodes, nodeId);
        if (!safetyCheck.canConvert) {
          throw new Error(safetyCheck.reason);
        }
      }
    }
    
    const processNode = (nodeList: MindMapNode[], parentNode?: MindMapNode): MindMapNode[] => {
      return nodeList.map((node: MindMapNode) => {
        if (node.id === nodeId) {
          const fallbackMeta = { type: 'heading' as const, level: 1, originalFormat: '#', indentLevel: 0, lineNumber: node.markdownMeta?.lineNumber ?? 0 };
          const currentMeta = node.markdownMeta || fallbackMeta;
          let newMeta = { ...currentMeta };
          let newText = node.text;

          
          newText = newText.replace(/^#+\s*/, ''); // 見出しマーカー削除
          newText = newText.replace(/^[\s]*[-*+]\s*/, ''); // リストマーカー削除
          newText = newText.replace(/^[\s]*\d+\.\s*/, ''); // 順序ありリストマーカー削除

          if (newType === 'heading') {
            
            let targetLevel = 1;
            
            
            if (parentNode && parentNode.markdownMeta?.type === 'heading') {
              targetLevel = Math.min((parentNode.markdownMeta.level || 1) + 1, 6);
            } else if (currentMeta.level) {
              
              targetLevel = Math.min(currentMeta.level, 6);
            }
            
            newMeta = {
              type: 'heading',
              level: targetLevel,
              originalFormat: '#'.repeat(targetLevel),
              indentLevel: 0,
              lineNumber: currentMeta.lineNumber
            };
            
          } else if (newType === 'unordered-list') {
            
            
            let targetLevel = 1;
            
            if (parentNode && (parentNode.markdownMeta?.type === 'unordered-list' || parentNode.markdownMeta?.type === 'ordered-list')) {
              targetLevel = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
            }
            
            newMeta = {
              type: 'unordered-list',
              level: targetLevel,
              originalFormat: '-',
              
              indentLevel: Math.max(targetLevel - 1, 0) * 2,
              lineNumber: currentMeta.lineNumber
            };
            
          } else if (newType === 'ordered-list') {
            
            
            let targetLevel = 1;
            
            if (parentNode && (parentNode.markdownMeta?.type === 'unordered-list' || parentNode.markdownMeta?.type === 'ordered-list')) {
              targetLevel = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
            }
            
            newMeta = {
              type: 'ordered-list',
              level: targetLevel,
              originalFormat: '1.',
              
              indentLevel: Math.max(targetLevel - 1, 0) * 2,
              lineNumber: currentMeta.lineNumber
            };
            
          }

          const updatedNode = {
            ...node,
            text: newText,
            markdownMeta: newMeta
          };
          return updatedNode;
        }

      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: processNode(node.children, node)
        };
      }

        return node;
      });
    };

    return processNode(nodes);
  }

    static changeListType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    const updateListType = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map((node: MindMapNode) => {
        if (node.id === nodeId && node.markdownMeta) {
          const meta = node.markdownMeta;
          let newFormat = meta.originalFormat;

          if (newType === 'unordered-list') {
            newFormat = '-';
          } else if (newType === 'ordered-list') {
            newFormat = '1.'; 
          }

          return {
            ...node,
            markdownMeta: {
              ...meta,
              type: newType,
              originalFormat: newFormat
            }
          };
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: updateListType(node.children)
          };
        }
        return node;
      });
    };

    return updateListType(nodes);
  }

    static renumberOrderedLists(nodes: MindMapNode[]): MindMapNode[] {
    const processNodes = (nodeList: MindMapNode[], parentLevel: number = 0): MindMapNode[] => {
      let orderedListCounter = 1;
      
      return nodeList.map((node: MindMapNode) => {
        const markdownMeta = node.markdownMeta;

        if (markdownMeta && markdownMeta.type === 'ordered-list') {
          
          const updatedMarkdownMeta = {
            ...markdownMeta,
            originalFormat: `${orderedListCounter}.`
          };
          orderedListCounter++;

          const updatedNode = {
            ...node,
            markdownMeta: updatedMarkdownMeta
          };

          if (node.children && node.children.length > 0) {
            updatedNode.children = processNodes(node.children, markdownMeta.level);
          }

          return updatedNode;
        } else {
          
          orderedListCounter = 1;

          if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: processNodes(node.children, markdownMeta?.level || parentLevel)
            };
          }

          return node;
        }
      });
    };
    
    return processNodes(nodes);
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
    const {
      startX = 100,
      startY = 100,
      
      horizontalSpacing = 12,
      verticalSpacing = 18
    } = options;

    let currentY = startY;

    const positionNodeAndChildren = (
      node: MindMapNode,
      x: number,
      y: number,
      level: number = 0
    ): number => {
      
      node.x = x;
      node.y = y;

      let nextChildY = y;

      if (node.children && node.children.length > 0) {
        const childX = x + horizontalSpacing;

        
        for (const child of node.children) {
          nextChildY = positionNodeAndChildren(child, childX, nextChildY, level + 1);
          nextChildY += verticalSpacing;
        }

        
        if (node.children.length > 1) {
          const firstChildY = node.children[0].y;
          const lastChildY = node.children[node.children.length - 1].y;
          node.y = (firstChildY + lastChildY) / 2;
        }

        return nextChildY - verticalSpacing; 
      }

      return y;
    };

    
    for (const rootNode of nodes) {
      currentY = positionNodeAndChildren(rootNode, startX, currentY);
      currentY += verticalSpacing * 2; 
    }
  }
}
