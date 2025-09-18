import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { marked } from 'marked';
import { PenTool, Eye, SplitSquareHorizontal, FileText } from 'lucide-react';
import { useMindMapStore } from '../../core/store/mindMapStore';
import { logger } from '../utils/logger';

// Constants to prevent re-renders
const EDITOR_HEIGHT = "100%";
const EDITOR_WIDTH = "100%";
const EDITOR_LANGUAGE = "markdown";
const EDITOR_LOADING_TEXT = "エディターを読み込み中...";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  className?: string;
  height?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onResize?: () => void;
  // Cursor sync hooks
  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;
  // External override text to apply imperatively (to reduce flicker)
  externalOverride?: string;
  allowExternalOverride?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = React.memo(({ 
  value,
  onChange,
  onSave,
  className = '',
  height: _height = '400px',
  autoFocus = false,
  readOnly = false,
  onResize,
  onCursorLineChange, onFocusChange,
  externalOverride, allowExternalOverride = false
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const ignoreExternalChangeRef = useRef(false);
  // Tracks whether Vim is currently enabled on the Monaco instance
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings } = useMindMapStore();

  // Initialize internal value on first mount and when prop changes (for preview)
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  // Debounced onChange handler
  const handleEditorChange = useCallback((newValue: string) => {
    if (ignoreExternalChangeRef.current) {
      return; // ignore programmatic updates from nodes->markdown
    }
    setInternalValue(newValue);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced timeout
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300); // 300ms debounce
  }, [onChange]);

  // Convert markdown to HTML (memoized for performance)
  const previewHtml = useMemo((): string => {
    try {
      const result = marked.parse(internalValue || '');
      return typeof result === 'string' ? result : '';
    } catch (error) {
      logger.warn('Markdown parsing error:', error);
      return '<p>マークダウンの解析でエラーが発生しました</p>';
    }
  }, [internalValue]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor settings
    editor.updateOptions({
      wordWrap: 'on',
      minimap: { enabled: false },
      lineNumbers: 'on',
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || 'system-ui',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'boundary',
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'always',
      glyphMargin: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      readOnly
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Cursor and focus listeners
    editor.onDidChangeCursorPosition((e) => {
      const line = e.position.lineNumber;
      onCursorLineChange?.(line);
    });
    editor.onDidFocusEditorText?.(() => onFocusChange?.(true));
    editor.onDidBlurEditorText?.(() => onFocusChange?.(false));

    // Enable Vim mode based on settings
    if (settings.vimMode) {
      enableVimMode(editor, monaco);
      setIsVimEnabled(true);
    }

    // Auto-focus when mounted (only if autoFocus is enabled)
    if (autoFocus) {
      editor.focus();
    }
  };

  const enableVimMode = async (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    try {
      // Dynamically import monaco-vim for Vim mode support
      const { initVimMode } = await import('monaco-vim');

      // Initialize Vim mode with focus restriction
      const vimMode = initVimMode(editor, document.getElementById('vim-statusbar'));

      // Prevent vim mode from interfering with global key events
      // We'll add a global event listener to prevent vim mode from capturing
      // keys when the editor doesn't have focus
      const editorDom = editor.getDomNode();
      let globalKeyListener: ((e: KeyboardEvent) => void) | null = null;

      if (editorDom) {
        globalKeyListener = (e: KeyboardEvent) => {
          const activeElement = document.activeElement;
          const editorContainer = editorDom.closest('.monaco-editor');

          // If focus is outside the editor container, ensure vim doesn't interfere
          if (!activeElement || !editorContainer || !editorContainer.contains(activeElement)) {
            // Stop vim from processing this event by preventing it from reaching vim's listeners
            e.stopImmediatePropagation();
          }
        };

        // Add the listener in capture phase to intercept before vim mode processes it
        document.addEventListener('keydown', globalKeyListener, true);

        // Store the listener for cleanup
        (editor as any)._vimModeGlobalListener = globalKeyListener;
      }

      // Add Vim commands
      vimMode.defineEx('write', 'w', () => {
        onSave?.();
      });

      // Preserve important Monaco keyboard shortcuts that should work in vim mode
      // These commands will be available regardless of vim mode state
      const preservedCommands = [
        // Save command (Ctrl+S / Cmd+S)
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
          handler: () => onSave?.(),
        },
        // Delete key should work in insert mode and normal editing
        {
          keybinding: monaco.KeyCode.Delete,
          handler: () => {
            // Only handle Delete if we're not in a vim mode that should handle it
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              // Let Monaco handle the delete in insert/replace mode
              return false; // Return false to let Monaco handle it
            }
            // In normal/visual mode, let vim handle it
            return false;
          },
        },
        // Backspace key
        {
          keybinding: monaco.KeyCode.Backspace,
          handler: () => {
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              return false; // Let Monaco handle it
            }
            return false;
          },
        },
        // Common editing shortcuts that should work in insert mode
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
          handler: () => {
            editor.trigger('keyboard', 'undo', null);
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
          handler: () => {
            editor.trigger('keyboard', 'redo', null);
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
          handler: () => {
            editor.trigger('keyboard', 'redo', null);
          },
        },
        // Copy, Cut, Paste should work in insert mode
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC,
          handler: () => {
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
            }
            return false; // Let vim handle it in other modes
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX,
          handler: () => {
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
            }
            return false; // Let vim handle it in other modes
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
          handler: () => {
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
            }
            return false; // Let vim handle it in other modes
          },
        },
        // Select All
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA,
          handler: () => {
            const vimState = (vimMode as any).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.selectAll', null);
            }
            return false; // Let vim handle it in other modes
          },
        }
      ];

      // Add the preserved commands
      const commandIds: string[] = [];
      preservedCommands.forEach((cmd, index) => {
        const commandId = `vimModePreserved_${index}`;
        const disposable = editor.addCommand(cmd.keybinding, cmd.handler);
        if (disposable) {
          commandIds.push(commandId);
        }
      });

      // Store vim mode instance and command IDs for cleanup
      (editor as any)._vimMode = vimMode;
      (editor as any)._vimModeCommandIds = commandIds;
    } catch (error) {
      logger.warn('Vim mode not available:', error);
      setIsVimEnabled(false);
    }
  };

  const disableVimMode = useCallback(() => {
    if (!editorRef.current) return;
    const vimMode = (editorRef.current as any)._vimMode;
    const globalListener = (editorRef.current as any)._vimModeGlobalListener;

    if (vimMode) {
      vimMode.dispose();
      delete (editorRef.current as any)._vimMode;
    }

    if (globalListener) {
      document.removeEventListener('keydown', globalListener, true);
      delete (editorRef.current as any)._vimModeGlobalListener;
    }

    const commandIds = (editorRef.current as any)._vimModeCommandIds;
    if (commandIds) {
      delete (editorRef.current as any)._vimModeCommandIds;
    }

    setIsVimEnabled(false);
  }, []);

  // Memoized mode change handlers
  const setEditMode = useCallback(() => setMode('edit'), []);
  const setPreviewMode = useCallback(() => setMode('preview'), []);
  const setSplitMode = useCallback(() => setMode('split'), []);

  // Memoized Monaco Editor props to prevent re-renders
  const editorTheme = useMemo(() =>
    settings.theme === 'dark' ? 'vs-dark' : 'vs',
    [settings.theme]
  );

  const editorOptions = useMemo(() => ({
    selectOnLineNumbers: true,
    roundedSelection: false,
    readOnly,
    cursorStyle: 'line' as const,
    automaticLayout: true,
    // キーボード関連の設定を明示的に指定
    acceptSuggestionOnEnter: 'off' as const,
    acceptSuggestionOnCommitCharacter: false,
    quickSuggestions: false,
    parameterHints: { enabled: false },
    suggestOnTriggerCharacters: false,
    tabCompletion: 'off' as const,
    wordBasedSuggestions: 'off' as const
  }), [readOnly]);

  const memoizedHandleEditorChange = useCallback((newValue: string | undefined) => {
    handleEditorChange(newValue ?? '');
  }, [handleEditorChange]);

  // Imperatively apply external override to the editor without re-mounting
  useEffect(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    if (!allowExternalOverride) return;
    const newText = externalOverride ?? '';
    const currentText = model.getValue();
    if (newText === currentText) return;
    const view = ed.saveViewState();
    ignoreExternalChangeRef.current = true;
    model.setValue(newText);
    if (view) ed.restoreViewState(view);
    setInternalValue(newText);
    // Clear ignore flag on next frame so user edits are captured
    const tid = setTimeout(() => { ignoreExternalChangeRef.current = false; }, 0);
    return () => clearTimeout(tid);
  }, [externalOverride, allowExternalOverride]);

  // External cursor sync intentionally removed per request


  // Update theme and font settings when settings change
  useEffect(() => {
    if (editorRef.current) {
      // Update theme
      const monaco = editorRef.current.getModel()?.getLanguageId();
      if (monaco) {
        import('monaco-editor').then((monacoModule) => {
          monacoModule.editor.setTheme(settings.theme === 'dark' ? 'vs-dark' : 'vs');
        });
      }

      // Update font settings
      editorRef.current.updateOptions({
        fontSize: settings.fontSize || 14,
        fontFamily: settings.fontFamily || 'system-ui'
      });
    }
  }, [settings.theme, settings.fontSize, settings.fontFamily]);

  // React to settings.vimMode changes
  useEffect(() => {
    const apply = async () => {
      if (!editorRef.current) return;
      if (settings.vimMode && !isVimEnabled) {
        const monaco = await import('monaco-editor');
        await enableVimMode(editorRef.current, monaco);
        setIsVimEnabled(true);
      } else if (!settings.vimMode && isVimEnabled) {
        disableVimMode();
      }
    };
    apply();
  }, [settings.vimMode, isVimEnabled, disableVimMode]);

  // Handle external resize events
  useEffect(() => {
    if (onResize && editorRef.current) {
      // Force layout recalculation when onResize changes
      const timeoutId = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [onResize]);

  // Expose layout method for external use and ResizeObserver
  useEffect(() => {
    const resizeHandler = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    // Set up a custom resize handler that can be triggered externally
    if (onResize) {
      (window as any).__markdownEditor_forceLayout = resizeHandler;
    }

    // Set up ResizeObserver for more reliable resize detection
    let resizeObserver: ResizeObserver | null = null;
    if (editorRef.current) {
      const editorElement = editorRef.current.getDomNode();
      if (editorElement && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          resizeHandler();
        });
        resizeObserver.observe(editorElement.parentElement || editorElement);
      }
    }

    return () => {
      if ((window as any).__markdownEditor_forceLayout === resizeHandler) {
        delete (window as any).__markdownEditor_forceLayout;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [onResize]);

  useEffect(() => {
    return () => {
      // Cleanup debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      // Cleanup Vim mode on unmount
      if (editorRef.current) {
        // Disable and cleanup Vim if enabled
        disableVimMode();
      }
    };
  }, [disableVimMode]);

  return (
    <div className={`markdown-editor ${className}`}>
      <div className="editor-toolbar">
        <div className="editor-controls">
          <div className="mode-toggles">
            <button
              type="button"
              onClick={setEditMode}
              className={`mode-toggle ${mode === 'edit' ? 'active' : ''}`}
              title="編集モード"
            >
              <PenTool size={16} /> 編集
            </button>
            <button
              type="button"
              onClick={setPreviewMode}
              className={`mode-toggle ${mode === 'preview' ? 'active' : ''}`}
              title="プレビューモード"
            >
              <Eye size={16} /> プレビュー
            </button>
            <button
              type="button"
              onClick={setSplitMode}
              className={`mode-toggle ${mode === 'split' ? 'active' : ''}`}
              title="分割表示モード"
            >
              <SplitSquareHorizontal size={16} /> 分割
            </button>
          </div>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="save-button"
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          )}
        </div>
      </div>
      
      <div className={`editor-container mode-${mode}`}>
        {(mode === 'edit' || mode === 'split') && (
          <div className="editor-pane">
            <Editor
              height={EDITOR_HEIGHT}
              width={EDITOR_WIDTH}
              defaultLanguage={EDITOR_LANGUAGE}
              defaultValue={internalValue}
              onChange={memoizedHandleEditorChange}
              onMount={handleEditorDidMount}
              theme={editorTheme}
              loading={EDITOR_LOADING_TEXT}
              options={editorOptions}
            />
          </div>
        )}
        
        {(mode === 'preview' || mode === 'split') && (
          <div className="preview-pane">
            <div className="preview-content">
              {internalValue.trim() ? (
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="preview-empty">
                  <div className="preview-empty-icon">
                    <FileText size={48} />
                  </div>
                  <div className="preview-empty-message">プレビューするマークダウンテキストを入力してください</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isVimEnabled && (
        <div id="vim-statusbar" className="vim-statusbar">
          <span className="vim-mode-indicator">-- NORMAL --</span>
        </div>
      )}
      
      <style>{`
        .markdown-editor {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow: hidden;
          background-color: var(--bg-primary);
        }

        .editor-toolbar {
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .editor-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .mode-toggles {
          display: flex;
          gap: 4px;
        }

        .mode-toggle {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .mode-toggle:hover {
          background: var(--hover-color);
          border-color: var(--border-color);
        }

        .mode-toggle.active {
          background: var(--accent-color);
          border-color: var(--accent-color);
          color: white;
        }

        

        .save-button {
          background: var(--accent-color);
          border: 1px solid var(--accent-color);
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .save-button:hover {
          background: var(--accent-color);
          opacity: 0.8;
        }

        .editor-container {
          flex: 1;
          display: flex;
          min-height: 0;
        }

        .editor-container.mode-edit {
          flex-direction: column;
        }

        .editor-container.mode-preview {
          flex-direction: column;
        }

        .editor-container.mode-split {
          flex-direction: row;
        }

        .mode-edit .editor-pane {
          flex: 1;
          overflow: hidden;
        }

        .mode-preview .preview-pane {
          flex: 1;
          overflow: hidden;
        }

        .mode-split .editor-pane {
          flex: 1;
          overflow: hidden;
          border-right: 1px solid var(--border-color);
        }

        .mode-split .preview-pane {
          flex: 1;
          overflow: hidden;
          border-right: none;
          border-left: none;
        }

        .editor-pane {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .preview-pane {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          background: var(--bg-primary);
        }

        .preview-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          min-height: 0;
          height: 100%;
        }

        .markdown-preview {
          line-height: 1.6;
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .markdown-preview h1,
        .markdown-preview h2,
        .markdown-preview h3,
        .markdown-preview h4,
        .markdown-preview h5,
        .markdown-preview h6 {
          margin: 20px 0 10px 0;
          font-weight: 600;
          line-height: 1.25;
        }

        .markdown-preview h1 {
          font-size: 2em;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }

        .markdown-preview h2 {
          font-size: 1.5em;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }

        .markdown-preview h3 {
          font-size: 1.25em;
        }

        .markdown-preview p {
          margin: 12px 0;
        }

        .markdown-preview ul,
        .markdown-preview ol {
          margin: 12px 0;
          padding-left: 20px;
        }

        .markdown-preview li {
          margin: 4px 0;
        }

        .markdown-preview pre {
          background: var(--bg-tertiary);
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          border: 1px solid var(--border-color);
          margin: 12px 0;
        }

        .markdown-preview code {
          background: var(--bg-tertiary);
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 85%;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }

        .markdown-preview pre code {
          background: none;
          padding: 0;
        }

        .markdown-preview blockquote {
          border-left: 4px solid var(--border-color);
          padding: 0 16px;
          margin: 12px 0;
          color: var(--text-secondary);
        }

        .markdown-preview table {
          border-collapse: collapse;
          margin: 12px 0;
          width: 100%;
        }

        .markdown-preview th,
        .markdown-preview td {
          border: 1px solid var(--border-color);
          padding: 8px 12px;
          text-align: left;
        }

        .markdown-preview th {
          background: var(--bg-secondary);
          font-weight: 600;
        }

        .markdown-preview img {
          max-width: 100%;
          height: auto;
          margin: 12px 0;
        }

        .markdown-preview a {
          color: var(--accent-color);
          text-decoration: none;
        }

        .markdown-preview a:hover {
          text-decoration: underline;
        }

        .preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          text-align: center;
        }

        .preview-empty-icon {
          margin-bottom: 16px;
          opacity: 0.6;
          color: var(--text-secondary);
        }

        .preview-empty-message {
          font-size: 14px;
          line-height: 1.5;
        }

        .vim-statusbar {
          background-color: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          padding: 4px 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          color: var(--text-primary);
          min-height: 20px;
          display: flex;
          align-items: center;
        }

        .vim-mode-indicator {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
});

export default MarkdownEditor;
