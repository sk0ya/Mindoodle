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

const PRIMARY_BREAK_CHARS = new Set<string>([
  '、','。',',','.',
  '，','．','！','？','：','；','）','』','】','〉','》',']','）','｝','〕','〗','〙','〛',
  ')','!','?',':',';'
]);

const SECONDARY_BREAK_CHARS = new Set<string>([
  '」','』','）','】','〕','〉',')',']','}','>',
  'で','が','も','や','と','か','し','て','に','を','は','の'
]);

export const BREAK_BEFORE_CHARS = new Set<string>([
  '（','「','『','【','〈','《','〔','〖','〘','〚','｛','［',
  '(','[','{'
]);

// ========================================
// Canvas Measurement Context
// ========================================

let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

const ensureMeasureContext = (): CanvasRenderingContext2D | null => {
  if (!measureCanvas || !measureContext) {
    measureCanvas = Object.assign(document.createElement('canvas'), {
      width: 1,
      height: 1,
      style: { position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }
    });
    measureContext = measureCanvas.getContext('2d');
    if (measureContext) {
      Object.assign(measureContext, {
        font: '14px system-ui, -apple-system, sans-serif',
        textBaseline: 'alphabetic',
        textAlign: 'left'
      });
    }
  }
  return measureContext;
};

// ========================================
// Text Measurement Functions
// ========================================

const isWideChar = (code: number): boolean =>
  (code >= 0x3040 && code <= 0x309F) ||
  (code >= 0x30A0 && code <= 0x30FF) ||
  (code >= 0x4E00 && code <= 0x9FAF) ||
  (code >= 0xFF00 && code <= 0xFFEF) ||
  code > 0x007F;

const calculateTextWidthFallback = (text: string): number =>
  Array.from(text).reduce((width, char) => width + (isWideChar(char.charCodeAt(0)) ? 2 : 1), 0);

export const measureTextWidth = (
  text: string,
  fontSize: number = 14,
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number => {
  if (!text) return 0;
  const context = ensureMeasureContext();
  if (!context) return calculateTextWidthFallback(text) * fontSize * 0.6;

  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  return context.measureText(text).width;
};

export const getNodeTextLineHeight = (fontSize: number): number =>
  Math.max(fontSize * NODE_TEXT_LINE_HEIGHT_RATIO, fontSize + 6);

export const getNodeTextMaxWidth = (fontSize: number): number =>
  Math.max(NODE_TEXT_MIN_WIDTH, NODE_TEXT_BASE_MAX_WIDTH + (fontSize - 14) * 12);

export const resolveNodeTextWrapConfig = (settings?: NodeTextWrapSettingsLike, fontSize: number = 14): NodeTextWrapConfig => ({
  enabled: settings?.nodeTextWrapEnabled !== false,
  maxWidth: Math.max(NODE_TEXT_MIN_WIDTH, settings?.nodeTextWrapWidth ?? getNodeTextMaxWidth(fontSize))
});

// ========================================
// Text Breaking Functions
// ========================================

const hasChar = (char: string, set: Set<string>): boolean => !!char && set.has(char);
const isPrimaryBreak = (char: string): boolean => hasChar(char, PRIMARY_BREAK_CHARS);
const isSecondaryBreak = (char: string): boolean => hasChar(char, SECONDARY_BREAK_CHARS);
const isBreakBefore = (char: string): boolean => hasChar(char, BREAK_BEFORE_CHARS);

const smartSplitText = (text: string, formatting: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): RawTextToken[] => {
  interface SplitState {
    pieces: RawTextToken[];
    buffer: string;
  }

  const flush = (state: SplitState): SplitState =>
    state.buffer
      ? { pieces: [...state.pieces, { text: state.buffer, ...formatting }], buffer: '' }
      : state;

  const processChar = (state: SplitState, char: string): SplitState => {
    if (/\s/.test(char)) {
      const flushed = flush(state);
      return { pieces: [...flushed.pieces, { text: char, ...formatting }], buffer: '' };
    }
    if (isPrimaryBreak(char) || isSecondaryBreak(char)) {
      return flush({ ...state, buffer: state.buffer + char });
    }
    if (isBreakBefore(char)) {
      return { ...flush(state), buffer: char };
    }
    return { ...state, buffer: state.buffer + char };
  };

  return flush(Array.from(text).reduce(processChar, { pieces: [], buffer: '' })).pieces;
};

// ========================================
// Text Wrapping Function
// ========================================

export function wrapNodeText(text: string, options: WrapNodeTextOptions): WrapNodeTextResult {
  const { fontSize, fontFamily, fontWeight, fontStyle, maxWidth, prefixTokens } = options;
  const effectiveMaxWidth = Math.max(20, maxWidth);
  const lineHeight = getNodeTextLineHeight(fontSize);

  const measureWidth = (value: string): number =>
    value ? measureTextWidth(value, fontSize, fontFamily, fontWeight, fontStyle) : 0;

  const baseText = (text ?? '').replace(/\r\n/g, '\n');
  const segments = parseInlineMarkdown(baseText);

  const segmentTokens: RawTextToken[] = segments.flatMap(segment => {
    const normalized = segment.text.replace(/\r\n/g, '\n');
    return normalized.split(/(\n)/).flatMap(piece => {
      if (!piece) return [];
      if (piece === '\n') return [{ text: '\n' }];
      return smartSplitText(piece, {
        bold: segment.bold,
        italic: segment.italic,
        strikethrough: segment.strikethrough
      });
    });
  });

  const allTokens = [...(prefixTokens || []), ...segmentTokens];

  interface WrapState {
    lines: WrappedLine[];
    currentTokens: WrappedToken[];
    currentWidth: number;
  }

  const trimTrailingSpace = (tokens: WrappedToken[], width: number): { tokens: WrappedToken[]; width: number } => {
    const result = [...tokens];
    let w = width;
    while (result.length > 0 && /^\s+$/.test(result[result.length - 1].text) && !result[result.length - 1].isMarker) {
      w -= result[result.length - 1].width;
      result.pop();
    }
    return { tokens: result, width: w };
  };

  const pushLine = (state: WrapState): WrapState => {
    const trimmed = trimTrailingSpace(state.currentTokens, state.currentWidth);
    const rawText = trimmed.tokens.map(t => t.text).join('');
    return {
      lines: [...state.lines, { tokens: trimmed.tokens, width: trimmed.width, rawText }],
      currentTokens: [],
      currentWidth: 0
    };
  };

  const splitLongToken = (state: WrapState, token: RawTextToken, width: number): WrapState => {
    if (isBreakBefore(token.text[0])) {
      const pushed = pushLine(state);
      const wrapped: WrappedToken = { ...token, width };
      return { ...pushed, currentTokens: [wrapped], currentWidth: width };
    }

    const chars = Array.from(token.text);
    interface CharState {
      state: WrapState;
      buffer: string;
    }

    const processCharInToken = (acc: CharState, char: string): CharState => {
      const tentative = acc.buffer + char;
      const tentativeWidth = measureWidth(tentative);

      if (tentativeWidth > effectiveMaxWidth && acc.buffer) {
        let breakPoint = acc.buffer.length;
        for (let k = acc.buffer.length - 1; k >= Math.max(0, acc.buffer.length - 10); k--) {
          const c = acc.buffer[k];
          if (isPrimaryBreak(c)) {
            breakPoint = k + 1;
            break;
          }
          if (isBreakBefore(c)) {
            breakPoint = k;
            break;
          }
        }

        const part = acc.buffer.substring(0, breakPoint);
        const partWidth = measureWidth(part);
        const newTokens = part ? [...acc.state.currentTokens, { ...token, text: part, width: partWidth }] : acc.state.currentTokens;
        const newWidth = part ? acc.state.currentWidth + partWidth : acc.state.currentWidth;
        const pushed = pushLine({ ...acc.state, currentTokens: newTokens, currentWidth: newWidth });

        return { state: pushed, buffer: acc.buffer.substring(breakPoint) + char };
      }

      return { ...acc, buffer: tentative };
    };

    const final = chars.reduce(processCharInToken, { state, buffer: '' });

    if (final.buffer) {
      const bufferWidth = measureWidth(final.buffer);
      return {
        ...final.state,
        currentTokens: [...final.state.currentTokens, { ...token, text: final.buffer, width: bufferWidth }],
        currentWidth: final.state.currentWidth + bufferWidth
      };
    }

    return final.state;
  };

  const processToken = (state: WrapState, token: RawTextToken, index: number): WrapState => {
    if (token.text === '\n') return pushLine(state);

    const width = token.isMarker ? 0 : measureWidth(token.text);
    const wrappedToken: WrappedToken = { ...token, width };
    const isWhitespace = /^\s+$/.test(token.text);

    if (state.currentTokens.length === 0 && isWhitespace && !token.isMarker) return state;

    const nextToken = index + 1 < allTokens.length ? allTokens[index + 1] : null;
    if (isWhitespace && nextToken && nextToken.text.length > 0 && isBreakBefore(nextToken.text[0])) {
      return state.currentTokens.length > 0 ? pushLine(state) : state;
    }

    const wouldFit = state.currentWidth + width <= effectiveMaxWidth;

    if (wouldFit || state.currentTokens.length === 0) {
      return {
        ...state,
        currentTokens: [...state.currentTokens, wrappedToken],
        currentWidth: state.currentWidth + width
      };
    }

    if (width > effectiveMaxWidth && !isWhitespace && !token.isMarker) {
      return splitLongToken(state, token, width);
    }

    const pushed = pushLine(state);
    return !isWhitespace || token.isMarker
      ? { ...pushed, currentTokens: [wrappedToken], currentWidth: width }
      : pushed;
  };

  const finalState = allTokens.reduce(processToken, { lines: [], currentTokens: [], currentWidth: 0 });
  const withLastLine = finalState.currentTokens.length > 0 || finalState.lines.length === 0
    ? pushLine(finalState)
    : finalState;

  const maxLineWidth = withLastLine.lines.reduce((max, line) => Math.max(max, line.width), 0);
  const textHeight = Math.max(lineHeight, withLastLine.lines.length * lineHeight);

  return {
    lines: withLastLine.lines,
    maxLineWidth,
    lineHeight,
    textHeight
  };
}
