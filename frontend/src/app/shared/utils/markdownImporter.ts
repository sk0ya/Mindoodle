import { type MindMapNode, createNewNode } from '../types/dataTypes';
import { logger } from './logger';

const DEBUG_MD =
  (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === '1' ||
  (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === 'true';

/**
 * マークダウンの見出し行を解析
 */
interface ParsedHeading {
  level: number;
  text: string;
  content: string;
}

/**
 * マークダウンテキストを解析してノード階層に変換
 */
export class MarkdownImporter {
  /**
   * マークダウンをパースしてMindMapNode構造に変換
   */
  static parseMarkdownToNodes(markdownText: string): { rootNodes: MindMapNode[] } {
    if (DEBUG_MD) {
      logger.debug('🔍 マークダウンパース開始', {
        textLength: markdownText.length,
        firstLine: markdownText.split('\n')[0],
      });
    }

    const lines = markdownText.split('\n');
    const headings = this.extractHeadings(lines);

    if (DEBUG_MD) {
      logger.debug('📝 見出し抽出結果', {
        headingsCount: headings.length,
        headings: headings.map((h) => ({ level: h.level, text: h.text })),
      });
    }

    if (headings.length === 0) {
      logger.info('⚠️ 見出しが見つからないため、全体をノートとして処理');
      const rootNode = createNewNode('インポートされた内容');
      rootNode.id = 'root';
      rootNode.note = markdownText;
      return { rootNodes: [rootNode] };
    }

    // ノード構造を構築
    const rootNodes = this.buildNodeHierarchy(headings);

    if (DEBUG_MD) {
      logger.debug('🏗️ ノード構築結果', {
        rootCount: rootNodes.length,
        roots: rootNodes.map((r) => ({
          text: r.text,
          childrenCount: r.children?.length || 0,
        })),
      });
    }

    return { rootNodes };
  }

  /**
   * マークダウンから見出しとその内容を抽出
   */
  private static extractHeadings(lines: string[]): ParsedHeading[] {
    const headings: ParsedHeading[] = [];
    let currentContent: string[] = [];
    let currentHeading: ParsedHeading | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentHeading) {
          currentHeading.content = currentContent.join('\n').trim();
          headings.push(currentHeading);
        }

        currentHeading = {
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          content: '',
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentHeading) {
      currentHeading.content = currentContent.join('\n').trim();
      headings.push(currentHeading);
    }

    return headings;
  }

  /**
   * 見出しリストからノード階層を構築
   * - ルートは「自分より前にレベルが高い見出しがないノード」
   * - レベルは変更しない
   */
  private static buildNodeHierarchy(headings: ParsedHeading[]): MindMapNode[] {
    const rootNodes: MindMapNode[] = [];
    const stack: { node: MindMapNode; level: number }[] = [];

    for (const heading of headings) {
      const newNode = createNewNode(heading.text);
      if (heading.content) newNode.note = heading.content;
      newNode.children = [];

      // スタックから自分より同じか深いレベルをポップ
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // 親がいない → ルートノード
        rootNodes.push(newNode);
      } else {
        // 親がいる → 子として追加
        const parent = stack[stack.length - 1].node;
        parent.children = parent.children || [];
        parent.children.push(newNode);
      }

      // スタックに積む
      stack.push({ node: newNode, level: heading.level });
    }

    return rootNodes;
  }
}
