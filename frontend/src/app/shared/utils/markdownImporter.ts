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
  /**
   * マークダウンをパースしてMindMapNode構造に変換
   */
  static parseMarkdownToNodes(markdownText: string): { rootNodes: MindMapNode[]; headingLevelByText: Record<string, number> } {
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
      logger.warn('⚠️ 見出しが見つかりません。マークダウンファイルには少なくとも1つの見出し（# 見出し）が必要です。');
      throw new Error('マークダウンファイルに見出しが見つかりません。少なくとも1つの見出し（# 見出し）を追加してください。');
    }

    // 見出しレベル情報を抽出
    const headingLevelByText: Record<string, number> = {};
    headings.forEach(heading => {
      if (!(heading.text in headingLevelByText)) {
        headingLevelByText[heading.text] = heading.level;
      }
    });

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

    return { rootNodes, headingLevelByText };
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
      
      // Store original heading level in the node
      (newNode as any).originalHeadingLevel = heading.level;

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
