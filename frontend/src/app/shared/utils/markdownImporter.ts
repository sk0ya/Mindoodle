import { type MindMapNode, createNewNode } from '../types/dataTypes';
import { logger } from './logger';
const DEBUG_MD = (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === '1' || (import.meta as any)?.env?.VITE_DEBUG_MARKDOWN === 'true';

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
  // 公開API: 見出し一覧を取得（レベル・テキスト・内容）
  static parseHeadings(markdownText: string): { level: number; text: string; content: string }[] {
    const lines = markdownText.split('\n');
    // 既存のロジックを使用
    // @ts-ignore - using private method implementation inline
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
          content: ''
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
   * マークダウンテキストをパースしてMindMapNode構造に変換
   */
  static parseMarkdownToNodes(markdownText: string): MindMapNode {
    if (DEBUG_MD) {
      logger.debug('🔍 マークダウンパース開始', { 
        textLength: markdownText.length, 
        firstLine: markdownText.split('\n')[0] 
      });
    }
    
    const lines = markdownText.split('\n');
    const headings = this.extractHeadings(lines);
    
    if (DEBUG_MD) {
      logger.debug('📝 見出し抽出結果', { 
        headingsCount: headings.length,
        headings: headings.map(h => ({ level: h.level, text: h.text }))
      });
    }
    
    if (headings.length === 0) {
      // 見出しがない場合は全体を1つのノートとする
      logger.info('⚠️ 見出しが見つからないため、全体をノートとして処理');
      const rootNode = createNewNode('インポートされた内容');
      rootNode.id = 'root';
      rootNode.note = markdownText;
      return rootNode;
    }
    
    // 階層構造を正規化
    const normalizedHeadings = this.normalizeHeadingHierarchy(headings);
    if (DEBUG_MD) {
      logger.debug('🔄 階層正規化結果', { 
        normalizedCount: normalizedHeadings.length,
        normalized: normalizedHeadings.map(h => ({ level: h.level, text: h.text }))
      });
    }
    
    // ノード構造を構築
    const result = this.buildNodeHierarchy(normalizedHeadings);
    if (DEBUG_MD) {
      logger.debug('🏗️ ノード構築結果', { 
        rootText: result.text,
        childrenCount: result.children?.length || 0,
        result
      });
    }
    
    return result;
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
        // 前の見出しが存在する場合、その内容を保存
        if (currentHeading) {
          currentHeading.content = currentContent.join('\n').trim();
          headings.push(currentHeading);
        }
        
        // 新しい見出しを開始
        currentHeading = {
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          content: ''
        };
        currentContent = [];
      } else {
        // 見出し以外の行は現在の見出しの内容として蓄積
        currentContent.push(line);
      }
    }
    
    // 最後の見出しの内容を保存
    if (currentHeading) {
      currentHeading.content = currentContent.join('\n').trim();
      headings.push(currentHeading);
    }
    
    return headings;
  }
  
  /**
   * 見出し階層を正規化（階層の欠落を空ノードで補完）
   */
  private static normalizeHeadingHierarchy(headings: ParsedHeading[]): ParsedHeading[] {
    // 余計な空ノードは作らず、抽出結果をそのまま返す
    return headings;
  }
  
  /**
   * 正規化された見出しリストからノード階層を構築
   */
  private static buildNodeHierarchy(headings: ParsedHeading[]): MindMapNode {
    if (headings.length === 0) {
      const root = createNewNode('');
      root.id = 'root';
      root.children = [];
      return root;
    }

    // 左→右に走査しながら、その時点の最小レベル(currentMin)を更新する。
    // ルートは「currentMin と同じレベルの見出し」すべて。
    let currentMin = headings[0].level; // 先頭見出しが基準
    const root = createNewNode('');
    root.id = 'root';
    root.children = [];

    // 現在の currentMin に対するスタック（正規化レベルで保持）
    let stack: { node: MindMapNode; level: number }[] = [];

    const startNewRoot = (h: ParsedHeading) => {
      const newRootNode = createNewNode(h.text);
      if (h.content) newRootNode.note = h.content;
      root.children.push(newRootNode);
      stack = [{ node: newRootNode, level: 1 }];
    };

    for (const h of headings) {
      if (h.level < currentMin) {
        // より浅い見出しが出現 -> currentMin 更新、これもルート
        currentMin = h.level;
        startNewRoot(h);
        continue;
      }
      if (h.level === currentMin) {
        // 現在の最小レベルと同じ -> ルート
        startNewRoot(h);
        continue;
      }

      // 子孫レベル
      const level = Math.max(2, h.level - currentMin + 1);
      const newNode = createNewNode(h.text);
      if (h.content) newNode.note = h.content;

      // 適切な親をスタックから求める
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]?.node;
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(newNode);
      } else {
        // 念のため、親がいない場合はルート直下に置く
        root.children.push(newNode);
      }
      stack.push({ node: newNode, level });
    }

    return root;
  }
}
