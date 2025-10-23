import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import { FileText, X } from 'lucide-react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import { mermaidSVGCache } from '../../mindmap/utils/mermaidCache';
import { CodeMirrorEditor, type CodeMirrorEditorRef } from '@shared/codemirror';
import { getVimApi } from '../vim/codemirror-adapter';
import { logger, generateId } from '@shared/utils';
import mermaid from 'mermaid';

interface MarkdownEditorProps {
  value: string;
  updatedAt?: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onClose?: () => void;
  className?: string;
  height?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onResize?: () => void;

  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;

  mapIdentifier?: { mapId: string; workspaceId?: string | null } | null;

  title?: string; // Panel title to display in toolbar
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = React.memo(({
  value,
  updatedAt,
  onChange,
  onSave,
  onClose,
  className = '',
  autoFocus = false,
  readOnly = false,
  onCursorLineChange,
  onFocusChange,
  title = 'Markdown',
}) => {
  const editorRef = useRef<CodeMirrorEditorRef>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef(false);
  const lastUpdatedAtRef = useRef<string>('');
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings, clearMermaidRelatedCaches } = useMindMapStore();

  // Extract mermaid blocks without relying on heavy regex
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const blocks: string[] = [];
    const lower = text.toLowerCase();
    let idx = 0;
    while (idx < text.length) {
      const start = lower.indexOf('```mermaid', idx);
      if (start < 0) break;
      const lineEnd = text.indexOf('\n', start);
      const contentStart = lineEnd >= 0 ? lineEnd + 1 : start + '```mermaid'.length;
      const end = text.indexOf('```', contentStart);
      const raw = end >= 0 ? text.slice(contentStart, end) : text.slice(contentStart);
      blocks.push(raw.trim());
      idx = end >= 0 ? end + 3 : text.length;
    }
    return blocks;
  }, []);

  // Handle editor change with mermaid cache invalidation
  const handleEditorChange = useCallback((newValue: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const oldMermaidBlocks = extractMermaidBlocks(value);
      const newMermaidBlocks = extractMermaidBlocks(newValue);

      const hasChanges = oldMermaidBlocks.length !== newMermaidBlocks.length ||
        oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
        newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock));

      if (hasChanges) {
        clearMermaidRelatedCaches();
      }

      onChange(newValue);
    }, 200);
  }, [onChange, value, extractMermaidBlocks, clearMermaidRelatedCaches]);

  // Initialize mermaid
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {}
  }, []);

  // Synchronize external updates (from mind map) to editor
  useEffect(() => {
    if (!editorRef.current) return;

    const currentValue = editorRef.current.getValue();
    const nextValue = value;

    // Don't update if values are the same
    if (currentValue === nextValue) return;

    // If updatedAt is provided and it's the same as last time, ignore (duplicate update)
    if (updatedAt && updatedAt === lastUpdatedAtRef.current) return;

    // Update the lastUpdatedAt tracker
    if (updatedAt) {
      lastUpdatedAtRef.current = updatedAt;
    }

    // Update editor value while preserving focus and cursor
    editorRef.current.setValue(nextValue);
  }, [value, updatedAt]);

  // Process mermaid diagrams in HTML
  const processMermaidInHtml = useCallback(async (html: string): Promise<string> => {
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
          const cached = mermaidSVGCache.get(mermaidCode);
          if (cached) {
            return cached.svg;
          }

          const id = generateId('mermaid');
          const { svg } = await mermaid.render(id, mermaidCode);

          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const el = doc.documentElement;

          el.removeAttribute('width');
          el.removeAttribute('height');
          el.setAttribute('width', '100%');
          el.setAttribute('height', 'auto');
          el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          el.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 12px 0;');

          const serializer = new XMLSerializer();
          const adjustedSvg = serializer.serializeToString(el);

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

    await Promise.all(promises);

    for (const { original, replacement } of replacements) {
      processedHtml = processedHtml.replace(original, replacement);
    }

    return processedHtml;
  }, []);

  // Generate preview HTML
  const previewHtml = useMemo((): string => {
    try {
      const result = marked.parse(value || '');
      return typeof result === 'string' ? result : '';
    } catch (error) {
      logger.warn('Markdown parsing error:', error);
      return '<p>マークダウンの解析でエラーが発生しました</p>';
    }
  }, [value]);

  // Render preview with mermaid
  const [renderedPreview, setRenderedPreview] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const processed = await processMermaidInHtml(previewHtml);
      if (!cancelled) {
        setRenderedPreview(processed);
      }
    })();
    return () => { cancelled = true; };
  }, [previewHtml, processMermaidInHtml]);

  // Apply vim custom mappings
  useEffect(() => {
    if (!settings.vimEditor) return;

    const vimApi = getVimApi();
    if (!vimApi) return;

    try {
      // Always yank to system clipboard register (+)
      // Make mappings idempotent by removing existing ones first
      try { vimApi.unmap('y', 'normal'); } catch {}
      try { vimApi.unmap('y', 'visual'); } catch {}
      try { vimApi.unmap('Y', 'normal'); } catch {}

      vimApi.noremap('y', '"+y', 'normal');
      vimApi.noremap('y', '"+y', 'visual');
      vimApi.noremap('Y', '"+Y', 'normal');
    } catch (error) {
      logger.warn('Failed to apply vim mappings:', error);
    }
  }, [settings.vimEditor]);

  // Keyboard shortcut for mode switching (Ctrl/Cmd+L)
  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      const isCtrlL = (e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L');
      if (!isCtrlL) return;

      if (hoveredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        let next: 'edit' | 'preview' | 'split';
        if (mode === 'edit') next = 'preview';
        else if (mode === 'preview') next = 'split';
        else next = 'edit';
        setMode(next);
        if (next === 'preview') {
          setTimeout(() => {
            try { previewPaneRef.current?.focus(); } catch {}
          }, 0);
        }
      }
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => { document.removeEventListener('keydown', onDocKeyDown, true); };
  }, [mode]);

  // Save shortcut (Ctrl/Cmd+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && hoveredRef.current && onSave) {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      lastUpdatedAtRef.current = '';
    };
  }, []);

  // Mouse hover tracking
  const handleMouseEnter = () => { hoveredRef.current = true; };
  const handleMouseLeave = () => { hoveredRef.current = false; };

  // Styles
  const isDark = settings.theme === 'dark';
  const editorTheme = isDark ? 'dark' : 'light';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    minHeight: 0,
    minWidth: 0,
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
  };

  const editorFlex = (mode === 'split' || mode === 'edit') ? 1 : 0;
  const borderColor = isDark ? '#404040' : '#e0e0e0';
  const editorBorderRight = mode === 'split' ? `1px solid ${borderColor}` : 'none';
  const editorContainerStyle: React.CSSProperties = {
    flex: editorFlex,
    display: mode === 'preview' ? 'none' : 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    height: '100%',
    borderRight: editorBorderRight,
  };

  const previewFlex = (mode === 'split' || mode === 'preview') ? 1 : 0;
  const previewContainerStyle: React.CSSProperties = {
    flex: previewFlex,
    display: mode === 'edit' ? 'none' : 'block',
    overflow: 'auto',
    padding: '16px',
    backgroundColor: isDark ? '#252525' : '#fafafa',
  };

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: `1px solid ${isDark ? '#404040' : '#e0e0e0'}`,
    backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5',
    fontSize: '12px',
    color: isDark ? '#cccccc' : '#666666',
  };

  const buttonStyle = (active: boolean): React.CSSProperties => {
    let bg: string;
    if (active) bg = isDark ? '#0e639c' : '#007acc';
    else bg = isDark ? '#3c3c3c' : '#e0e0e0';
    let fg: string;
    if (active) fg = '#ffffff';
    else fg = isDark ? '#cccccc' : '#333333';
    return {
      padding: '4px 12px',
      marginLeft: '8px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      backgroundColor: bg,
      color: fg,
      transition: 'background-color 0.2s',
    };
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FileText size={16} style={{ marginRight: '8px' }} />
          <span>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div>
            <button
              style={buttonStyle(mode === 'edit')}
              onClick={() => setMode('edit')}
              title="Edit mode"
            >
              Edit
            </button>
            <button
              style={buttonStyle(mode === 'split')}
              onClick={() => setMode('split')}
              title="Split mode (Ctrl/Cmd+L)"
            >
              Split
            </button>
            <button
              style={buttonStyle(mode === 'preview')}
              onClick={() => setMode('preview')}
              title="Preview mode"
            >
              Preview
            </button>
          </div>
          {onClose && (
            <button
              style={{
                padding: '4px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isDark ? '#3c3c3c' : '#e0e0e0',
                color: isDark ? '#cccccc' : '#333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onClick={onClose}
              title="Close panel"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#505050' : '#d0d0d0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#3c3c3c' : '#e0e0e0';
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content area (Editor and/or Preview) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, height: '100%' }}>
        {/* Editor pane */}
        <div style={editorContainerStyle}>
          <CodeMirrorEditor
            ref={editorRef}
            value={value}
            onChange={handleEditorChange}
            readOnly={readOnly}
            theme={editorTheme}
            vimMode={settings.vimEditor || false}
            language="markdown"
            fontSize={settings.fontSize || 14}
            fontFamily={settings.fontFamily || 'system-ui'}
            onCursorLineChange={onCursorLineChange}
            onFocusChange={onFocusChange}
            autoFocus={autoFocus}
          />
        </div>

        {/* Preview pane */}
        <div
          ref={previewPaneRef}
          style={previewContainerStyle}
          dangerouslySetInnerHTML={{ __html: renderedPreview }}
          className="markdown-preview"
          data-theme={isDark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';
