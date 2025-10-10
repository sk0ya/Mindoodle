import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import { FileText } from 'lucide-react';
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
  className?: string;
  height?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onResize?: () => void;

  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;

  mapIdentifier?: { mapId: string; workspaceId?: string | null } | null;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = React.memo(({
  value,
  onChange,
  onSave,
  className = '',
  autoFocus = false,
  readOnly = false,
  onCursorLineChange,
  onFocusChange,
}) => {
  const editorRef = useRef<CodeMirrorEditorRef>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef(false);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings, clearMermaidRelatedCaches } = useMindMapStore();

  // Extract mermaid blocks
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/gi;
    const blocks: string[] = [];
    let match;
    while ((match = mermaidRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
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
      // Apply leader key and custom mappings
      // Note: CodeMirror vim API differs from Monaco vim
      // This will be implemented when vim mappings are properly integrated
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
        setMode(prev => {
          const next = prev === 'edit' ? 'preview' : prev === 'preview' ? 'split' : 'edit';
          if (next === 'preview') {
            setTimeout(() => {
              try { previewPaneRef.current?.focus(); } catch {}
            }, 0);
          }
          return next;
        });
      }
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => { document.removeEventListener('keydown', onDocKeyDown, true); };
  }, []);

  // Save shortcut (Ctrl/Cmd+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (hoveredRef.current && onSave) {
          e.preventDefault();
          e.stopPropagation();
          onSave();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onSave]);

  // Mouse hover tracking
  const handleMouseEnter = () => { hoveredRef.current = true; };
  const handleMouseLeave = () => { hoveredRef.current = false; };

  // Styles
  const isDark = settings.theme === 'dark';
  const editorTheme = isDark ? 'dark' : 'light';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
  };

  const editorContainerStyle: React.CSSProperties = {
    flex: mode === 'split' ? 1 : mode === 'edit' ? 1 : 0,
    display: mode === 'preview' ? 'none' : 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: mode === 'split' ? `1px solid ${isDark ? '#404040' : '#e0e0e0'}` : 'none',
  };

  const previewContainerStyle: React.CSSProperties = {
    flex: mode === 'split' ? 1 : mode === 'preview' ? 1 : 0,
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

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    marginLeft: '8px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    backgroundColor: active ? (isDark ? '#0e639c' : '#007acc') : (isDark ? '#3c3c3c' : '#e0e0e0'),
    color: active ? '#ffffff' : (isDark ? '#cccccc' : '#333333'),
    transition: 'background-color 0.2s',
  });

  return (
    <div
      ref={rootRef}
      className={className}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={toolbarStyle}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FileText size={16} style={{ marginRight: '8px' }} />
            <span>Markdown Editor</span>
          </div>
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
        </div>
      </div>

      {/* Editor pane */}
      <div style={{ ...editorContainerStyle, marginTop: '40px' }}>
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
      />
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';
