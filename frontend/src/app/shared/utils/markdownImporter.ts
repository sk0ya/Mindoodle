import { type MindMapNode, createNewNode } from '../types/dataTypes';
import { logger } from './logger';

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
      logger.warn('⚠️ 構造要素が見つかりません。マークダウンファイルには少なくとも1つの見出しまたはリストが必要です。');
      throw new Error('マークダウンファイルに構造要素が見つかりません。少なくとも1つの見出し（# 見出し）またはリストを追加してください。');
    }

    // 見出しレベル情報を抽出
    const headingLevelByText: Record<string, number> = {};
    elements.forEach(element => {
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
   * 構造要素リストからノード階層を構築
   * 見出しが親、リストがその子という正しい階層関係を構築
   */
  private static buildNodeHierarchy(elements: StructureElement[]): MindMapNode[] {
    const rootNodes: MindMapNode[] = [];
    const headingStack: { node: MindMapNode; level: number }[] = [];
    let currentHeading: MindMapNode | null = null;

    for (const element of elements) {
      const newNode = createNewNode(element.text);
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

      if (element.type === 'heading') {
        // 見出しの場合：階層に基づいて親子関係を決定

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
        // リスト項目の場合：現在の見出しの下に配置

        if (currentHeading) {
          // 現在の見出しの子として追加
          currentHeading.children = currentHeading.children || [];

          // リストのインデントレベルに基づいて親子関係を決定
          this.addListItemToHeading(currentHeading, newNode, element.indentLevel || 0);
        } else {
          // 見出しがない場合はルートに追加（稀なケース）
          rootNodes.push(newNode);
        }
      }
    }

    return rootNodes;
  }

  /**
   * 見出しの下にリスト項目を適切な階層で追加
   */
  private static addListItemToHeading(
    headingNode: MindMapNode,
    listNode: MindMapNode,
    indentLevel: number
  ): void {
    if (indentLevel === 0) {
      // インデントなし：見出しの直接の子
      headingNode.children = headingNode.children || [];
      headingNode.children.push(listNode);
    } else {
      // インデントあり：適切な親リスト項目を探す
      const findParentListItem = (
        children: MindMapNode[],
        targetIndent: number
      ): MindMapNode | null => {
        for (let i = children.length - 1; i >= 0; i--) {
          const child = children[i];
          const childMeta = child.markdownMeta;

          if (childMeta &&
              (childMeta.type === 'unordered-list' || childMeta.type === 'ordered-list') &&
              (childMeta.indentLevel || 0) < targetIndent) {
            return child;
          }

          // 子ノードの中も探す
          if (child.children && child.children.length > 0) {
            const found = findParentListItem(child.children, targetIndent);
            if (found) return found;
          }
        }
        return null;
      };

      const parentListItem = findParentListItem(headingNode.children || [], indentLevel);

      if (parentListItem) {
        parentListItem.children = parentListItem.children || [];
        parentListItem.children.push(listNode);
      } else {
        // 適切な親が見つからない場合は見出しの直接の子として追加
        headingNode.children = headingNode.children || [];
        headingNode.children.push(listNode);
      }
    }
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

    const processNode = (node: MindMapNode, parentLevel: number = 0) => {
      const markdownMeta = node.markdownMeta;

      if (DEBUG_MD) {
        logger.debug('📄 processNode', {
          nodeId: node.id,
          text: node.text,
          hasMarkdownMeta: !!markdownMeta,
          markdownMeta: markdownMeta,
          parentLevel: parentLevel
        });
      }

      if (markdownMeta) {
        // 現在のtypeに基づいて動的にフォーマットを生成
        let prefix = '';

        if (markdownMeta.type === 'heading') {
          // 見出しの場合：levelに基づいて#の数を決定
          prefix = '#'.repeat(markdownMeta.level) + ' ';
        } else if (markdownMeta.type === 'unordered-list') {
          // 順序なしリストの場合：インデントレベルに基づいて-を配置
          const indent = ' '.repeat(markdownMeta.indentLevel || 0);
          prefix = indent + '- ';
        } else if (markdownMeta.type === 'ordered-list') {
          // 順序ありリストの場合：インデントレベルに基づいて番号を配置
          const indent = ' '.repeat(markdownMeta.indentLevel || 0);
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
      
      // ノートがある場合は追加
      if (node.note && node.note.trim()) {
        lines.push('');
        lines.push(node.note);
        lines.push('');
      }
      
      // 子ノードを処理
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
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

          processNode(child, childParentLevel);
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
    return nodes.map(node => {
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
        type: markdownMeta.type,
        level: markdownMeta.level,
        originalFormat: markdownMeta.originalFormat,
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
      return nodeList.map(node => {
        if (node.id === nodeId && node.markdownMeta) {
          const meta = node.markdownMeta;

          if (meta.type === 'heading') {
            // 見出しレベルの変更
            let newLevel = meta.level;

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
            let newLevel = meta.level;

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
   * リストタイプを変更（順序なし↔順序あり）
   */
  static changeListType(
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'unordered-list' | 'ordered-list'
  ): MindMapNode[] {
    const updateListType = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map(node => {
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
      
      return nodeList.map(node => {
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

  /**
   * ノードのレベルに応じた色付けを追加
   */
  static applyMarkdownStyling(nodes: MindMapNode[]): MindMapNode[] {
    const applyStyle = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map(node => {
        if (node.markdownMeta) {
          const meta = node.markdownMeta;
          let styledNode = { ...node };

          // 見出しレベルに応じたスタイリング
          if (meta.type === 'heading') {
            switch (meta.level) {
              case 1:
                styledNode.fontSize = 24;
                styledNode.fontWeight = 'bold';
                styledNode.color = '#2563eb'; // 青
                break;
              case 2:
                styledNode.fontSize = 20;
                styledNode.fontWeight = 'bold';
                styledNode.color = '#7c3aed'; // 紫
                break;
              case 3:
                styledNode.fontSize = 18;
                styledNode.fontWeight = 'bold';
                styledNode.color = '#059669'; // 緑
                break;
              default:
                styledNode.fontSize = 16;
                styledNode.fontWeight = 'bold';
                styledNode.color = '#dc2626'; // 赤
            }
          } else if (meta.type === 'ordered-list') {
            styledNode.color = '#ea580c'; // オレンジ
          } else if (meta.type === 'unordered-list') {
            styledNode.color = '#6b7280'; // グレー
          }

          if (node.children && node.children.length > 0) {
            styledNode.children = applyStyle(node.children);
          }

          return styledNode;
        }

        // マークダウンメタデータがない場合はそのまま
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: applyStyle(node.children)
          };
        }

        return node;
      });
    };

    return applyStyle(nodes);
  }
}
