import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { marked } from 'marked';
import { FileText } from 'lucide-react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import { mermaidSVGCache } from '../../mindmap/utils/mermaidCache';
import { logger } from '@shared/utils';
import mermaid from 'mermaid';

// Constants to prevent re-renders
const EDITOR_HEIGHT = "100%";
const EDITOR_WIDTH = "100%";
const EDITOR_LANGUAGE = "markdown";
const EDITOR_LOADING_TEXT = "エディターを読み込み中...";

interface MarkdownEditorProps {
  value: string;
  updatedAt?: string;
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
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = React.memo(({
  value,
  updatedAt,
  onChange,
  onSave,
  className = '',
  height: _height = '400px',
  autoFocus = false,
  readOnly = false,
  onResize,
  onCursorLineChange, onFocusChange
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const lastUpdatedAtRef = useRef<string>('');
  const hoveredRef = useRef(false);
  // Tracks whether Vim is currently enabled on the Monaco instance
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  // Editor is controlled by `value`; no internal mirror state is needed
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings, clearMermaidRelatedCaches } = useMindMapStore();

  // Extract mermaid code blocks from markdown
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/gi;
    const blocks: string[] = [];
    let match;
    while ((match = mermaidRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }, []);

  // Debounced onChange handler with updatedAt-based deduplication
  const handleEditorChange = useCallback((newValue: string) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced timeout
    debounceTimeoutRef.current = setTimeout(() => {
      // Check if mermaid blocks have changed and clear all related caches if needed
      const oldMermaidBlocks = extractMermaidBlocks(value);
      const newMermaidBlocks = extractMermaidBlocks(newValue);

      // If any mermaid blocks have changed, clear all mermaid-related caches
      const hasChanges = oldMermaidBlocks.length !== newMermaidBlocks.length ||
        oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
        newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock));

      if (hasChanges) {
        // Use the comprehensive cache clearing function
        clearMermaidRelatedCaches();
      }

      onChange(newValue);
    }, 200); // 200ms debounce to match MarkdownStream
  }, [onChange, value, extractMermaidBlocks, clearMermaidRelatedCaches]);

  // Initialize mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {
      // ignore re-initialize errors
    }
  }, []);

  // Process mermaid diagrams in HTML
  const processMermaidInHtml = useCallback(async (html: string): Promise<string> => {
    // Find all mermaid code blocks in the HTML
    const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
    let processedHtml = html;
    let match;
    const promises: Promise<string>[] = [];
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = mermaidRegex.exec(html)) !== null) {
      const fullMatch = match[0];
      const mermaidCode = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

      const promise = (async () => {
        try {
          // Check cache first
          const cached = mermaidSVGCache.get(mermaidCode);
          if (cached) {
            return cached.svg;
          }

          // Generate new SVG
          const id = `mmd-preview-${Math.random().toString(36).slice(2, 10)}`;
          const { svg } = await mermaid.render(id, mermaidCode);

          // Parse and normalize SVG
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const el = doc.documentElement;

          // Set responsive attributes
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.setAttribute('width', '100%');
          el.setAttribute('height', 'auto');
          el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          el.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 12px 0;');

          const serializer = new XMLSerializer();
          const adjustedSvg = serializer.serializeToString(el);

          // Cache the result
          const vb = el.getAttribute('viewBox');
          if (vb) {
            const parts = vb.split(/[ ,]+/).map(Number);
            if (parts.length === 4) {
              mermaidSVGCache.set(mermaidCode, adjustedSvg, { width: parts[2], height: parts[3] });
            }
          }

          return adjustedSvg;
        } catch (error) {
          logger.warn('Mermaid rendering error:', error);
          return `<div style="border: 1px solid #e74c3c; border-radius: 4px; padding: 12px; background: #fdf2f2; color: #c0392b;">
            <strong>Mermaid rendering error:</strong><br/>
            <code>${mermaidCode}</code>
          </div>`;
        }
      })();

      promises.push(promise.then(svg => {
        replacements.push({ original: fullMatch, replacement: svg });
        return svg;
      }));
    }

    // Wait for all mermaid diagrams to be processed
    await Promise.all(promises);

    // Apply all replacements
    for (const { original, replacement } of replacements) {
      processedHtml = processedHtml.replace(original, replacement);
    }

    return processedHtml;
  }, []);

  // Convert markdown to HTML (memoized for performance)
  const previewHtml = useMemo((): string => {
    try {
      const result = marked.parse(value || '');
      return typeof result === 'string' ? result : '';
    } catch (error) {
      logger.warn('Markdown parsing error:', error);
      return '<p>マークダウンの解析でエラーが発生しました</p>';
    }
  }, [value]);

  // Process mermaid diagrams and get final HTML
  const [processedHtml, setProcessedHtml] = useState<string>('');

  useEffect(() => {
    const processHtml = async () => {
      try {
        const processed = await processMermaidInHtml(previewHtml);
        setProcessedHtml(processed);
      } catch (error) {
        logger.warn('Error processing mermaid in HTML:', error);
        // Fallback to original HTML if processing fails
        setProcessedHtml(previewHtml);
      }
    };
    processHtml();
  }, [previewHtml, processMermaidInHtml]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco as unknown as typeof import('monaco-editor');
    // Track text focus to avoid emitting cursor events from programmatic updates
    const isTextFocusedRef = { current: false } as { current: boolean };

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

    // Cycle modes: edit -> preview -> split -> edit
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      setMode(prev => {
        const next = prev === 'edit' ? 'preview' : prev === 'preview' ? 'split' : 'edit';
        if (next === 'preview') setTimeout(() => { try { previewPaneRef.current?.focus(); } catch {} }, 0);
        return next;
      });
    });

    // Do not intercept keystrokes here; editor must handle raw input as-is.

    // Cursor and focus listeners
    editor.onDidChangeCursorPosition((e) => {
      // Avoid syncing selection if editor doesn't have focus
      const hasFocus = editor.hasTextFocus?.() ?? false;
      if (!hasFocus) return;
      const line = e.position.lineNumber;
      onCursorLineChange?.(line);
    });
    // Focus gained in text input area
    editor.onDidFocusEditorText?.(async () => {
      onFocusChange?.(true);
      isTextFocusedRef.current = true;
      // Enable Vim only when editor has focus and editor setting is on
      if ((settings as any).vimEditor && !isVimEnabled) {
        const ok = await enableVimMode(editor, monaco);
        if (ok) setIsVimEnabled(true);
      }
    });

    // Treat text blur as leaving the editor (original behavior)
    editor.onDidBlurEditorText?.(() => {
      onFocusChange?.(false);
      isTextFocusedRef.current = false;
      // Disable Vim when focus leaves editor so app shortcuts work
      if (isVimEnabled) {
        disableVimMode();
      }
    });

    // Auto-focus when mounted (only if autoFocus is enabled)
    if (autoFocus) {
      editor.focus();
    }
  };

  const enableVimMode = async (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')): Promise<boolean> => {
    try {
      // Dynamically import monaco-vim for Vim mode support
      const mod: any = await import('monaco-vim');
      const init: any = mod?.initVimMode || mod?.default || mod;
      if (typeof init !== 'function') {
        throw new Error('monaco-vim init function not found');
      }

      // Initialize Vim mode (status bar element optional)
      const vimMode = init(editor);

      // Add Vim commands if available in this version
      try {
        if (vimMode && typeof (vimMode as any).defineEx === 'function') {
          (vimMode as any).defineEx('write', 'w', () => { onSave?.(); });
        }
      } catch {}

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
      return true;
    } catch (error) {
      logger.warn('Vim mode not available:', error);
      setIsVimEnabled(false);
      return false;
    }
  };

  const disableVimMode = useCallback(() => {
    if (!editorRef.current) return;
    const vimMode = (editorRef.current as any)._vimMode;

    if (vimMode) {
      vimMode.dispose();
      delete (editorRef.current as any)._vimMode;
    }


    const commandIds = (editorRef.current as any)._vimModeCommandIds;
    if (commandIds) {
      delete (editorRef.current as any)._vimModeCommandIds;
    }

    setIsVimEnabled(false);
  }, []);

  // Mode change is handled via Ctrl/Cmd+L cycling and preview key handler

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

  // Remove imperative override; rely on `value` prop to update editor content

  // External cursor sync intentionally removed per request


  // Apply external value changes to editor model with updatedAt-based deduplication
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    try {
      const current = ed.getValue();
      const next = value || '';

      // 同じ内容なら何もしない
      if (current === next) return;

      // updatedAtが提供され、それが前回と同じなら重複更新として無視
      if (updatedAt && updatedAt === lastUpdatedAtRef.current) return;

      // updatedAtを更新
      if (updatedAt) {
        lastUpdatedAtRef.current = updatedAt;
      }

      // エディターの値を更新
      const hasFocus = ed.hasTextFocus?.() ?? false;
      const selection = hasFocus ? ed.getSelection() : null;
      ed.setValue(next);

      // フォーカス中なら選択範囲を復元
      if (hasFocus && selection) {
        try { ed.setSelection(selection); } catch {}
      }
    } catch {}
  }, [value, updatedAt]);

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

  // React to settings.vimEditor changes
  useEffect(() => {
    const apply = async () => {
      if (!editorRef.current) return;
      // Only enable when setting is on AND editor has focus
      const hasFocus = editorRef.current.hasTextFocus?.() ?? false;
      if ((settings as any).vimEditor && hasFocus && !isVimEnabled) {
        const monaco = monacoRef.current || (await import('monaco-editor'));
        const ok = await enableVimMode(editorRef.current, monaco);
        if (ok) setIsVimEnabled(true);
      } else if (!(settings as any).vimEditor && isVimEnabled) {
        disableVimMode();
      }
    };
    apply();
  }, [(settings as any).vimEditor, isVimEnabled, disableVimMode]);

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

  // Document-level Ctrl+L routing based on hover when this editor doesn't have focus
  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      const isCtrlL = (e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L');
      if (!isCtrlL) return;
      // Hover always wins: if this editor is hovered, it handles Ctrl+L exclusively
      if (hoveredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setMode(prev => {
          const next = prev === 'edit' ? 'preview' : prev === 'preview' ? 'split' : 'edit';
          if (next === 'preview') setTimeout(() => { try { previewPaneRef.current?.focus(); } catch {} }, 0);
          return next;
        });
      }
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => { document.removeEventListener('keydown', onDocKeyDown, true); };
  }, []);

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
        debounceTimeoutRef.current = null;
      }
      // Reset updatedAt tracking
      lastUpdatedAtRef.current = '';
      // Cleanup Vim mode on unmount
      if (editorRef.current) {
        // Disable and cleanup Vim if enabled
        disableVimMode();
      }
    };
  }, [disableVimMode]);

  // Disable Vim when clicking outside the editor to restore app shortcuts
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (!editorRef.current) return;
      const dom = editorRef.current.getDomNode();
      if (!dom) return;
      const target = e.target as Node | null;
      if (target && !dom.contains(target)) {
        // Explicitly blur Monaco to move focus away so global shortcuts work
        try { (editorRef.current as any).blur?.(); } catch (_) {}
        if (isVimEnabled) disableVimMode();
      }
    };
    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [isVimEnabled, disableVimMode]);

  return (
    <div
      ref={rootRef}
      className={`markdown-editor ${className}`}
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
    >
      
      <div className={`editor-container mode-${mode}`}>
        {(mode === 'edit' || mode === 'split') && (
          <div className="editor-pane">
            <Editor
              height={EDITOR_HEIGHT}
              width={EDITOR_WIDTH}
              defaultLanguage={EDITOR_LANGUAGE}
              defaultValue={value}
              onChange={memoizedHandleEditorChange}
              onMount={handleEditorDidMount}
              theme={editorTheme}
              loading={EDITOR_LOADING_TEXT}
              options={editorOptions}
            />
          </div>
        )}
        
        {(mode === 'preview' || mode === 'split') && (
          <div
            className="preview-pane"
            tabIndex={0}
            ref={previewPaneRef}
            onMouseDown={() => {
              try { previewPaneRef.current?.focus(); } catch {}
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                setMode(prev => prev === 'preview' ? 'split' : prev === 'split' ? 'edit' : 'preview');
              }
            }}
          >
            <div className="preview-content">
              {value.trim() ? (
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: processedHtml || previewHtml }}
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
