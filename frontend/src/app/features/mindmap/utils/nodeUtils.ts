import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '../../../core/data/normalizedStore';
import { hasInternalMarkdownLinks, extractExternalLinksFromMarkdown } from '../../markdown/markdownLinkUtils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import { stripInlineMarkdown, parseInlineMarkdown } from '../../markdown/parseInlineMarkdown';


interface IconLayout {
  totalWidth: number; 
  linkIcon?: {
    x: number; 
    y: number; 
  };
}

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

const NODE_TEXT_MIN_WIDTH = 160;
const NODE_TEXT_BASE_MAX_WIDTH = 240;
const NODE_TEXT_LINE_HEIGHT_RATIO = 1.35;

export const TEXT_ICON_SPACING = 1;

interface RawTextToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  isMarker?: boolean;
}

export interface WrappedToken extends RawTextToken {
  width: number;
}

export interface WrappedLine {
  tokens: WrappedToken[];
  width: number;
  rawText: string;
}

export interface WrapNodeTextResult {
  lines: WrappedLine[];
  maxLineWidth: number;
  lineHeight: number;
  textHeight: number;
}

export interface WrapNodeTextOptions {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  maxWidth: number;
  prefixTokens?: RawTextToken[];
}

export interface NodeTextWrapConfig {
  enabled: boolean;
  maxWidth: number;
}

type NodeTextWrapSettingsLike = Partial<{
  nodeTextWrapEnabled: boolean;
  nodeTextWrapWidth: number;
}>;

export function resolveNodeTextWrapConfig(settings?: NodeTextWrapSettingsLike, fontSize: number = 14): NodeTextWrapConfig {
  const enabled = settings?.nodeTextWrapEnabled !== false;
  const width = Math.max(NODE_TEXT_MIN_WIDTH, settings?.nodeTextWrapWidth ?? getNodeTextMaxWidth(fontSize));
  return {
    enabled,
    maxWidth: width
  };
}


let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

function ensureMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    
    measureCanvas.style.position = 'absolute';
    measureCanvas.style.left = '-9999px';
    measureCanvas.style.top = '-9999px';
    measureCanvas.style.visibility = 'hidden';
    measureCanvas.width = 1;
    measureCanvas.height = 1;
    
    measureContext = measureCanvas.getContext('2d');
    
    if (!measureContext) {
      return null;
    }
    
    
    measureContext.font = '14px system-ui, -apple-system, sans-serif';
    measureContext.textBaseline = 'alphabetic';
    measureContext.textAlign = 'left';
  }
  return measureContext;
}

export function measureTextWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number {
  
  if (!text) return 0;
  
  
  const context = ensureMeasureContext();
  
  if (!context) {
    
    return calculateTextWidthFallback(text) * fontSize * 0.6;
  }
  
  
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.font = fontString;
  
  
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  
  
  const metrics = context.measureText(text);
  return metrics.width;
}

function calculateTextWidthFallback(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    
    if (
      
      (code >= 0x3040 && code <= 0x309F) || 
      (code >= 0x30A0 && code <= 0x30FF) || 
      (code >= 0x4E00 && code <= 0x9FAF) || 
      
      (code >= 0xFF00 && code <= 0xFFEF) ||
      
      code > 0x007F
    ) {
      width += 2; 
    } else {
      width += 1; 
    }
  }
  return width;
}

export function getNodeTextLineHeight(fontSize: number): number {
  const computed = fontSize * NODE_TEXT_LINE_HEIGHT_RATIO;
  return Math.max(computed, fontSize + 6);
}

export function getNodeTextMaxWidth(fontSize: number): number {
  const dynamicWidth = NODE_TEXT_BASE_MAX_WIDTH + (fontSize - 14) * 12;
  return Math.max(NODE_TEXT_MIN_WIDTH, dynamicWidth);
}

export function getNodeHorizontalPadding(textLength: number, isEditing: boolean): number {
  if (isEditing) {
    return 34;
  }
  const basePadding = 12;
  const textLengthFactor = Math.min(textLength / 25, 1);
  const additionalPadding = textLengthFactor * 13;
  return basePadding + additionalPadding;
}


// High-priority break characters: Japanese and English punctuation marks
// These are the ideal positions for line breaks
const PRIMARY_BREAK_CHARS = new Set<string>([
  // Japanese punctuation (highest priority)
  '、','。',
  // English punctuation (high priority)
  ',','.',
  // Other Japanese punctuation
  '，','．','！','？','：','；','）','』','】','〉','》',']','）','｝','〕','〗','〙','〛',
  // Other English punctuation
  ')','!','?',':',';'
]);

// Secondary break characters: moderate priority for breaks
const SECONDARY_BREAK_CHARS = new Set<string>([
  // Brackets and quotes (can break after these)
  '」','』','）','】','〕','〉',
  ')',']','}','>',
  // Conjunctions and connectors
  'で','が','も','や','と','か','し','て','に','を','は','の'
]);

// Break-before characters: characters that should have a line break BEFORE them
// These are typically opening brackets and quotes
const BREAK_BEFORE_CHARS = new Set<string>([
  // Japanese opening brackets and quotes
  '（','「','『','【','〈','《','〔','〖','〘','〚','｛','［',
  // English opening brackets
  '(','[','{'
]);

function isPrimaryBreak(char: string): boolean {
  if (!char || char.length === 0) return false;
  return PRIMARY_BREAK_CHARS.has(char);
}

function isSecondaryBreak(char: string): boolean {
  if (!char || char.length === 0) return false;
  return SECONDARY_BREAK_CHARS.has(char);
}

function isBreakBefore(char: string): boolean {
  if (!char || char.length === 0) return false;
  return BREAK_BEFORE_CHARS.has(char);
}




// シンプルなテキスト分割: 句読点と括弧を優先
function smartSplitText(text: string, formatting: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): RawTextToken[] {
  const pieces: RawTextToken[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      pieces.push({ text: buffer, ...formatting });
      buffer = '';
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // ホワイトスペース: 常に分割
    if (/\s/.test(char)) {
      flush();
      pieces.push({ text: char, ...formatting });
      continue;
    }

    // 句読点の後で分割（、。,. など）
    if (isPrimaryBreak(char) || isSecondaryBreak(char)) {
      buffer += char;
      flush();
      continue;
    }

    // 開き括弧の前で分割（(「【[ など）
    if (isBreakBefore(char)) {
      flush();
      buffer = char;
      continue;
    }

    buffer += char;
  }

  flush();
  return pieces;
}

export function wrapNodeText(text: string, options: WrapNodeTextOptions): WrapNodeTextResult {
  const { fontSize, fontFamily, fontWeight, fontStyle, maxWidth, prefixTokens } = options;

  const effectiveMaxWidth = Math.max(20, maxWidth);
  const lineHeight = getNodeTextLineHeight(fontSize);
  const tokens: RawTextToken[] = [];

  if (prefixTokens && prefixTokens.length > 0) {
    tokens.push(...prefixTokens);
  }

  const baseText = (text ?? '').replace(/\r\n/g, '\n');
  const segments = parseInlineMarkdown(baseText);

  const segmentTokens: RawTextToken[] = segments.flatMap(segment => {
    const pieces: RawTextToken[] = [];
    const normalized = segment.text.replace(/\r\n/g, '\n');
    const newlineSplit = normalized.split(/(\n)/);

    for (const piece of newlineSplit) {
      if (piece === '') continue;
      if (piece === '\n') {
        pieces.push({ text: '\n' });
        continue;
      }

      const splitPieces = smartSplitText(piece, {
        bold: segment.bold,
        italic: segment.italic,
        strikethrough: segment.strikethrough
      });
      pieces.push(...splitPieces);
    }

    return pieces;
  });

  tokens.push(...segmentTokens);

  const lines: WrappedLine[] = [];
  let currentTokens: WrappedToken[] = [];
  let currentWidth = 0;

  const measureWidth = (value: string): number => {
    if (!value) return 0;
    return measureTextWidth(value, fontSize, fontFamily, fontWeight, fontStyle);
  };

  const pushLine = () => {
    // 末尾の空白を削除
    while (currentTokens.length > 0 && /^\s+$/.test(currentTokens[currentTokens.length - 1].text) && !currentTokens[currentTokens.length - 1].isMarker) {
      currentWidth -= currentTokens[currentTokens.length - 1].width;
      currentTokens.pop();
    }

    const clonedTokens = currentTokens.map(t => ({ ...t }));
    const rawText = clonedTokens.map(t => t.text).join('');
    lines.push({ tokens: clonedTokens, width: currentWidth, rawText });
    currentTokens = [];
    currentWidth = 0;
  };

  // トークンを行に配置
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // 改行
    if (token.text === '\n') {
      pushLine();
      continue;
    }

    // マーカーは幅0
    const width = token.isMarker ? 0 : measureWidth(token.text);
    const wrappedToken: WrappedToken = { ...token, width };

    // 空白の処理
    const isWhitespace = /^\s+$/.test(token.text);

    // 行頭の空白はスキップ
    if (currentTokens.length === 0 && isWhitespace && !token.isMarker) {
      continue;
    }

    // 次のトークンが括弧で始まる場合、空白で改行
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (isWhitespace && nextToken && nextToken.text.length > 0 && isBreakBefore(nextToken.text[0])) {
      if (currentTokens.length > 0) {
        pushLine();
      }
      continue;
    }

    // トークンを追加できるか確認
    const wouldFit = currentWidth + width <= effectiveMaxWidth;

    if (wouldFit || currentTokens.length === 0) {
      // 追加
      currentTokens.push(wrappedToken);
      currentWidth += width;
    } else {
      // 幅を超える: 新しい行を開始

      // 長すぎるトークンは分割が必要
      if (width > effectiveMaxWidth && !isWhitespace && !token.isMarker) {
        // 括弧で始まるトークンは分割しない
        if (isBreakBefore(token.text[0])) {
          pushLine();
          currentTokens.push(wrappedToken);
          currentWidth += width;
          continue;
        }

        // CJKテキスト: 句読点で分割を試みる
        const chars = Array.from(token.text);
        let buffer = '';

        for (let j = 0; j < chars.length; j++) {
          const char = chars[j];
          const tentative = buffer + char;
          const tentativeWidth = measureWidth(tentative);

          if (tentativeWidth > effectiveMaxWidth && buffer) {
            // 分割ポイントを探す
            let breakPoint = buffer.length;

            // lookback: 句読点や括弧を探す
            for (let k = buffer.length - 1; k >= Math.max(0, buffer.length - 10); k--) {
              const c = buffer[k];
              if (isPrimaryBreak(c)) {
                breakPoint = k + 1; // 句読点の後
                break;
              }
              if (isBreakBefore(c)) {
                breakPoint = k; // 括弧の前
                break;
              }
            }

            // 分割
            const part = buffer.substring(0, breakPoint);
            if (part) {
              currentTokens.push({ ...token, text: part, width: measureWidth(part) });
              currentWidth += measureWidth(part);
            }

            pushLine();
            buffer = buffer.substring(breakPoint) + char;
          } else {
            buffer = tentative;
          }
        }

        if (buffer) {
          currentTokens.push({ ...token, text: buffer, width: measureWidth(buffer) });
          currentWidth += measureWidth(buffer);
        }
      } else {
        // 通常のトークン: 新しい行に配置
        pushLine();
        if (!isWhitespace || token.isMarker) {
          currentTokens.push(wrappedToken);
          currentWidth += width;
        }
      }
    }
  }

  if (currentTokens.length > 0 || lines.length === 0) {
    pushLine();
  }

  const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.width), 0);
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);

  return {
    lines,
    maxLineWidth,
    lineHeight,
    textHeight
  };
}

export function getMarkerPrefixTokens(node: MindMapNode): RawTextToken[] {
  const meta = node.markdownMeta;
  if (!meta) {
    return [];
  }

  let marker = '';
  if (meta.type === 'heading') {
    marker = '#';
  } else if (meta.type === 'unordered-list') {
    marker = '-';
  } else if (meta.type === 'ordered-list') {
    marker = '1.';
  }

  if (!marker) {
    return [];
  }

  return [
    { text: marker, isMarker: true },
    { text: ' ', isMarker: true }
  ];
}

export function calculateIconLayout(node: MindMapNode, nodeWidth: number): IconLayout {
  const noteStr = node.note;
  const hasLinks = hasInternalMarkdownLinks(noteStr) || (extractExternalLinksFromMarkdown(noteStr).length > 0);
  
  
  const ICON_WIDTH = 22;
  const ICON_HEIGHT = 14;
  const RIGHT_MARGIN = 2; 
  
  let totalWidth = 0;
  let linkIcon: { x: number; y: number } | undefined;
  
  if (hasLinks) {
    
    totalWidth = ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;

    linkIcon = { x: startX, y: -ICON_HEIGHT / 2 };
  }
  
  return {
    totalWidth,
    linkIcon
  };
}

export function calculateNodeSize(
  node: MindMapNode,
  editText?: string,
  isEditing: boolean = false,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): NodeSize {
  
  if (node.kind === 'table') {
    
    if (node.customImageWidth && node.customImageHeight) {
      const contentWidth = node.customImageWidth;
      const contentHeight = node.customImageHeight;
      
      const padding = 10;
      return {
        width: contentWidth + padding,
        height: contentHeight + padding,
        imageHeight: contentHeight
      };
    }

    
    const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
      if (!src) return null;
      const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
      for (let i = 0; i < lines.length - 1; i++) {
        const header = lines[i];
        const sep = lines[i + 1];
        const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
        // Determine if separator line looks like Markdown table separator
        const parts = sep.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
        const isSep = parts.length > 0 && parts.every(cell => /^:?-{3,}:?$/.test(cell));
        if (isHeader && isSep) {
          const outRows: string[][] = [];
          const toCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
          const headers = toCells(header);
          outRows.push(headers);
          let j = i + 2;
          while (j < lines.length && lines[j].includes('|')) {
            outRows.push(toCells(lines[j]));
            j++;
          }
          return { headers, rows: outRows.slice(1) };
        }
      }
      return null;
    };

    let parsed = parseTableFromString(node.text) || parseTableFromString(node.note);
    if (!parsed) {
      const td = node.tableData;
      if (td && Array.isArray(td.rows)) {
        parsed = { headers: td.headers, rows: td.rows };
      }
    }

    // Calculate table dimensions based on actual content
    const calculateTableDimensions = (parsed: { headers?: string[]; rows: string[][] } | null): { width: number; height: number } => {
      if (!parsed) return { width: 200, height: 70 };

      // Get all rows (headers + data rows)
      const allRows: string[][] = [];
      if (parsed.headers) {
        allRows.push(parsed.headers);
      }
      allRows.push(...parsed.rows);

      if (allRows.length === 0) return { width: 200, height: 70 };

      // Calculate column widths
      // NodeRenderer CSS: padding: '12px 16px' = 32px total horizontal padding per cell
      const cellPadding = 32;
      const fontSize = (globalFontSize || 14) * 0.95; // NodeRenderer uses fontSize * 0.95
      const fontFamily = 'system-ui, -apple-system, sans-serif';
      const fontWeight = 'normal';

      const numCols = Math.max(...allRows.map(row => row.length));
      const columnWidths: number[] = [];

      // Calculate max width for each column
      for (let colIndex = 0; colIndex < numCols; colIndex++) {
        let maxCellWidth = 0;

        for (const row of allRows) {
          const cellText = row[colIndex] || '';
          const textWidth = measureTextWidth(cellText, fontSize, fontFamily, fontWeight, 'normal');
          maxCellWidth = Math.max(maxCellWidth, textWidth);
        }

        // Add padding to cell width
        columnWidths.push(maxCellWidth + cellPadding);
      }

      // Total width = sum of column widths + borders between columns
      const borderWidth = 1; // 1px border between columns (not applied to outer edges in the CSS)
      const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0) + (numCols - 1) * borderWidth;

      // Calculate height
      // NodeRenderer CSS: padding: '12px 16px', line-height: 1.5
      const rowHeight = 44; // Approximate: padding (24px) + text height (~20px for fontSize 13.3px)
      const totalRows = allRows.length;
      const tableHeight = Math.max(70, totalRows * rowHeight + 12);

      return { width: Math.max(150, tableWidth), height: tableHeight };
    };

    const { width: contentWidth, height: contentHeight } = calculateTableDimensions(parsed);

    const padding = 10; 
    const nodeWidth = contentWidth + padding;
    const nodeHeight = contentHeight + padding;

    return {
      width: nodeWidth,
      height: nodeHeight,
      imageHeight: contentHeight
    };
  }


  const noteStr = node.note || '';
  const hasNoteImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'\s>]+["'][^>]*>/i.test(noteStr) );
  const hasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
  const hasImages = hasNoteImages || hasMermaid;

  let imageHeight = 0;
  let imageWidth = 0;

  if (hasImages) {
    if (node.customImageWidth && node.customImageHeight) {
      imageWidth = node.customImageWidth;
      imageHeight = node.customImageHeight;
    } else {
      let noteW: number | null = null;
      let noteH: number | null = null;
      if (noteStr) {
        const tagRe = /<img[^>]*>/i;
        const tagMatch = tagRe.exec(noteStr);
        if (tagMatch) {
          const tag = tagMatch[0];
          const wRe = /\swidth=["']?(\d+)(?:px)?["']?/i;
          const hRe = /\sheight=["']?(\d+)(?:px)?["']?/i;
          const wMatch = wRe.exec(tag);
          const hMatch = hRe.exec(tag);
          if (wMatch && hMatch) {
            const w = parseInt(wMatch[1], 10);
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
              noteW = w;
              noteH = h;
            }
          }
        }
      }
      if (noteW && noteH) {
        imageWidth = noteW;
        imageHeight = noteH;
      } else {
        imageWidth = 150;
        imageHeight = 105;
      }
    }
  }

  const isMarkdownLink = (text: string): boolean => {
    const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
    return markdownLinkPattern.test(text);
  };

  const getDisplayTextFromMarkdownLink = (text: string): string => {
    const re = /^\[([^\]]*)\]\(([^)]+)\)$/;
    const m = re.exec(text);
    return m ? m[1] : text;
  };

  const resolvedEditText = editText ?? node.text;
  const baseDisplayText = isMarkdownLink(node.text) ? getDisplayTextFromMarkdownLink(node.text) : node.text;

  const displayText = isEditing ? resolvedEditText : baseDisplayText;
  const measurementText = isEditing ? resolvedEditText : stripInlineMarkdown(baseDisplayText);

  const fontSize = globalFontSize || node.fontSize || 14;
  const fontFamily = node.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontWeight = node.fontWeight || 'normal';
  const fontStyle = node.fontStyle || 'normal';

  const resolvedWrap = wrapConfig ?? resolveNodeTextWrapConfig(undefined, fontSize);
  const wrapEnabled = resolvedWrap.enabled !== false;
  const wrapMaxWidth = wrapEnabled ? Math.max(20, resolvedWrap.maxWidth) : Number.MAX_SAFE_INTEGER;

  const hasLinks = hasInternalMarkdownLinks(noteStr) || (extractExternalLinksFromMarkdown(noteStr).length > 0);
  const ICON_WIDTH = 22;
  const minIconWidth = hasLinks ? ICON_WIDTH : 0;

  const isCheckboxNode = node.markdownMeta?.isCheckbox;
  const checkboxSize = 16;
  const checkboxMargin = 8;
  const checkboxWidth = isCheckboxNode ? checkboxSize + checkboxMargin : 0;

  const paddingTextLength = displayText.length;
  const horizontalPadding = getNodeHorizontalPadding(paddingTextLength, isEditing);

  let textContentWidth = 0;
  let textBlockHeight = 0;

  if (isEditing) {
    const measuredWidth = measureTextWidth(measurementText, fontSize, fontFamily, fontWeight, fontStyle);
    const minWidth = fontSize * 8;
    textContentWidth = Math.max(measuredWidth, minWidth);
    textBlockHeight = Math.max(fontSize + 8, 22);
  } else {
    const markerTokens = getMarkerPrefixTokens(node);
    const wrapResult = wrapNodeText(displayText, {
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      maxWidth: wrapMaxWidth,
      prefixTokens: markerTokens
    });

    // Always use actual text width for optimal node sizing
    textContentWidth = wrapResult.maxLineWidth;
    textBlockHeight = wrapEnabled ? Math.max(wrapResult.textHeight, fontSize + 8) : Math.max(fontSize + 8, 22);
  }

  const textBasedWidth = Math.max(textContentWidth + horizontalPadding + checkboxWidth, Math.max(fontSize * 2, 24));
  const baseNodeHeight = isEditing ? Math.max(fontSize + 8, 22) : textBlockHeight;

  const imageBasedWidth = hasImages ? imageWidth + 10 : 0;
  let finalWidth;

  if (minIconWidth > 0) {
    const combinedWidth = textBasedWidth + minIconWidth + TEXT_ICON_SPACING;
    finalWidth = Math.max(combinedWidth, imageBasedWidth);
  } else {
    finalWidth = Math.max(textBasedWidth, imageBasedWidth);
  }

  const nodeWidth = finalWidth;
  const nodeHeight = baseNodeHeight + imageHeight;
  return {
    width: nodeWidth,
    height: nodeHeight,
    imageHeight
  };
}


export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

export function getNodeRightX(node: MindMapNode, nodeWidth: number): number {
  return node.x + nodeWidth / 2;
}

export function getNodeTopY(node: MindMapNode, nodeHeight: number): number {
  return node.y - nodeHeight / 2;
}

export function getNodeBottomY(node: MindMapNode, nodeHeight: number): number {
  return node.y + nodeHeight / 2;
}

export function getNodeBounds(node: MindMapNode, nodeSize: NodeSize) {
  return {
    left: getNodeLeftX(node, nodeSize.width),
    right: getNodeRightX(node, nodeSize.width),
    top: getNodeTopY(node, nodeSize.height),
    bottom: getNodeBottomY(node, nodeSize.height),
    centerX: node.x,
    centerY: node.y,
    width: nodeSize.width,
    height: nodeSize.height
  };
}

export function getToggleButtonPosition(
  node: MindMapNode,
  rootNode: MindMapNode,
  nodeSize?: NodeSize,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
) {
  
  const isRootNodeItself = node.id === rootNode.id;
  const isOnRight = isRootNodeItself ? true : node.x > rootNode.x;

  
  const actualNodeSize = nodeSize || calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);

  
  const fontSize = globalFontSize || 14;
  
  const base = Math.max(fontSize * 1.5, 20);


  const note = node.note || '';
  const hasMermaid = /```mermaid[\s\S]*?```/i.test(note);
  const isTable = node.kind === 'table';
  const isVisualHeavy = hasMermaid || isTable;

  let baseMargin = base;
  let widthAdjustment = 0;

  if (!isVisualHeavy) {
    
    if (actualNodeSize.imageHeight > 100) {
      baseMargin += Math.min((actualNodeSize.imageHeight - 100) * 0.08, 24); 
    }
    
    
    const baseWidth = fontSize * 4;
    
    widthAdjustment = Math.max(0, (actualNodeSize.width - baseWidth) * 0.04);
    widthAdjustment = Math.min(widthAdjustment, 20); 
  } else {
    
    baseMargin += 8;
  }

  
  const totalMargin = Math.min(Math.max(baseMargin + widthAdjustment, 12), 35);

  
  const nodeRightEdge = getNodeRightX(node, actualNodeSize.width);
  const nodeLeftEdge = getNodeLeftX(node, actualNodeSize.width);

  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;


  return { x: toggleX, y: toggleY };
}

export function getDynamicNodeSpacing(parentNodeSize: NodeSize, childNodeSize: NodeSize, _isRootChild: boolean = false): number {
  
  const toggleButtonWidth = 20; 
  const minToggleToChildSpacing = 15; 

  
  const baseSpacing = 30;

  
  const parentWidthFactor = Math.min(parentNodeSize.width / 100, 1) * 5; 
  const childWidthFactor = Math.min(childNodeSize.width / 100, 1) * 5;   

  
  const calculatedSpacing = baseSpacing + parentWidthFactor + childWidthFactor;
  const minRequiredSpacing = toggleButtonWidth + minToggleToChildSpacing;

  return Math.round(Math.max(calculatedSpacing, minRequiredSpacing));
}

export function calculateChildNodeX(
  parentNode: MindMapNode,
  childNodeSize: NodeSize,
  edgeToEdgeDistance: number,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): number {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize, wrapConfig);
  const parentRightEdge = getNodeRightX(parentNode, parentNodeSize.width);

  
  const basicChildLeftEdge = parentRightEdge + edgeToEdgeDistance;

  
  const togglePosition = getToggleButtonPosition(parentNode, parentNode, parentNodeSize, globalFontSize, wrapConfig);
  const toggleButtonWidth = 20; 
  const minToggleToChildSpacing = 15; 
  const requiredChildLeftEdge = togglePosition.x + toggleButtonWidth / 2 + minToggleToChildSpacing;

  
  const finalChildLeftEdge = Math.max(basicChildLeftEdge, requiredChildLeftEdge);
  const childCenterX = finalChildLeftEdge + childNodeSize.width / 2;

  return childCenterX;
}

export function getBranchColor(
  nodeId: string,
  normalizedData: NormalizedData,
  colorSetName?: string
): string {
  if (!normalizedData || !nodeId) return '#666';

  
  const isRootNode = !normalizedData.parentMap[nodeId];

  if (isRootNode) {
    
    return '#333';
  }

  
  let currentNodeId = nodeId;
  let branchRootId: string | null = null;
  let level = 0;

  while (currentNodeId) {
    const parentId = normalizedData.parentMap[currentNodeId];

    if (!parentId) {
      
      break;
    }

    level++;

    
    const parentIsRoot = !normalizedData.parentMap[parentId];

    if (parentIsRoot) {
      
      branchRootId = currentNodeId;
      break;
    }

    currentNodeId = parentId;
  }

  
  if (!branchRootId) return '#666';

  
  const parentOfBranchRoot = normalizedData.parentMap[branchRootId];
  if (!parentOfBranchRoot) return '#666';

  const rootChildren = normalizedData.childrenMap[parentOfBranchRoot] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);

  if (branchIndex < 0) return '#666';

  
  const colorSet = getColorSetColors(colorSetName || 'vibrant');
  const baseColor = colorSet[branchIndex % colorSet.length];
  const branchColors = generateBranchColors(baseColor);

  
  if (nodeId === branchRootId) {
    return branchColors[0]; 
  }

  
  const parentId = normalizedData.parentMap[nodeId];
  if (!parentId) return '#666';

  if (parentId === branchRootId) {
    
    const siblings = normalizedData.childrenMap[parentId] || [];
    const siblingIndex = siblings.indexOf(nodeId);
    if (siblingIndex < 0) return '#666';
    return branchColors[siblingIndex % branchColors.length];
  }

  
  return getBranchColor(parentId, normalizedData, colorSetName);
}

function getColorSetColors(colorSetName: string): string[] {
  const colorSets: Record<string, string[]> = {
    vibrant: ['#FF6B6B', '#4ECDC4', '#FECA57', '#54A0FF', '#FF9FF3', '#96CEB4'],
    gentle: ['#FFB5B5', '#A8E6CF', '#FFE699', '#B5D7FF', '#FFD4F0', '#C4E8C2'],
    pastel: ['#FFD1DC', '#B4E7CE', '#FFF4C2', '#C2E0FF', '#E8D4FF', '#D4F1D4'],
    nord: ['#BF616A', '#88C0D0', '#EBCB8B', '#5E81AC', '#B48EAD', '#A3BE8C'],
    warm: ['#FF6B6B', '#FF9F43', '#FECA57', '#FFB142', '#FF7979', '#F8B739'],
    cool: ['#5DADE2', '#48C9B0', '#85C1E2', '#52B788', '#6C9BD1', '#45B39D'],
    monochrome: ['#4A4A4A', '#707070', '#909090', '#B0B0B0', '#D0D0D0', '#606060'],
    sunset: ['#FF6B9D', '#FF8E53', '#FFB627', '#FFA45B', '#FF7B89', '#FFAA5C']
  };

  return colorSets[colorSetName] || colorSets.vibrant;
}

function generateBranchColors(baseColor: string): string[] {
  const hexToHSL = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const hslToHex = (h: number, s: number, l: number) => {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = lNorm;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;

      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const baseHSL = hexToHSL(baseColor);
  const colors: string[] = [];

  
  colors.push(baseColor);

  
  for (let i = 1; i < 6; i++) {
    const lightnessShift = i * -4; 

    const newL = Math.max(20, Math.min(80, baseHSL.l + lightnessShift));

    colors.push(hslToHex(baseHSL.h, baseHSL.s, newL));
  }

  return colors;
}
