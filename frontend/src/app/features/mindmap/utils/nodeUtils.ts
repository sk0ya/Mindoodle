import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '../../../core/data/normalizedStore';
import { hasInternalMarkdownLinks, extractExternalLinksFromMarkdown } from '../../markdown/markdownLinkUtils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import { stripInlineMarkdown, parseInlineMarkdown } from '../../markdown/parseInlineMarkdown';

// アイコンレイアウト情報
interface IconLayout {
  totalWidth: number; // アイコン群の総幅
  linkIcon?: {
    x: number; // ノード中心からの相対X座標
    y: number; // ノード中心からの相対Y座標
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

// Canvas要素を使用してテキストの実際の幅を測定するためのキャッシュ
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * 測定用Canvasコンテキストを確実に初期化する
 */
function ensureMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    // DOMの影響を受けないようにCanvasを完全に隠し、配置しない
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
    
    // デフォルトのフォント設定でコンテキストをリセット
    measureContext.font = '14px system-ui, -apple-system, sans-serif';
    measureContext.textBaseline = 'alphabetic';
    measureContext.textAlign = 'left';
  }
  return measureContext;
}

/**
 * Canvas APIを使用してテキストの実際の幅を測定
 * @param text 計算対象のテキスト
 * @param fontSize フォントサイズ（px）
 * @param fontFamily フォントファミリー
 * @param fontWeight フォントウェイト
 * @param fontStyle フォントスタイル
 * @returns 実際のピクセル幅
 */
function measureTextWidth(
  text: string, 
  fontSize: number = 14, 
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number {
  // 空文字の場合は0を返す
  if (!text) return 0;
  
  // 測定用Canvasコンテキストを確実に取得
  const context = ensureMeasureContext();
  
  if (!context) {
    // Canvas APIが使用できない場合は従来の文字数ベースの計算にフォールバック
    return calculateTextWidthFallback(text) * fontSize * 0.6;
  }
  
  // フォント設定を適用（毎回明示的に設定して一貫性を保つ）
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.font = fontString;
  
  // 一貫した測定のためにベースラインとアラインメントを再設定
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  
  // テキストの実際の幅を測定
  const metrics = context.measureText(text);
  return metrics.width;
}

/**
 * テキストの表示幅を計算（全角文字を考慮） - フォールバック用
 * @param text 計算対象のテキスト
 * @returns 表示幅（半角文字1文字を1とした単位）
 */
function calculateTextWidthFallback(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    // 全角文字の判定
    if (
      // 日本語文字（ひらがな、カタカナ、漢字）
      (code >= 0x3040 && code <= 0x309F) || // ひらがな
      (code >= 0x30A0 && code <= 0x30FF) || // カタカナ
      (code >= 0x4E00 && code <= 0x9FAF) || // 漢字
      // 全角記号・全角英数字
      (code >= 0xFF00 && code <= 0xFFEF) ||
      // その他の全角文字
      code > 0x007F
    ) {
      width += 2; // 全角文字は2倍の幅
    } else {
      width += 1; // 半角文字は1倍の幅
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

export function wrapNodeText(text: string, options: WrapNodeTextOptions): WrapNodeTextResult {
  const {
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    maxWidth,
    prefixTokens
  } = options;

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

      const spaceSplit = piece.split(/(\s+)/);
      for (const part of spaceSplit) {
        if (!part) continue;
        pieces.push({
          text: part,
          bold: segment.bold,
          italic: segment.italic,
          strikethrough: segment.strikethrough
        });
      }
    }

    return pieces;
  });

  tokens.push(...segmentTokens);

  const lines: WrappedLine[] = [];
  let currentTokens: WrappedToken[] = [];
  let currentWidth = 0;

  const measureTokenWidth = (value: string): number => {
    if (!value) return 0;
    return measureTextWidth(value, fontSize, fontFamily, fontWeight, fontStyle);
  };

  const pushCurrentLine = () => {
    while (currentTokens.length > 0 && /^\s+$/.test(currentTokens[currentTokens.length - 1].text) && !currentTokens[currentTokens.length - 1].isMarker) {
      currentWidth -= currentTokens[currentTokens.length - 1].width;
      currentTokens.pop();
    }

    const clonedTokens = currentTokens.map(token => ({ ...token }));
    const rawText = clonedTokens.map(token => token.text).join('');
    lines.push({ tokens: clonedTokens, width: currentWidth, rawText });
    currentTokens = [];
    currentWidth = 0;
  };

  const breakTokenIfNeeded = (token: RawTextToken): WrappedToken[] => {
    const textValue = token.text;
    if (!textValue) {
      return [{ ...token, width: 0 }];
    }

    const measured = measureTokenWidth(textValue);
    if (measured <= effectiveMaxWidth) {
      return [{ ...token, width: measured }];
    }

    const parts: WrappedToken[] = [];
    let buffer = '';
    for (const char of Array.from(textValue)) {
      const tentative = buffer + char;
      const tentativeWidth = measureTokenWidth(tentative);
      if (tentativeWidth > effectiveMaxWidth && buffer) {
        parts.push({ ...token, text: buffer, width: measureTokenWidth(buffer) });
        buffer = char;
      } else {
        buffer = tentative;
      }
    }
    if (buffer) {
      parts.push({ ...token, text: buffer, width: measureTokenWidth(buffer) });
    }
    if (parts.length === 0) {
      parts.push({ ...token, text: textValue, width: measured });
    }
    return parts;
  };

  for (const token of tokens) {
    if (token.text === '\n') {
      pushCurrentLine();
      continue;
    }

    const brokenTokens = breakTokenIfNeeded(token);

    for (const piece of brokenTokens) {
      if (!piece.text) {
        continue;
      }
      const isWhitespace = /^\s+$/.test(piece.text);
      if (currentTokens.length === 0 && isWhitespace && !piece.isMarker) {
        continue;
      }

      if (currentWidth + piece.width <= effectiveMaxWidth || currentTokens.length === 0) {
        currentTokens.push(piece);
        currentWidth += piece.width;
      } else {
        pushCurrentLine();
        if (!(isWhitespace && !piece.isMarker)) {
          currentTokens.push(piece);
          currentWidth += piece.width;
        }
      }
    }
  }

  if (currentTokens.length > 0 || lines.length === 0) {
    pushCurrentLine();
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

/**
 * ノードのアイコンレイアウトを計算
 */
export function calculateIconLayout(node: MindMapNode, nodeWidth: number): IconLayout {
  const noteStr = (node as any)?.note as string | undefined;
  const hasLinks = hasInternalMarkdownLinks(noteStr) || (extractExternalLinksFromMarkdown(noteStr).length > 0);
  
  // アイコンの基本サイズ
  const ICON_WIDTH = 22;
  const ICON_HEIGHT = 14;
  const RIGHT_MARGIN = 2; // 右端との最小余白
  
  let totalWidth = 0;
  let linkIcon: { x: number; y: number } | undefined;
  
  if (hasLinks) {
    // リンクのみ（添付ファイル機能は廃止されているため）
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
  // Table node sizing - 動的サイズ更新に対応
  if (node.kind === 'table') {
    // カスタムサイズが設定されている場合は、それを使用（動的更新済み）
    if (node.customImageWidth && node.customImageHeight) {
      const contentWidth = node.customImageWidth;
      const contentHeight = node.customImageHeight;
      // テーブル表示に適したパディング
      const padding = 10;
      return {
        width: contentWidth + padding,
        height: contentHeight + padding,
        imageHeight: contentHeight
      };
    }

    // カスタムサイズが未設定の場合のフォールバック計算
    const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
      if (!src) return null;
      const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
      for (let i = 0; i < lines.length - 1; i++) {
        const header = lines[i];
        const sep = lines[i + 1];
        const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
        const isSep = /:?-{3,}:?\s*\|/.test(sep) || /^\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)\|?$/.test(sep);
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

    let parsed = parseTableFromString(node.text) || parseTableFromString((node as any).note);
    if (!parsed) {
      const td = (node as any).tableData as { headers?: string[]; rows?: string[][] } | undefined;
      if (td && Array.isArray(td.rows)) {
        parsed = { headers: td.headers, rows: td.rows } as any;
      }
    }

    // NodeRendererと同じ高さ計算（フォールバック用）
    const calculateTableHeight = (parsed: { headers?: string[]; rows: string[][] } | null): number => {
      if (!parsed) return 70;
      const headerRows = parsed.headers ? 1 : 0;
      const dataRows = parsed.rows.length;
      const totalRows = headerRows + dataRows;
      // NodeRendererの新しいCSS: padding: '12px 16px', line-height: 1.5, fontSize: 14px * 0.95
      // 実際の計算: (13.3px * 1.5) + (12px * 2) = 19.95px + 24px = 43.95px ≈ 44px
      const rowHeight = 44;
      return Math.max(70, totalRows * rowHeight + 12); // 最小70px + 適切なマージン
    };

    const calculatedHeight = calculateTableHeight(parsed);
    const contentWidth = Math.max(150, 200); // 基本的な幅
    const contentHeight = calculatedHeight;

    const padding = 10; // テーブル表示に適したパディング
    const nodeWidth = contentWidth + padding;
    const nodeHeight = contentHeight + padding;

    return {
      width: nodeWidth,
      height: nodeHeight,
      imageHeight: contentHeight
    };
  }

  // 画像の有無とサイズを確認（添付 or ノート埋め込み画像）
  const noteStr: string = (node as any)?.note || '';
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
        const tagMatch = noteStr.match(/<img[^>]*>/i);
        if (tagMatch) {
          const tag = tagMatch[0];
          const wMatch = tag.match(/\swidth=["']?(\d+)(?:px)?["']?/i);
          const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
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
    const match = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    return match ? match[1] : text;
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
  let textBlockHeight = Math.max(fontSize + 8, 22);

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
    textContentWidth = wrapResult.maxLineWidth;
    textBlockHeight = wrapEnabled ? Math.max(wrapResult.textHeight, fontSize + 8) : Math.max(fontSize + 8, 22);
  }

  const textBasedWidth = Math.max(textContentWidth + horizontalPadding + checkboxWidth, Math.max(fontSize * 2, 24));
  let baseNodeHeight = Math.max(fontSize + 8, 22);
  if (!isEditing) {
    baseNodeHeight = textBlockHeight;
  }

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

/**
 * ノードの座標計算ユーティリティ
 * 一貫性のある座標計算を提供
 */

/**
 * ノードの左端X座標を計算
 */
export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

/**
 * ノードの右端X座標を計算
 */
export function getNodeRightX(node: MindMapNode, nodeWidth: number): number {
  return node.x + nodeWidth / 2;
}

/**
 * ノードの上端Y座標を計算
 */
export function getNodeTopY(node: MindMapNode, nodeHeight: number): number {
  return node.y - nodeHeight / 2;
}

/**
 * ノードの下端Y座標を計算
 */
export function getNodeBottomY(node: MindMapNode, nodeHeight: number): number {
  return node.y + nodeHeight / 2;
}

/**
 * ノードの境界を計算する（統一インターフェース）
 */
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
  // ルートノード自身の場合は常に右側に配置
  const isRootNodeItself = node.id === rootNode.id;
  const isOnRight = isRootNodeItself ? true : node.x > rootNode.x;

  // 一貫したノードサイズ計算を使用（引数で渡されない場合は内部で計算）
  const actualNodeSize = nodeSize || calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);

  // フォントサイズとノードサイズに応じた動的なマージン調整
  const fontSize = globalFontSize || 14;
  // フォントサイズに比例した基本マージン
  const base = Math.max(fontSize * 1.5, 20);

  // Mermaidや表など「ビジュアルが大きいノード」はトグルを遠ざけ過ぎない
  const note: string = (node as any)?.note || '';
  const hasMermaid = /```mermaid[\s\S]*?```/i.test(note);
  const isTable = (node as any)?.kind === 'table';
  const isVisualHeavy = hasMermaid || isTable;

  let baseMargin = base;
  let widthAdjustment = 0;

  if (!isVisualHeavy) {
    // 画像の高さに応じた調整（軽微）
    if (actualNodeSize.imageHeight > 100) {
      baseMargin += Math.min((actualNodeSize.imageHeight - 100) * 0.08, 24); // 上限24px
    }
    // 幅に応じた追加調整（ノードサイズに比例させる）
    // 基準となる幅をフォントサイズの4倍程度に設定（より現実的な値）
    const baseWidth = fontSize * 4;
    // ノード幅が基準を超えた分の10%をマージンとして追加（より控えめ）
    widthAdjustment = Math.max(0, (actualNodeSize.width - baseWidth) * 0.04);
    widthAdjustment = Math.min(widthAdjustment, 20); // 上限20px（より控えめ）
  } else {
    // ビジュアルが大きいノードは固定の小さめオフセット
    baseMargin += 8;
  }

  // 最終的なトグル余白をクランプ（より控えめな上限）
  const totalMargin = Math.min(Math.max(baseMargin + widthAdjustment, 12), 35);

  // ノードの右端から一定距離でトグルボタンを配置（統一された関数を使用）
  const nodeRightEdge = getNodeRightX(node, actualNodeSize.width);
  const nodeLeftEdge = getNodeLeftX(node, actualNodeSize.width);

  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;


  return { x: toggleX, y: toggleY };
}

/**
 * 親ノードの右端から子ノードの左端までの水平距離を計算
 * トグルボタンの存在を考慮した間隔計算
 */
export function getDynamicNodeSpacing(parentNodeSize: NodeSize, childNodeSize: NodeSize, _isRootChild: boolean = false): number {
  // トグルボタンのサイズと最小間隔を考慮
  const toggleButtonWidth = 20; // トグルボタンの幅
  const minToggleToChildSpacing = 15; // トグルボタンと子ノードの最小間隔

  // 基本間隔（親ノード → トグルボタン → 子ノード）
  const baseSpacing = 30;

  // 親ノードと子ノードの幅を考慮した追加間隔
  const parentWidthFactor = Math.min(parentNodeSize.width / 100, 1) * 5; // 最大5px追加
  const childWidthFactor = Math.min(childNodeSize.width / 100, 1) * 5;   // 最大5px追加

  // トグルボタンのためのスペースを確保
  const calculatedSpacing = baseSpacing + parentWidthFactor + childWidthFactor;
  const minRequiredSpacing = toggleButtonWidth + minToggleToChildSpacing;

  return Math.round(Math.max(calculatedSpacing, minRequiredSpacing));
}

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算
 * トグルボタンの位置を考慮して重なりを防ぐ
 */
export function calculateChildNodeX(
  parentNode: MindMapNode,
  childNodeSize: NodeSize,
  edgeToEdgeDistance: number,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): number {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize, wrapConfig);
  const parentRightEdge = getNodeRightX(parentNode, parentNodeSize.width);

  // 基本的な子ノード位置計算
  const basicChildLeftEdge = parentRightEdge + edgeToEdgeDistance;

  // トグルボタンの位置を計算（getToggleButtonPositionと同じロジック）
  const togglePosition = getToggleButtonPosition(parentNode, parentNode, parentNodeSize, globalFontSize, wrapConfig);
  const toggleButtonWidth = 20; // トグルボタンの幅
  const minToggleToChildSpacing = 15; // トグルボタンと子ノードの最小間隔
  const requiredChildLeftEdge = togglePosition.x + toggleButtonWidth / 2 + minToggleToChildSpacing;

  // 基本計算と、トグルボタンを考慮した位置の、より右側を使用
  const finalChildLeftEdge = Math.max(basicChildLeftEdge, requiredChildLeftEdge);
  const childCenterX = finalChildLeftEdge + childNodeSize.width / 2;

  return childCenterX;
}

/**
 * ノードのルートブランチを特定し、そのブランチに対応する色を返す
 * レベル0→1と1→2でのみ兄弟順位に応じて色を循環、レベル2以降は親の色を継承
 * @param nodeId ノードID
 * @param normalizedData 正規化されたデータ
 * @param colorSetName カラーセット名（オプション）
 * @returns ブランチカラー
 */
export function getBranchColor(
  nodeId: string,
  normalizedData: NormalizedData,
  colorSetName?: string
): string {
  if (!normalizedData || !nodeId) return '#666';

  // 現在のノードがルートノードかどうかを判定
  const isRootNode = !normalizedData.parentMap[nodeId];

  if (isRootNode) {
    // ルートノード自体はデフォルト色
    return '#333';
  }

  // ブランチのルートノードとレベルを見つける
  let currentNodeId = nodeId;
  let branchRootId: string | null = null;
  let level = 0;

  while (currentNodeId) {
    const parentId = normalizedData.parentMap[currentNodeId];

    if (!parentId) {
      // 親がいない = ルートノードに到達
      break;
    }

    level++;

    // 親がルートノードかどうかをチェック
    const parentIsRoot = !normalizedData.parentMap[parentId];

    if (parentIsRoot) {
      // 親がルートノード = 現在のノードがブランチルート
      branchRootId = currentNodeId;
      break;
    }

    currentNodeId = parentId;
  }

  // ブランチルートが見つからない場合はデフォルト色
  if (!branchRootId) return '#666';

  // ルートノードを取得してその子ノード一覧からインデックスを特定
  const parentOfBranchRoot = normalizedData.parentMap[branchRootId];
  if (!parentOfBranchRoot) return '#666';

  const rootChildren = normalizedData.childrenMap[parentOfBranchRoot] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);

  if (branchIndex < 0) return '#666';

  // カラーセットから色を取得
  const colorSet = getColorSetColors(colorSetName || 'vibrant');
  const baseColor = colorSet[branchIndex % colorSet.length];
  const branchColors = generateBranchColors(baseColor);

  // レベル1（ルート→ブランチルート）の場合は基本色
  if (nodeId === branchRootId) {
    return branchColors[0]; // 基本色
  }

  // レベル2（ブランチルート→その子）の場合は兄弟順位に応じて色を循環
  const parentId = normalizedData.parentMap[nodeId];
  if (!parentId) return '#666';

  if (parentId === branchRootId) {
    // 親がブランチルート = レベル2
    const siblings = normalizedData.childrenMap[parentId] || [];
    const siblingIndex = siblings.indexOf(nodeId);
    if (siblingIndex < 0) return '#666';
    return branchColors[siblingIndex % branchColors.length];
  }

  // レベル3以降: 親の色を継承
  return getBranchColor(parentId, normalizedData, colorSetName);
}

/**
 * カラーセット名から色配列を取得
 */
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

/**
 * ブランチ内の色配列を生成（基本色から類似色を生成）
 * @param baseColor 基本色（HEX形式）
 * @returns 類似色の配列
 */
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

  // 基本色（インデックス0）
  colors.push(baseColor);

  // 類似色を5つ生成（明度のみ変化、彩度は維持）
  for (let i = 1; i < 6; i++) {
    const lightnessShift = i * -4; // -4%, -8%, -12%, -16%, -20%

    const newL = Math.max(20, Math.min(80, baseHSL.l + lightnessShift));

    colors.push(hslToHex(baseHSL.h, baseHSL.s, newL));
  }

  return colors;
}
