/**
 * CodeMirror 6 editor setup and configuration
 */

import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { vim, Vim } from '@replit/codemirror-vim';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';

export interface EditorConfig {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  vimMode?: boolean;
  language?: 'markdown' | 'plain';
  fontSize?: number;
  fontFamily?: string;
  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;
}

/**
 * Blue-based heading color scheme for markdown
 */
const blueHeadingHighlight = HighlightStyle.define([
  // Light theme headings (blue gradient from darker to lighter)
  { tag: tags.heading1, color: '#0052cc', fontWeight: 'bold', fontSize: '1.8em' },
  { tag: tags.heading2, color: '#0065ff', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading3, color: '#2684ff', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading4, color: '#4c9aff', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading5, color: '#79b8ff', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading6, color: '#b3d4ff', fontWeight: 'bold', fontSize: '1.0em' },
]);

const blueHeadingHighlightDark = HighlightStyle.define([
  // Dark theme headings (lighter blues for better contrast)
  { tag: tags.heading1, color: '#58a6ff', fontWeight: 'bold', fontSize: '1.8em' },
  { tag: tags.heading2, color: '#79c0ff', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading3, color: '#a5d6ff', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading4, color: '#b3d4ff', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading5, color: '#c2e0ff', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading6, color: '#d0ebff', fontWeight: 'bold', fontSize: '1.0em' },
]);

/**
 * Create base extensions for CodeMirror
 */
export function createBaseExtensions(config: EditorConfig): Extension[] {
  const extensions: Extension[] = [
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
  }

  // Theme
  const theme = config.theme === 'dark' ? githubDark : githubLight;
  extensions.push(theme);

  // Blue heading colors for markdown
  const headingHighlight = config.theme === 'dark'
    ? blueHeadingHighlightDark
    : blueHeadingHighlight;
  extensions.push(syntaxHighlighting(headingHighlight));

  // Custom styling
  if (config.fontSize || config.fontFamily) {
    extensions.push(
      EditorView.theme({
        '&': {
          fontSize: config.fontSize ? `${config.fontSize}px` : undefined,
          fontFamily: config.fontFamily || undefined,
        },
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
          config.onChange!(update.state.doc.toString());
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
          config.onCursorLineChange!(line);
        }
      })
    );
  }

  // Focus listener
  if (config.onFocusChange) {
    extensions.push(
      EditorView.focusChangeEffect.of((state, focusing) => {
        config.onFocusChange!(focusing);
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
 * Set editor value
 */
export function setEditorValue(view: EditorView, value: string): void {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: value,
    },
  });
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
