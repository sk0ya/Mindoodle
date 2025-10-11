/**
 * CodeMirror 6 editor setup and configuration
 */

import { EditorState, Extension, type Range } from '@codemirror/state';
import { EditorView, keymap, ViewUpdate, lineNumbers, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { vim, Vim } from '@replit/codemirror-vim';

export interface EditorConfig {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  vimMode?: boolean;
  language?: 'markdown' | 'plain' | 'vim';
  fontSize?: number;
  fontFamily?: string;
  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;
}

/**
 * Custom syntax highlighting with blue headings
 */
const lightThemeHighlight = HighlightStyle.define([
  // Markdown
  { tag: tags.heading1, color: '#0052cc', fontWeight: 'bold', fontSize: '1.8em' },
  { tag: tags.heading2, color: '#0065ff', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading3, color: '#2684ff', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading4, color: '#4c9aff', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading5, color: '#79b8ff', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading6, color: '#b3d4ff', fontWeight: 'bold', fontSize: '1.0em' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: '#0969da', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'monospace', backgroundColor: '#f6f8fa' },
  // Code
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#d73a49', fontWeight: 'bold' },
  { tag: tags.string, color: '#032f62' },
  { tag: tags.number, color: '#005cc5' },
  { tag: tags.operator, color: '#d73a49' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.variableName, color: '#24292e' },
]);

const darkThemeHighlight = HighlightStyle.define([
  // Markdown
  { tag: tags.heading1, color: '#58a6ff', fontWeight: 'bold', fontSize: '1.8em' },
  { tag: tags.heading2, color: '#79c0ff', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading3, color: '#a5d6ff', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading4, color: '#b3d4ff', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading5, color: '#c2e0ff', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading6, color: '#d0ebff', fontWeight: 'bold', fontSize: '1.0em' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: '#58a6ff', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'monospace', backgroundColor: '#161b22' },
  // Code
  { tag: tags.comment, color: '#8b949e', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#ff7b72', fontWeight: 'bold' },
  { tag: tags.string, color: '#a5d6ff' },
  { tag: tags.number, color: '#79c0ff' },
  { tag: tags.operator, color: '#ff7b72' },
  { tag: tags.function(tags.variableName), color: '#d2a8ff' },
  { tag: tags.variableName, color: '#c9d1d9' },
]);

/**
 * Simple Vimscript syntax highlighting
 */
function createVimHighlighting(isDark: boolean): Extension {
  const commentColor = isDark ? '#8b949e' : '#6a737d';
  const keywordColor = isDark ? '#ff7b72' : '#d73a49';
  const stringColor = isDark ? '#a5d6ff' : '#032f62';
  const functionColor = isDark ? '#d2a8ff' : '#6f42c1';

  return EditorView.decorations.compute(['doc'], (state) => {
    const decorations: Range<Decoration>[] = [];

    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i);
      const text = line.text;

      // Comment highlighting (starts with ")
      if (text.trim().startsWith('"')) {
        decorations.push(
          Decoration.mark({
            attributes: { style: `color: ${commentColor}; font-style: italic;` },
          }).range(line.from, line.to)
        );
        continue;
      }

      // Vim keywords
      const keywords = /\b(map|noremap|nnoremap|vnoremap|inoremap|set|let|if|endif|function|endfunction|call|return|for|endfor|while|endwhile)\b/g;
      let match;
      while ((match = keywords.exec(text)) !== null) {
        decorations.push(
          Decoration.mark({
            attributes: { style: `color: ${keywordColor}; font-weight: bold;` },
          }).range(line.from + match.index, line.from + match.index + match[0].length)
        );
      }

      // String highlighting
      const strings = /'[^']*'|"[^"]*"/g;
      while ((match = strings.exec(text)) !== null) {
        decorations.push(
          Decoration.mark({
            attributes: { style: `color: ${stringColor};` },
          }).range(line.from + match.index, line.from + match.index + match[0].length)
        );
      }

      // Leader key highlighting (<leader>)
      const leader = /<leader>/gi;
      while ((match = leader.exec(text)) !== null) {
        decorations.push(
          Decoration.mark({
            attributes: { style: `color: ${functionColor}; font-weight: bold;` },
          }).range(line.from + match.index, line.from + match.index + match[0].length)
        );
      }
    }

    return Decoration.set(decorations, true);
  });
}

/**
 * Create base extensions for CodeMirror
 */
export function createBaseExtensions(config: EditorConfig): Extension[] {
  const extensions: Extension[] = [
    lineNumbers(),
    history(),
    autocompletion(),
    highlightSelectionMatches(),

    // Base keymaps
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...lintKeymap,
    ]),
  ];

  // Language support
  if (config.language === 'markdown') {
    extensions.push(markdown());
  } else if (config.language === 'vim') {
    const isDark = config.theme === 'dark';
    extensions.push(createVimHighlighting(isDark));
  }

  // Syntax highlighting with blue headings
  const highlight = config.theme === 'dark' ? darkThemeHighlight : lightThemeHighlight;
  extensions.push(syntaxHighlighting(highlight));

  // Base theme colors
  const isDark = config.theme === 'dark';
  extensions.push(
    EditorView.theme({
      '&': {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Allow shrinking in flex containers so scrollbars stay visible
        minWidth: '0',
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
        color: isDark ? '#c9d1d9' : '#24292f',
      },
      '.cm-scroller': {
        flex: '1 1 auto',
        // Be explicit: vertical scroll only; avoid horizontal unless necessary
        overflowY: 'auto !important',
        overflowX: 'hidden',
        minHeight: '0',
        minWidth: '0',
        // Reserve space for scrollbars inside the box to prevent clipping
        scrollbarGutter: 'stable both-edges',
        scrollbarWidth: 'thin', // For Firefox
        scrollbarColor: isDark ? '#484f58 #0d1117' : '#d1d5da #ffffff', // For Firefox
      },
      // Webkit scrollbar styling (Chrome, Safari, Edge)
      '.cm-scroller::-webkit-scrollbar': {
        width: '12px',
        height: '12px',
      },
      '.cm-scroller::-webkit-scrollbar-track': {
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
      },
      '.cm-scroller::-webkit-scrollbar-thumb': {
        backgroundColor: isDark ? '#484f58' : '#d1d5da',
        borderRadius: '6px',
        border: `2px solid ${isDark ? '#0d1117' : '#ffffff'}`,
      },
      '.cm-scroller::-webkit-scrollbar-thumb:hover': {
        backgroundColor: isDark ? '#6e7681' : '#959da5',
      },
      '.cm-scroller::-webkit-scrollbar-corner': {
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
      },
      '.cm-content': {
        padding: '8px 0',
        caretColor: isDark ? '#58a6ff' : '#0969da',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: isDark ? '#58a6ff' : '#0969da',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? '#388bfd26' : '#b6e3ff',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? '#161b22' : '#f6f8fa',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
        color: isDark ? '#6e7681' : '#57606a',
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? '#161b22' : '#f6f8fa',
      },
    })
  );

  // Custom styling
  if (config.fontSize || config.fontFamily) {
    const customStyles: Record<string, string | number> = {};
    if (config.fontSize) {
      customStyles.fontSize = `${config.fontSize}px`;
    }
    if (config.fontFamily) {
      customStyles.fontFamily = config.fontFamily;
    }
    extensions.push(
      EditorView.theme({
        '&': customStyles,
      })
    );
  }

  // Read-only mode
  if (config.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  // Vim mode
  if (config.vimMode) {
    extensions.push(vim());
  }

  // Change listener
  if (config.onChange) {
    extensions.push(
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          config.onChange?.(update.state.doc.toString());
        }
      })
    );
  }

  // Cursor position listener
  if (config.onCursorLineChange) {
    extensions.push(
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.selectionSet) {
          const line = update.state.doc.lineAt(update.state.selection.main.head).number;
          config.onCursorLineChange?.(line);
        }
      })
    );
  }

  // Focus listener
  if (config.onFocusChange) {
    extensions.push(
      EditorView.focusChangeEffect.of((_state, focusing) => {
        config.onFocusChange?.(focusing);
        return null;
      })
    );
  }

  return extensions;
}

/**
 * Create a CodeMirror editor instance
 */
export function createEditor(
  parent: HTMLElement,
  config: EditorConfig
): EditorView {
  const state = EditorState.create({
    doc: config.value,
    extensions: createBaseExtensions(config),
  });

  return new EditorView({
    state,
    parent,
  });
}

/**
 * Get Vim API for custom mappings
 */
export function getVimApi() {
  return Vim;
}

/**
 * Update editor configuration
 */
export function reconfigureEditor(
  view: EditorView,
  config: Partial<EditorConfig>
): void {
  const currentDoc = view.state.doc.toString();
  const newConfig: EditorConfig = {
    value: currentDoc,
    ...config,
  };

  view.setState(
    EditorState.create({
      doc: currentDoc,
      extensions: createBaseExtensions(newConfig),
    })
  );
}

/**
 * Set editor value while preserving focus and cursor position when possible
 */
export function setEditorValue(view: EditorView, value: string, options?: { preserveFocus?: boolean }): void {
  const preserveFocus = options?.preserveFocus ?? true;
  const hasFocus = view.hasFocus;
  const cursorPos = hasFocus ? view.state.selection.main.head : null;

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: value,
    },
  });

  // Restore focus and cursor position if editor had focus
  if (preserveFocus && hasFocus && cursorPos !== null) {
    // Clamp cursor position to new document length
    const newLength = view.state.doc.length;
    const newCursorPos = Math.min(cursorPos, newLength);

    view.dispatch({
      selection: { anchor: newCursorPos, head: newCursorPos },
    });
    view.focus();
  }
}

/**
 * Get editor value
 */
export function getEditorValue(view: EditorView): string {
  return view.state.doc.toString();
}

/**
 * Focus the editor
 */
export function focusEditor(view: EditorView): void {
  view.focus();
}

/**
 * Get cursor position
 */
export function getCursorPosition(view: EditorView): { line: number; column: number } {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return {
    line: line.number,
    column: pos - line.from + 1,
  };
}
