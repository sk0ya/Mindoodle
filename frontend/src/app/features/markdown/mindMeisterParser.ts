

import { MindMapNode } from '@shared/types';
import { generateId } from '@shared/utils';

interface ParsedNode {
  text: string;
  level: number;
  children: ParsedNode[];
  isCheckbox?: boolean;
  isChecked?: boolean;
}


export function parseMindMeisterMarkdown(markdown: string): MindMapNode | null {
  const lines = markdown.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return null;
  }

  // 最初の行からタイトルを抽出（# [タイトル](URL) 形式）
  const firstLine = lines[0].trim();
  let rootText = '';
  
  // MindMeisterのリンク形式を解析
  const linkRe = /^#\s*\[(.*?)\]/;
  const linkMatch = linkRe.exec(firstLine);
  if (linkMatch) {
    rootText = linkMatch[1];
  } else {
    // 通常のマークダウンヘッダー形式
    const headerRe = /^#+\s*(.+)/;
    const headerMatch = headerRe.exec(firstLine);
    rootText = headerMatch ? headerMatch[1] : firstLine;
  }

  // まず全行からインデントレベルを抽出して階層構造を判定
  const getAllIndentLevels = (lines: string[]): number[] => {
    const levels: number[] = [];
    for (const line of lines.slice(1)) { // 最初の行（タイトル）は除外
      const indentRe = /^(\s*)-\s*(.+)/;
      const indentMatch = indentRe.exec(line);
      if (indentMatch) {
        levels.push(indentMatch[1].length);
      }
    }
    return [...new Set(levels)].sort((a, b) => a - b); // 重複削除してソート
  };

  const indentLevels = getAllIndentLevels(lines);
  
  // 残りの行を解析してツリー構造を構築
  const parseTree = (lines: string[], startIndex: number): ParsedNode[] => {
    const nodes: ParsedNode[] = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      
      // インデントレベルを計算（trimしない）
      const indentRe = /^(\s*)-\s*(.+)/;
      const indentMatch = indentRe.exec(line);
      if (!indentMatch) {
        i++;
        continue;
      }

      // インデントスペース数から実際のレベルを算出
      const indentSpaces = indentMatch[1].length;
      const indentLevel = indentLevels.indexOf(indentSpaces);
      let nodeText = indentMatch[2];

      // チェックボックスパターンを検出
      let isCheckbox = false;
      let isChecked = false;
      const checkboxRe = /^\[([ xX])\]\s*(.*)$/;
      const checkboxMatch = checkboxRe.exec(nodeText);
      if (checkboxMatch) {
        isCheckbox = true;
        isChecked = checkboxMatch[1].toLowerCase() === 'x';
        nodeText = checkboxMatch[2]; 
      }

      const node: ParsedNode = {
        text: nodeText,
        level: indentLevel,
        children: [],
        isCheckbox,
        isChecked
      };

      
      let j = i + 1;
      const childLines: string[] = [];
      
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextIndentRe = /^(\s*)-\s*(.+)/;
        const nextIndentMatch = nextIndentRe.exec(nextLine);
        
        if (nextIndentMatch) {
          const nextIndentSpaces = nextIndentMatch[1].length;
          const nextIndentLevel = indentLevels.indexOf(nextIndentSpaces);
          
          if (nextIndentLevel > indentLevel) {
            childLines.push(lines[j]);
            j++;
          } else {
            break;
          }
        } else {
          j++;
        }
      }

      
      if (childLines.length > 0) {
        node.children = parseTree(childLines, 0);
      }

      nodes.push(node);
      i = j;
    }

    return nodes;
  };

  
  const childNodes = parseTree(lines.slice(1), 0);

  
  const convertToMindMapNode = (parsedNode: ParsedNode): MindMapNode => {
    const node: MindMapNode = {
      id: generateId(),
      text: parsedNode.text,
      x: 0,
      y: 0,
      children: parsedNode.children.map(convertToMindMapNode),
      collapsed: false,
      fontSize: 16,
      fontWeight: 'normal',
      color: '#333333'
    };

    
    if (parsedNode.isCheckbox) {
      node.markdownMeta = {
        type: 'unordered-list',
        level: 1,
        originalFormat: '-',
        indentLevel: 0,
        lineNumber: -1,
        isCheckbox: true,
        isChecked: parsedNode.isChecked || false
      };
    }

    return node;
  };

  
  const rootNode: MindMapNode = {
    id: generateId(),
    text: rootText,
    x: 0,
    y: 0,
    children: childNodes.map(convertToMindMapNode),
    collapsed: false,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333'
  };

  return rootNode;
}


export function isMindMeisterFormat(text: string): boolean {
  const lines = text.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) return false;
  
  
  const firstLine = lines[0].trim();
  const mmLinkRe = /^#\s*\[.*?\]\(https?:\/\/.*mindmeister\.com.*\)/;
  if (mmLinkRe.exec(firstLine)) return true;
  
  
  const listRe = /^\s*-\s+.+/;
  const headerRe2 = /^#+\s+.+/;
  const hasListItems = lines.some(line => listRe.exec(line.trim()));
  const hasHeader = Boolean(headerRe2.exec(lines[0]));
  
  return hasHeader && hasListItems;
}
