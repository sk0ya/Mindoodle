import { parseInlineMarkdown } from '../../markdown/parseInlineMarkdown';

// ========================================
// Types and Interfaces
// ========================================

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

export type NodeTextWrapSettingsLike = Partial<{
  nodeTextWrapEnabled: boolean;
  nodeTextWrapWidth: number;
}>;

// ========================================
// Constants
// ========================================

const NODE_TEXT_MIN_WIDTH = 160;
const NODE_TEXT_BASE_MAX_WIDTH = 240;
const NODE_TEXT_LINE_HEIGHT_RATIO = 1.35;

// High-priority break characters: Japanese and English punctuation marks
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
export const BREAK_BEFORE_CHARS = new Set<string>([
  // Japanese opening brackets and quotes
  '（','「','『','【','〈','《','〔','〖','〘','〚','｛','［',
  // English opening brackets
  '(','[','{'
]);

// ========================================
// Canvas Measurement Context
// ========================================

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

// ========================================
// Text Measurement Functions
// ========================================

function calculateTextWidthFallback(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);

    if (
      // Japanese characters
      (code >= 0x3040 && code <= 0x309F) ||
      (code >= 0x30A0 && code <= 0x30FF) ||
      (code >= 0x4E00 && code <= 0x9FAF) ||
      // Full-width characters
      (code >= 0xFF00 && code <= 0xFFEF) ||
      // Non-ASCII
      code > 0x007F
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
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

export function getNodeTextLineHeight(fontSize: number): number {
  const computed = fontSize * NODE_TEXT_LINE_HEIGHT_RATIO;
  return Math.max(computed, fontSize + 6);
}

export function getNodeTextMaxWidth(fontSize: number): number {
  const dynamicWidth = NODE_TEXT_BASE_MAX_WIDTH + (fontSize - 14) * 12;
  return Math.max(NODE_TEXT_MIN_WIDTH, dynamicWidth);
}

export function resolveNodeTextWrapConfig(settings?: NodeTextWrapSettingsLike, fontSize: number = 14): NodeTextWrapConfig {
  const enabled = settings?.nodeTextWrapEnabled !== false;
  const width = Math.max(NODE_TEXT_MIN_WIDTH, settings?.nodeTextWrapWidth ?? getNodeTextMaxWidth(fontSize));
  return {
    enabled,
    maxWidth: width
  };
}

// ========================================
// Text Breaking Functions
// ========================================

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

    // Whitespace: always split
    if (/\s/.test(char)) {
      flush();
      pieces.push({ text: char, ...formatting });
      continue;
    }

    // Split after punctuation
    if (isPrimaryBreak(char) || isSecondaryBreak(char)) {
      buffer += char;
      flush();
      continue;
    }

    // Split before opening brackets
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

// ========================================
// Text Wrapping Function
// ========================================

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
    // Remove trailing whitespace
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

  // Place tokens into lines
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Newline
    if (token.text === '\n') {
      pushLine();
      continue;
    }

    // Markers have zero width
    const width = token.isMarker ? 0 : measureWidth(token.text);
    const wrappedToken: WrappedToken = { ...token, width };

    // Handle whitespace
    const isWhitespace = /^\s+$/.test(token.text);

    // Skip whitespace at line start
    if (currentTokens.length === 0 && isWhitespace && !token.isMarker) {
      continue;
    }

    // Line break before opening bracket if preceded by whitespace
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (isWhitespace && nextToken && nextToken.text.length > 0 && isBreakBefore(nextToken.text[0])) {
      if (currentTokens.length > 0) {
        pushLine();
      }
      continue;
    }

    // Check if token fits
    const wouldFit = currentWidth + width <= effectiveMaxWidth;

    if (wouldFit || currentTokens.length === 0) {
      // Add to current line
      currentTokens.push(wrappedToken);
      currentWidth += width;
    } else {
      // Exceeds width: start new line

      // Very long tokens may need splitting
      if (width > effectiveMaxWidth && !isWhitespace && !token.isMarker) {
        // Don't split tokens starting with brackets
        if (isBreakBefore(token.text[0])) {
          pushLine();
          currentTokens.push(wrappedToken);
          currentWidth += width;
          continue;
        }

        // CJK text: attempt split at punctuation
        const chars = Array.from(token.text);
        let buffer = '';

        for (let j = 0; j < chars.length; j++) {
          const char = chars[j];
          const tentative = buffer + char;
          const tentativeWidth = measureWidth(tentative);

          if (tentativeWidth > effectiveMaxWidth && buffer) {
            // Find split point
            let breakPoint = buffer.length;

            // Look back for punctuation or brackets
            for (let k = buffer.length - 1; k >= Math.max(0, buffer.length - 10); k--) {
              const c = buffer[k];
              if (isPrimaryBreak(c)) {
                breakPoint = k + 1; // After punctuation
                break;
              }
              if (isBreakBefore(c)) {
                breakPoint = k; // Before bracket
                break;
              }
            }

            // Split
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
        // Regular token: place on new line
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
