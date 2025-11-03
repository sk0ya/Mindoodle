import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { hasInternalMarkdownLinks, extractExternalLinksFromMarkdown } from '../../markdown/markdownLinkUtils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import { stripInlineMarkdown } from '../../markdown/parseInlineMarkdown';
import {
  measureTextWidth,
  wrapNodeText,
  resolveNodeTextWrapConfig,
  type NodeTextWrapConfig,
  type WrappedToken
} from './nodeMeasurement';

// ========================================
// Types and Interfaces
// ========================================

export interface IconLayout {
  totalWidth: number;
  linkIcon?: {
    x: number;
    y: number;
  };
}

export interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

// ========================================
// Constants
// ========================================

export const TEXT_ICON_SPACING = 1;

// ========================================
// Helper Functions
// ========================================

export function getNodeHorizontalPadding(textLength: number, isEditing: boolean): number {
  if (isEditing) {
    return 34;
  }
  const basePadding = 12;
  const textLengthFactor = Math.min(textLength / 25, 1);
  const additionalPadding = textLengthFactor * 13;
  return basePadding + additionalPadding;
}

export function getMarkerPrefixTokens(node: MindMapNode): WrappedToken[] {
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
    { text: marker, isMarker: true, width: 0 },
    { text: ' ', isMarker: true, width: 0 }
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

// ========================================
// Table Size Calculation
// ========================================

function parseTableFromString(src?: string): { headers?: string[]; rows: string[][] } | null {
  if (!src) return null;
  const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const sep = lines[i + 1];
    const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
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
}

function calculateTableDimensions(
  parsed: { headers?: string[]; rows: string[][] } | null,
  globalFontSize?: number
): { width: number; height: number } {
  if (!parsed) return { width: 200, height: 70 };

  const allRows: string[][] = [];
  if (parsed.headers) {
    allRows.push(parsed.headers);
  }
  allRows.push(...parsed.rows);

  if (allRows.length === 0) return { width: 200, height: 70 };

  const cellPadding = 32; // 16px left/right (matches TableNodeContent)
  const fontSize = (globalFontSize || 14) * 0.95;
  const fontFamily = 'system-ui, -apple-system, sans-serif';
  const fontWeight = 'normal';

  const numCols = Math.max(...allRows.map(row => row.length));
  const columnWidths: number[] = [];

  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    let maxCellWidth = 0;

    for (const row of allRows) {
      const cellText = row[colIndex] || '';
      const textWidth = measureTextWidth(cellText, fontSize, fontFamily, fontWeight, 'normal');
      maxCellWidth = Math.max(maxCellWidth, textWidth);
    }

    columnWidths.push(maxCellWidth + cellPadding);
  }

  const borderWidth = 1;
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0) + (numCols - 1) * borderWidth;

  // Estimate row height based on font metrics and vertical padding (12px top + 12px bottom)
  const estimatedTextHeight = Math.ceil(fontSize * 1.3); // closer to CSS line-height without overshoot
  const rowHeight = estimatedTextHeight + 24; // + 24px vertical padding
  const totalRows = allRows.length;
  const tableHeight = Math.max(70, totalRows * rowHeight);

  return { width: Math.max(150, tableWidth), height: tableHeight };
}

// ========================================
// Main Size Calculation Function
// ========================================

export function calculateNodeSize(
  node: MindMapNode,
  editText?: string,
  isEditing: boolean = false,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): NodeSize {
  const settingsShowDefault = (useMindMapStore as unknown as { getState?: () => { settings?: { showVisualContentByDefault?: boolean } } }).getState?.()?.settings?.showVisualContentByDefault;
  const explicitHidden = (node as unknown as { contentHidden?: boolean }).contentHidden;
  const contentHidden = explicitHidden === true || (explicitHidden === undefined && settingsShowDefault === false);
  // Table nodes (unless content is hidden)
  if (node.kind === 'table' && !contentHidden) {
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

    let parsed = parseTableFromString(node.text) || parseTableFromString(node.note);
    if (!parsed) {
      const td = node.tableData;
      if (td && Array.isArray(td.rows)) {
        parsed = { headers: td.headers, rows: td.rows };
      }
    }

    const { width: contentWidth, height: contentHeight } = calculateTableDimensions(parsed, globalFontSize);
    const padding = 4; // tighter padding to avoid large perceived margins
    const nodeWidth = contentWidth + padding;
    const nodeHeight = contentHeight + padding;

    return {
      width: nodeWidth,
      height: nodeHeight,
      imageHeight: contentHeight
    };
  }

  // Regular nodes with images/mermaid (or table treated as text-only when hidden)
  const isTableNode = node.kind === 'table';
  // When table content is hidden, do not let note influence height
  const noteStr = contentHidden && isTableNode ? '' : (node.note || '');
  const hasNoteImages = !!noteStr && (/!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'\s>]+["'][^>]*>/i.test(noteStr));
  const hasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
  const hasImages = contentHidden ? false : (hasNoteImages || hasMermaid);

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

  // Text processing
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
  let baseDisplayText = isMarkdownLink(node.text) ? getDisplayTextFromMarkdownLink(node.text) : node.text;
  // For hidden tables, shrink to first line only to avoid multi-line table text affecting height
  if (contentHidden && isTableNode && typeof baseDisplayText === 'string') {
    const firstLine = baseDisplayText.split(/\r?\n/)[0] ?? '';
    baseDisplayText = firstLine;
  }
  const displayText = isEditing ? resolvedEditText : baseDisplayText;
  const measurementText = isEditing ? resolvedEditText : stripInlineMarkdown(baseDisplayText);

  const fontSize = globalFontSize || node.fontSize || 14;
  const fontFamily = node.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontWeight = node.fontWeight || 'normal';
  const fontStyle = node.fontStyle || 'normal';

  const resolvedWrap = wrapConfig ?? resolveNodeTextWrapConfig(undefined, fontSize);
  // When table content is hidden, force single-line height (no wrapping)
  const wrapEnabled = (contentHidden && isTableNode) ? false : (resolvedWrap.enabled !== false);
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
    const markerTokens = getMarkerPrefixTokens(node);
    const wrapResult = wrapNodeText(measurementText, {
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      maxWidth: wrapMaxWidth,
      prefixTokens: markerTokens
    });

    textContentWidth = wrapResult.maxLineWidth;
    textBlockHeight = wrapEnabled ? Math.max(wrapResult.textHeight, fontSize + 8) : Math.max(fontSize + 8, 22);
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
