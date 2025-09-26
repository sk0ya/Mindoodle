import { type MindMapNode } from '@shared/types';
import { generateNodeId } from '@shared/utils';
import { logger } from '@shared/utils';

// Helper function to create new node with proper initial positioning
const createNewNode = (text: string, isRoot: boolean = false): MindMapNode => {
  // サイドバーを考慮した適切な初期X座標を設定
  const calculateInitialX = () => {
    if (!isRoot) return 0; // 子ノードは後でautoLayoutで配置される

    const leftPanelWidth = 280; // Primary sidebar
    const margin = 5; // サイドバーのすぐ右ギリギリ


    return leftPanelWidth + margin; // サイドバーのすぐ右側
  };

  return {
    id: generateNodeId(),
    text,
    x: calculateInitialX(),
    y: 300, // デフォルトY座標
    children: [],
    fontSize: 14,
    fontWeight: 'normal'
  };
};

const DEBUG_MD = true; // 一時的にデバッグ有効
// const DEBUG_MD =
//   (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === '1' ||
//   (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === 'true';

interface StructureElement {
  type: 'heading' | 'unordered-list' | 'ordered-list';
  level: number;
  text: string;
  content: string;
  originalFormat: string; // #, ##, -, *, +, 1., 2. など
  indentLevel?: number; // リストのインデントレベル（スペース数）
  lineNumber: number; // 元の行番号
}

/**
 * マークダウンテキストを解析してノード階層に変換
 */
export class MarkdownImporter {
  /**
   * マークダウンをパースしてMindMapNode構造に変換
   */
  static parseMarkdownToNodes(
    markdownText: string,
    options?: {
      startX?: number;
      startY?: number;
      horizontalSpacing?: number;
      verticalSpacing?: number;
    }
  ): { rootNodes: MindMapNode[]; headingLevelByText: Record<string, number> } {
    if (DEBUG_MD) {
      logger.debug('🔍 マークダウンパース開始', {
        textLength: markdownText.length,
        firstLine: markdownText.split('\n')[0],
      });
    }

    const lines = markdownText.split('\n');
    const elements = this.extractStructureElements(lines);

    if (DEBUG_MD) {
      logger.debug('📝 構造要素抽出結果', {
        elementsCount: elements.length,
        elements: elements.map((e) => ({ type: e.type, level: e.level, text: e.text })),
      });
    }

    if (elements.length === 0) {
      // ユーザー向け通知は上位で処理するため、ここではコンソールに警告を出さない
      throw new Error('構造要素が見つかりません。マークダウンファイルには少なくとも1つの見出しまたはリストが必要です。');
    }

    // 見出しレベル情報を抽出
    const headingLevelByText: Record<string, number> = {};
    elements.forEach((element: StructureElement) => {
      if (element.type === 'heading' && !(element.text in headingLevelByText)) {
        headingLevelByText[element.text] = element.level;
      }
    });

    // ノード構造を構築
    const rootNodes = this.buildNodeHierarchy(elements);

    // 位置を調整
    if (options) {
      this.adjustNodePositions(rootNodes, options);
    }

    if (DEBUG_MD) {
      logger.debug('🏗️ ノード構築結果', {
        rootCount: rootNodes.length,
        roots: rootNodes.map((r) => ({
          text: r.text,
          childrenCount: r.children?.length || 0,
          position: { x: r.x, y: r.y },
        })),
      });
    }

    return { rootNodes, headingLevelByText };
  }

  /**
   * マークダウンから見出しとリスト要素を抽出
   */
  private static extractStructureElements(lines: string[]): StructureElement[] {
    const elements: StructureElement[] = [];
    let currentContent: string[] = [];
    let currentElement: StructureElement | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 見出しをチェック
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // 前の要素を保存
        if (currentElement) {
          currentElement.content = currentContent.join('\n').trim();
          elements.push(currentElement);
        }

        currentElement = {
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          content: '',
          originalFormat: headingMatch[1], // # の個数を保存
          lineNumber: i
        };
        currentContent = [];
        continue;
      }

      // リスト項目をチェック
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        // 前の要素を保存
        if (currentElement) {
          currentElement.content = currentContent.join('\n').trim();
          elements.push(currentElement);
        }

        const indent = listMatch[1];
        const marker = listMatch[2];
        const text = listMatch[3];
        const level = Math.floor(indent.length / 2) + 1; // 2スペースで1レベル

        currentElement = {
          type: marker.match(/\d+\./) ? 'ordered-list' : 'unordered-list',
          level: level,
          text: text.trim(),
          content: '',
          originalFormat: marker,
          indentLevel: indent.length,
          lineNumber: i
        };
        currentContent = [];
        continue;
      }

      // その他のコンテンツを現在の要素に追加
      if (currentElement) {
        currentContent.push(line);
      }
    }

    // 最後の要素を保存
    if (currentElement) {
      currentElement.content = currentContent.join('\n').trim();
      elements.push(currentElement);
    }

    return elements;
  }

  /**
   * Extract first Markdown table from text
   */
  private static extractFirstTable(text?: string): {
    headers?: string[];
    rows: string[][];
    before: string;
    tableBlock: string;
    after: string;
  } | null {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      const headerLine = lines[i];
      const sepLine = lines[i + 1];
      const isHeader = /^\s*\|.*\|\s*$/.test(headerLine.trim());
      const isSep = /^\s*\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)\|?\s*$/.test(sepLine.trim());
      if (!isHeader || !isSep) continue;

      // collect data rows
      let j = i + 2;
      const rowLines: string[] = [];
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j].trim())) {
        rowLines.push(lines[j]);
        j++;
      }

      const toCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = toCells(headerLine);
      const rows = rowLines.map(toCells);

      const before = lines.slice(0, i).join('\n'); // do not trim; preserve original whitespace
      const tableBlock = lines.slice(i, j).join('\n');
      const after = lines.slice(j).join('\n'); // do not trim; preserve original whitespace

      return { headers, rows, before, tableBlock, after };
    }
    return null;
  }

  /**
   * 構造要素リストからノード階層を構築
   * 見出しが親、リストがその子という正しい階層関係を構築
   * リスト項目同士もインデントレベルに基づいて親子関係を構築
   */
  private static buildNodeHierarchy(elements: StructureElement[]): MindMapNode[] {
    const rootNodes: MindMapNode[] = [];
    const headingStack: { node: MindMapNode; level: number }[] = [];
    const listStack: { node: MindMapNode; indentLevel: number }[] = [];
    let currentHeading: MindMapNode | null = null;

    for (const element of elements) {
      // Determine if this will be a root node before creating it
      const isRoot = (element.type === 'heading' && (
        headingStack.length === 0 ||
        headingStack.every(item => item.level >= element.level)
      )) || (element.type !== 'heading' && currentHeading === null && (element.indentLevel || 0) === 0);

      const newNode = createNewNode(element.text, isRoot);
      if (element.content) newNode.note = element.content;
      newNode.children = [];

      // 元の構造情報をノードに保存（正式な型として）
      newNode.markdownMeta = {
        type: element.type,
        level: element.level,
        originalFormat: element.originalFormat,
        indentLevel: element.indentLevel,
        lineNumber: element.lineNumber
      };

      // If the content contains only a table, convert this node into a table node
      const tableInfo = this.extractFirstTable(newNode.note);
      if (tableInfo) {
        const surrounding = `${tableInfo.before}${tableInfo.after}`; // preserve whitespace exactly
        if (surrounding.length === 0 && newNode.text.trim().length === 0) {
          // Pure table node
          (newNode as any).kind = 'table';
          newNode.text = tableInfo.tableBlock; // store markdown table in text
          delete (newNode as any).note;
          // 表ノードは見出し/リストのメタを持たない
          delete (newNode as any).markdownMeta;
        } else if (surrounding.length === 0 && newNode.text.trim().length > 0) {
          // Heading/List node whose content is only a table -> add a child table node
          const tableNode = createNewNode('');
          (tableNode as any).kind = 'table';
          tableNode.text = tableInfo.tableBlock;
          delete (tableNode as any).note;
          newNode.note = undefined;
          newNode.children?.push(tableNode);
        } else {
          // Content has table plus other text: remove table from note and create child table node
          const tableNode = createNewNode('');
          (tableNode as any).kind = 'table';
          tableNode.text = tableInfo.tableBlock;
          delete (tableNode as any).note;
          // Preserve before/after exactly as in original (no trimming, no extra newlines)
          const combined = `${tableInfo.before}${tableInfo.after}`;
          newNode.note = combined.length > 0 ? combined : undefined;
          newNode.children?.push(tableNode);
        }
      }

      if (element.type === 'heading') {
        // 見出しの場合：階層に基づいて親子関係を決定

        // リストスタックをクリア（見出しが変わったのでリストの階層をリセット）
        listStack.length = 0;

        // より深いレベルの見出しをスタックからポップ
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= element.level) {
          headingStack.pop();
        }

        if (headingStack.length === 0) {
          // 親見出しがない → ルートノード
          rootNodes.push(newNode);
        } else {
          // 親見出しがある → その子として追加
          const parentHeading = headingStack[headingStack.length - 1].node;
          parentHeading.children = parentHeading.children || [];
          parentHeading.children.push(newNode);
        }

        // 現在の見出しとしてスタックに追加
        headingStack.push({ node: newNode, level: element.level });
        currentHeading = newNode;

      } else {
        // リスト項目の場合：インデントレベルに基づいて親子関係を決定
        const currentIndentLevel = element.indentLevel || 0;

        // より深いインデントレベルのリストアイテムをスタックからポップ
        while (listStack.length > 0 && listStack[listStack.length - 1].indentLevel >= currentIndentLevel) {
          listStack.pop();
        }

        // 親を決定
        let parentNode: MindMapNode | null = null;

        if (listStack.length > 0) {
          // 親リストアイテムがある場合
          parentNode = listStack[listStack.length - 1].node;
        } else if (currentHeading) {
          // リストスタックは空だが見出しがある場合
          parentNode = currentHeading;
        }

        if (parentNode) {
          // 親ノードの子として追加
          parentNode.children = parentNode.children || [];
          parentNode.children.push(newNode);
        } else {
          // 親がない場合 → ルートレベルのリスト項目として扱う
          rootNodes.push(newNode);
        }

        // 現在のリストアイテムをスタックに追加
        listStack.push({ node: newNode, indentLevel: currentIndentLevel });
      }
    }

    return rootNodes;
  }


  /**
   * ノード構造からマークダウンに逆変換
   */
  static convertNodesToMarkdown(nodes: MindMapNode[]): string {
    const lines: string[] = [];

    if (DEBUG_MD) {
      logger.debug('🔵 convertNodesToMarkdown 開始', {
        totalNodes: nodes.length,
        rootNodeTexts: nodes.map(n => n.text),
        rootNodeMetas: nodes.map(n => ({ id: n.id, meta: n.markdownMeta }))
      });
    }

    const processNode = (node: MindMapNode, parentLevel: number = 0, parentType?: 'heading' | 'unordered-list' | 'ordered-list'): void => {
      // Special-case: table node outputs a markdown table block
      if ((node as any).kind === 'table') {
        const headers = (node as any).tableData?.headers as string[] | undefined;
        const rows = (node as any).tableData?.rows as string[][] | undefined;
        const effectiveHeaders: string[] = headers && headers.length > 0
          ? headers
          : (() => {
              const cols = Math.max(((rows && rows[0]?.length) || 0), 1);
              return new Array(cols).fill('');
            })();
        // Build table block
        lines.push(`| ${effectiveHeaders.join(' | ')} |`);
        lines.push(`| ${effectiveHeaders.map(() => '---').join(' | ')} |`);
        (rows || []).forEach(r => {
          lines.push(`| ${(r || []).map(c => c ?? '').join(' | ')} |`);
        });
        // Append note if exists
        if (node.note && node.note.trim() !== '') {
          lines.push(node.note);
        }
        // Guardedly handle children without injecting extra blank lines
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
        // 現在のtypeに基づいて動的にフォーマットを生成
        let prefix = '';

        if (markdownMeta.type === 'heading') {
          // 見出しの場合：levelに基づいて#の数を決定
          prefix = '#'.repeat(markdownMeta.level || 1) + ' ';
        } else if (markdownMeta.type === 'unordered-list') {
          // 順序なしリストの場合：インデントレベルに基づいて-を配置
          // 見出しの直下のリストはインデントレベル0から開始
          const actualIndent = parentType === 'heading' ? 0 : (markdownMeta.indentLevel || 0);
          const indent = ' '.repeat(actualIndent);
          prefix = indent + '- ';
        } else if (markdownMeta.type === 'ordered-list') {
          // 順序ありリストの場合：インデントレベルに基づいて番号を配置
          // 見出しの直下のリストはインデントレベル0から開始
          const actualIndent = parentType === 'heading' ? 0 : (markdownMeta.indentLevel || 0);
          const indent = ' '.repeat(actualIndent);
          // originalFormatから番号を取得、なければ1.を使用
          let numberFormat = '1.';
          if (markdownMeta.originalFormat && /^\d+\./.test(markdownMeta.originalFormat)) {
            numberFormat = markdownMeta.originalFormat;
          }
          prefix = indent + numberFormat + ' ';
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
        // 新しく作成されたノード（マークダウンメタデータなし）の場合の処理
        // parentLevelに基づいてリストアイテムとして出力
        const indent = ' '.repeat(parentLevel * 2);
        const finalLine = indent + '- ' + node.text;

        if (DEBUG_MD) {
          logger.debug('⚠️ マークダウンメタデータなし - リストに変換', {
            nodeId: node.id,
            nodeText: node.text,
            parentLevel: parentLevel,
            indent: indent,
            finalLine: finalLine,
            originalNode: node // 元のノード情報全体を確認
          });
        }

        lines.push(finalLine);
      }

      // ノートがある場合は追加（不要な空行なし・trimしない: 意図した空白を保持）
      if (node.note != null && node.note !== '') {
        lines.push(node.note);
      }

      // 子ノードを処理（空行はnoteに保持されたもののみ）
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i] as any;
          // 親の種類に応じて子ノードのインデントレベルを決定
          let childParentLevel = parentLevel;

          if (markdownMeta) {
            if (markdownMeta.type === 'heading') {
              // 見出しの子は常にインデントレベル0から開始
              childParentLevel = 0;
            } else {
              // リストの子は親のインデントレベル + 1
              childParentLevel = (markdownMeta.indentLevel || 0) / 2 + 1;
            }
          } else {
            // メタデータがない場合は現在のレベル + 1
            childParentLevel = parentLevel + 1;
          }

          processNode(child, childParentLevel, nodeType);
        }
      }
    };

    for (const rootNode of nodes) {
      processNode(rootNode, 0);
    }

    const result = lines.join('\n');

    if (DEBUG_MD) {
      logger.debug('🔵 convertNodesToMarkdown 完了', {
        totalLines: lines.length,
        finalMarkdown: result
      });
    }

    return result;
  }

  /**
   * 特定のノードのテキストを更新し、マークダウンを再生成
   */
  static updateNodeInMarkdown(
    nodes: MindMapNode[], 
    nodeId: string, 
    newText: string
  ): { updatedNodes: MindMapNode[], updatedMarkdown: string } {
    const updatedNodes = this.updateNodeInTree(nodes, nodeId, { text: newText });
    const updatedMarkdown = this.convertNodesToMarkdown(updatedNodes);
    return { updatedNodes, updatedMarkdown };
  }

  /**
   * ノードツリー内の特定のノードを更新
   */
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

  /**
   * ノードの構造情報を取得（デバッグ用）
   */
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
            // 見出しレベルの変更
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
            // リストインデントの変更
            let newIndentLevel = meta.indentLevel || 0;
            let newLevel = meta.level || 1;

            if (direction === 'increase') {
              newIndentLevel += 2; // 2スペース増加
              newLevel += 1;
            } else if (direction === 'decrease' && newIndentLevel >= 2) {
              newIndentLevel -= 2; // 2スペース減少
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

  /**
   * ノードがリストに安全に変換できるかチェック
   */
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

    // 条件1: 変換対象の子ノードに見出しノードがいない
    if (node.children && node.children.some((child: MindMapNode) => child.markdownMeta?.type === 'heading')) {
      return { canConvert: false, reason: '子ノードに見出しがあるため変換できません' };
    }

    // 条件2: 兄弟ノードのうち、兄に見出しノードがいない（弟は関係ない）
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

    // リストノード以外からの変換も許可（制約緩和）
    
    // 条件1: 兄弟ノードのうち、弟にリストノードがいない（兄ノードは関係ない）
    const youngerSiblings = siblings.slice(nodeIndex + 1);
    const hasYoungerLists = youngerSiblings.some((sibling: MindMapNode) =>
      sibling.markdownMeta?.type === 'unordered-list' || sibling.markdownMeta?.type === 'ordered-list'
    );
    
    if (hasYoungerLists) {
      return { canConvert: false, reason: '弟にリストノードがあるため変換できません' };
    }

    // 条件2: 親ノードがリストノードでない
    if (parent && (parent.markdownMeta?.type === 'unordered-list' || parent.markdownMeta?.type === 'ordered-list')) {
      return { canConvert: false, reason: '親ノードがリストノードのため変換できません' };
    }

    return { canConvert: true };
  }

  /**
   * ノードタイプを変更（見出し ↔ リスト）
   */
  static changeNodeType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    // 対象ノードのメタ存在を確認
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

    // 見出し→リスト／リスト→見出しの変換時、安全性チェック
    // メタが無いノードは安全性チェックをスキップ（新規作成ノード想定）
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

          // まず既存のマーカーをすべて削除
          newText = newText.replace(/^#+\s*/, ''); // 見出しマーカー削除
          newText = newText.replace(/^[\s]*[-*+]\s*/, ''); // リストマーカー削除
          newText = newText.replace(/^[\s]*\d+\.\s*/, ''); // 順序ありリストマーカー削除

          if (newType === 'heading') {
            // リスト → 見出しに変更（賢いレベル設定）
            let targetLevel = 1;
            
            // 親ノードが見出しの場合、その子レベルとして設定
            if (parentNode && parentNode.markdownMeta?.type === 'heading') {
              targetLevel = Math.min((parentNode.markdownMeta.level || 1) + 1, 6);
            } else if (currentMeta.level) {
              // 既存のレベルを維持
              targetLevel = Math.min(currentMeta.level, 6);
            }
            
            newMeta = {
              type: 'heading',
              level: targetLevel,
              originalFormat: '#'.repeat(targetLevel),
              indentLevel: 0,
              lineNumber: currentMeta.lineNumber
            };
            // マーカーはNodeEditorで表示されるので、textには追加しない
          } else if (newType === 'unordered-list') {
            // 見出し/順序ありリスト → 順序なしリスト
            // 既定はトップレベル（見出し直下/ルート直下）のリストとして level=1, indent=0
            let targetLevel = 1;
            // 親がリストなら親+1の深さにする
            if (parentNode && (parentNode.markdownMeta?.type === 'unordered-list' || parentNode.markdownMeta?.type === 'ordered-list')) {
              targetLevel = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
            }
            
            newMeta = {
              type: 'unordered-list',
              level: targetLevel,
              originalFormat: '-',
              // indentLevel はスペース数（1レベル=2スペース）。見出し直下は0。
              indentLevel: Math.max(targetLevel - 1, 0) * 2,
              lineNumber: currentMeta.lineNumber
            };
            // マーカーはNodeEditorで表示されるので、textには追加しない
          } else if (newType === 'ordered-list') {
            // 見出し/順序なしリスト → 順序ありリスト
            // 既定はトップレベル（見出し直下/ルート直下）のリストとして level=1, indent=0
            let targetLevel = 1;
            // 親がリストなら親+1の深さにする
            if (parentNode && (parentNode.markdownMeta?.type === 'unordered-list' || parentNode.markdownMeta?.type === 'ordered-list')) {
              targetLevel = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
            }
            
            newMeta = {
              type: 'ordered-list',
              level: targetLevel,
              originalFormat: '1.',
              // indentLevel はスペース数（1レベル=2スペース）。見出し直下は0。
              indentLevel: Math.max(targetLevel - 1, 0) * 2,
              lineNumber: currentMeta.lineNumber
            };
            // マーカーはNodeEditorで表示されるので、textには追加しない
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

  /**
   * リストタイプを変更（順序なし↔順序あり）
   */
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
            newFormat = '1.'; // 後で番号は再計算される
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

  /**
   * リスト項目の番号を再計算（順序ありリストの場合）
   */
  static renumberOrderedLists(nodes: MindMapNode[]): MindMapNode[] {
    const processNodes = (nodeList: MindMapNode[], parentLevel: number = 0): MindMapNode[] => {
      let orderedListCounter = 1;
      
      return nodeList.map((node: MindMapNode) => {
        const markdownMeta = node.markdownMeta;

        if (markdownMeta && markdownMeta.type === 'ordered-list') {
          // 順序ありリストの番号を更新
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
          // 順序ありリスト以外は番号をリセット
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

  /**
   * ノードの位置を階層構造に基づいて調整
   */
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
      horizontalSpacing = 250,
      verticalSpacing = 100
    } = options;

    let currentY = startY;

    const positionNodeAndChildren = (
      node: MindMapNode,
      x: number,
      y: number,
      level: number = 0
    ): number => {
      // 現在のノードの位置を設定
      node.x = x;
      node.y = y;

      let nextChildY = y;

      if (node.children && node.children.length > 0) {
        const childX = x + horizontalSpacing;

        // 子ノードを配置
        for (const child of node.children) {
          nextChildY = positionNodeAndChildren(child, childX, nextChildY, level + 1);
          nextChildY += verticalSpacing;
        }

        // 親ノードを子ノードの中央に配置
        if (node.children.length > 1) {
          const firstChildY = node.children[0].y;
          const lastChildY = node.children[node.children.length - 1].y;
          node.y = (firstChildY + lastChildY) / 2;
        }

        return nextChildY - verticalSpacing; // 最後の間隔を戻す
      }

      return y;
    };

    // ルートノードを配置
    for (const rootNode of nodes) {
      currentY = positionNodeAndChildren(rootNode, startX, currentY);
      currentY += verticalSpacing * 2; // ルートノード間の間隔を広く
    }
  }
}
