import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { marked } from 'marked';
import { FileText } from 'lucide-react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import { mermaidSVGCache } from '../../mindmap/utils/mermaidCache';
import { loadMonacoVim, getVimFromModule, initVimMode as adapterInitVimMode, loadDirectVimApi } from '../vim/adapter';
import { logger, generateId, getLocalStorage, STORAGE_KEYS } from '@shared/utils';
import mermaid from 'mermaid';


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
  
  onCursorLineChange?: (line: number) => void;
  onFocusChange?: (focused: boolean) => void;
  
  mapIdentifier?: { mapId: string; workspaceId?: string | null } | null;
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
  onCursorLineChange, onFocusChange,
  mapIdentifier
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const lastUpdatedAtRef = useRef<string>('');
  const hoveredRef = useRef(false);
  // Tracks whether Vim is currently enabled on the Monaco instance
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const hasVimMapApiRef = useRef<boolean>(false);
  const fallbackKeydownDisposableRef = useRef<any>(null);
  const vimApiRef = useRef<any>(null);
  // Track applied custom mappings to allow unmapping/reapply on changes
  const appliedEditorMappingsRef = useRef<string[]>([]);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit');
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings, clearMermaidRelatedCaches } = useMindMapStore();
  const cloudApiEndpoint = settings.cloudApiEndpoint || 'https://mindoodle-backend-production.shigekazukoya.workers.dev';

  
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/gi;
    const blocks: string[] = [];
    let match;
    while ((match = mermaidRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }, []);

  
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

  
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {
      
    }
  }, []);

  
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

  // After HTML is rendered, resolve relative image sources for cloud workspaces
  useEffect(() => {
    const fn = async () => {
      try {
        if (!previewPaneRef.current) return;
        if (!mapIdentifier || mapIdentifier.workspaceId !== 'cloud') return;

        const container = previewPaneRef.current.querySelector('.markdown-preview');
        if (!container) return;

        const imgs = Array.from(container.querySelectorAll('img'));
        if (imgs.length === 0) return;

        const token = (() => {
          try {
            const res = getLocalStorage<string>(STORAGE_KEYS.AUTH_TOKEN);
            return res.success ? (res.data ?? null) : null;
          } catch { return null; }
        })();

        
        const parts = (mapIdentifier.mapId || '').split('/').filter(Boolean);
        const mapDir = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';

        for (const img of imgs) {
          try {
            if (!img || img.getAttribute('data-inline-loaded') === '1') continue;
            const src = img.getAttribute('src') || '';
            const lower = src.toLowerCase();
            if (!src || lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:')) {
              img.setAttribute('data-inline-loaded', '1');
              continue;
            }
            
            const rel = src.replace(/^\.\/*/, '');
            const cloudPath = `${mapDir}${rel}`.replace(/\/+/, '/');

            const url = `${cloudApiEndpoint}/api/images/${encodeURIComponent(cloudPath)}`;
            const res = await fetch(url, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!res.ok) {
              img.setAttribute('data-inline-loaded', '1');
              continue;
            }
            const json = await res.json().catch(() => null);
            const base64 = json?.data as string | undefined;
            const ct = json?.contentType as string | undefined;
            if (base64 && ct) {
              img.src = `data:${ct};base64,${base64}`;
              img.setAttribute('data-inline-loaded', '1');
            } else {
              img.setAttribute('data-inline-loaded', '1');
            }
          } catch {}
        }
      } catch {}
    };
    
    setTimeout(fn, 0);
  }, [processedHtml, mapIdentifier, cloudApiEndpoint]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco as unknown as typeof import('monaco-editor');
    
    const isTextFocusedRef = { current: false } as { current: boolean };

    
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

    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      setMode(prev => {
        const next = prev === 'edit' ? 'preview' : prev === 'preview' ? 'split' : 'edit';
        if (next === 'preview') setTimeout(() => { try { previewPaneRef.current?.focus(); } catch {} }, 0);
        return next;
      });
    });

    

    
    editor.onDidChangeCursorPosition((e) => {
      
      const hasFocus = editor.hasTextFocus?.() ?? false;
      if (!hasFocus) return;
      const line = e.position.lineNumber;
      onCursorLineChange?.(line);
    });
    
    editor.onDidFocusEditorText?.(async () => {
      onFocusChange?.(true);
      isTextFocusedRef.current = true;
      
      if ((settings as any).vimEditor && !isVimEnabled) {
        const ok = await enableVimMode(editor, monaco);
        if (ok) setIsVimEnabled(true);
      }
    });

    
    editor.onDidBlurEditorText?.(() => {
      onFocusChange?.(false);
      isTextFocusedRef.current = false;
      
      if (isVimEnabled) {
        disableVimMode();
      }
    });

    
    if (autoFocus) {
      editor.focus();
    }
  };

  const enableVimMode = async (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')): Promise<boolean> => {
    try {
      
      const mod = await loadMonacoVim();
      
      const vimMode = adapterInitVimMode(mod, editor, null);
      
      
      try {
        if (vimMode && typeof (vimMode).defineEx === 'function') {
          (vimMode).defineEx('write', 'w', () => { onSave?.(); });
        }
      } catch {}

      
      
      const preservedCommands = [
        
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
          handler: () => onSave?.(),
        },
        
        {
          keybinding: monaco.KeyCode.Delete,
          handler: () => {
            
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              
              return false; 
            }
            
            return false;
          },
        },
        
        {
          keybinding: monaco.KeyCode.Backspace,
          handler: () => {
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              return false; 
            }
            return false;
          },
        },
        
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
        
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC,
          handler: () => {
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
            }
            return false; 
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX,
          handler: () => {
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
            }
            return false; 
          },
        },
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
          handler: () => {
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
            }
            return false; 
          },
        },
        
        {
          keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA,
          handler: () => {
            const vimState = (vimMode).state;
            if (!vimState || vimState.mode === 'insert' || vimState.mode === 'replace') {
              editor.trigger('keyboard', 'editor.action.selectAll', null);
            }
            return false; 
          },
        }
      ];

      
      const commandIds: string[] = [];
      preservedCommands.forEach((cmd, index) => {
        const commandId = `vimModePreserved_${index}`;
        const disposable = editor.addCommand(cmd.keybinding, cmd.handler);
        if (disposable) {
          commandIds.push(commandId);
        }
      });

      
      (editor as any)._vimMode = vimMode;
      (editor as any)._vimModeCommandIds = commandIds;

      
      const resolveVimApi = async (): Promise<any | null> => {
        let Vim: any = getVimFromModule(mod);
        if (Vim) return Vim;
        
        Vim = await loadDirectVimApi();
        return Vim;
      };

      
      const installEditorActions = (Vim: any) => {
        try {
          if ((editor as any)._vimActionsInstalled) return;
          const define = (name: string, handler: () => void) => {
            try { Vim.defineAction?.(name, handler); } catch {}
          };
          define('md_save', () => { try { onSave?.(); } catch {} });
          define('md_copy', () => { try { editor.trigger('vim', 'editor.action.clipboardCopyAction', null); } catch {} });
          define('md_cut', () => { try { editor.trigger('vim', 'editor.action.clipboardCutAction', null); } catch {} });
          define('md_paste', () => { try { editor.trigger('vim', 'editor.action.clipboardPasteAction', null); } catch {} });
          define('md_selectAll', () => { try { editor.trigger('vim', 'editor.action.selectAll', null); } catch {} });
          define('md_undo', () => { try { editor.trigger('vim', 'undo', null); } catch {} });
          define('md_redo', () => { try { editor.trigger('vim', 'redo', null); } catch {} });
          (editor as any)._vimActionsInstalled = true;
        } catch {}
      };

      
      const applyOneMapping = (Vim: any, lhs: string, rhs: string) => {
        const toVimRhs = (s: string): string => {
          
          const kw = s.trim().toLowerCase();
          switch (kw) {
            case 'save': return ':w<CR>';
            case 'undo': return 'u';
            case 'redo': return '<C-r>';
            case 'esc': return '<Esc>';
            default: return s;
          }
        };

        
        const actionMap: Record<string, string> = {
          'save': 'md_save',
          'copy': 'md_copy',
          'cut': 'md_cut',
          'paste': 'md_paste',
          'selectall': 'md_selectAll',
          'undo': 'md_undo',
          'redo': 'md_redo',
        };

        const kw = rhs.trim().toLowerCase().replace(/[-_\s]/g, '');
        if (actionMap[kw] && typeof Vim.mapCommand === 'function') {
          try { Vim.mapCommand(lhs, 'action', actionMap[kw], { context: 'normal' }); return; } catch {}
        }

        
        try {
          if (typeof Vim.mapKeyToKey === 'function') {
            Vim.mapKeyToKey(lhs, rhs, 'normal');
            try { Vim.mapKeyToKey(lhs, rhs, 'visual'); } catch {}
            return;
          }
        } catch {}

        
        try {
          const r = toVimRhs(rhs);
          if (typeof Vim.map === 'function') {
            Vim.map(lhs, r, 'normal');
            try { Vim.map(lhs, r, 'visual'); } catch {}
          } else if (typeof Vim.mapCommand === 'function') {
            
            const action = `md_feed_${lhs.replace(/[^a-zA-Z0-9]/g, '')}`;
            try {
              Vim.defineAction?.(action, () => {
                try {
                  if (typeof (Vim).handleKey === 'function') {
                    (Vim).handleKey(editor, r);
                  } else {
                    
                    const rr = r.trim();
                    if (rr === 'j') editor.trigger('vim', 'cursorDown', null);
                    else if (rr === 'k') editor.trigger('vim', 'cursorUp', null);
                    else if (rr === 'h') editor.trigger('vim', 'cursorLeft', null);
                    else if (rr === 'l') editor.trigger('vim', 'cursorRight', null);
                  }
                } catch {}
              });
              Vim.mapCommand(lhs, 'action', action, { context: 'normal' });
            } catch {}
          }
        } catch {}
      };

      
      try {
        const VimAny: any = await resolveVimApi();
        if (VimAny) {
          
          const Vim = typeof VimAny === 'function' ? VimAny() : VimAny;
          vimApiRef.current = Vim;
          installEditorActions(Vim);
          
          const leader = (settings as any).vimEditorLeader || ',';
          Vim.mapleader = leader === ' ' ? ' ' : String(leader).slice(0, 1);
          
          try {
            for (const lhs of appliedEditorMappingsRef.current) {
              try { Vim.unmap?.(lhs, 'normal'); } catch {}
              try { Vim.unmap?.(lhs, 'visual'); } catch {}
              try { Vim.unmap?.(lhs, 'insert'); } catch {}
            }
          } catch {}
          appliedEditorMappingsRef.current = [];
          
          const mappings: Record<string, string> = (settings as any).vimEditorCustomKeybindings || {};
          const expand = (s: string): string => String(s)
            .replace(/<\s*leader\s*>/ig, Vim.mapleader || ',')
            .replace(/<\s*space\s*>/ig, ' ');
          const entries = Object.entries(mappings);
          for (const [lhsRaw, rhsRaw] of entries) {
            const lhs = expand(lhsRaw);
            const rhs = expand(rhsRaw);
            try { applyOneMapping(Vim, lhs, rhs); appliedEditorMappingsRef.current.push(lhs); } catch {}
          }
          hasVimMapApiRef.current = typeof Vim?.map === 'function' || typeof (Vim)?.mapCommand === 'function';
        } else {
          
          try { console.warn('[MarkdownEditor] Vim API not found; editor custom mappings will not apply'); } catch {}
          hasVimMapApiRef.current = false;
        }
      } catch {}
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

    
    try {
      const Vim: any = (window as any).Vim;
      if (Vim && Array.isArray(appliedEditorMappingsRef.current)) {
        for (const lhs of appliedEditorMappingsRef.current) {
          try { Vim.unmap?.(lhs, 'normal'); } catch {}
          try { Vim.unmap?.(lhs, 'visual'); } catch {}
          try { Vim.unmap?.(lhs, 'insert'); } catch {}
        }
      }
    } catch {}
    appliedEditorMappingsRef.current = [];

    setIsVimEnabled(false);
  }, []);

  

  
  useEffect(() => {
    const applyMappings = async () => {
      if (!isVimEnabled || !editorRef.current) return;
      try {
        const mod = await loadMonacoVim();
        let VimAny: any = getVimFromModule(mod);
        if (!VimAny) VimAny = await loadDirectVimApi();
        if (!VimAny) return;
        const Vim = typeof VimAny === 'function' ? VimAny() : VimAny;
        vimApiRef.current = Vim;
        
        try {
          if (!(editorRef.current as any)._vimActionsInstalled) {
            try { Vim.defineAction?.('md_save', () => { try { onSave?.(); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_copy', () => { try { editorRef.current?.trigger('vim', 'editor.action.clipboardCopyAction', null); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_cut', () => { try { editorRef.current?.trigger('vim', 'editor.action.clipboardCutAction', null); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_paste', () => { try { editorRef.current?.trigger('vim', 'editor.action.clipboardPasteAction', null); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_selectAll', () => { try { editorRef.current?.trigger('vim', 'editor.action.selectAll', null); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_undo', () => { try { editorRef.current?.trigger('vim', 'undo', null); } catch {} }); } catch {}
            try { Vim.defineAction?.('md_redo', () => { try { editorRef.current?.trigger('vim', 'redo', null); } catch {} }); } catch {}
            (editorRef.current as any)._vimActionsInstalled = true;
          }
        } catch {}
        
        const leader = (settings as any).vimEditorLeader || ',';
        Vim.mapleader = leader === ' ' ? ' ' : String(leader).slice(0, 1);
        
        try {
          for (const lhs of appliedEditorMappingsRef.current) {
            try { Vim.unmap?.(lhs, 'normal'); } catch {}
            try { Vim.unmap?.(lhs, 'visual'); } catch {}
            try { Vim.unmap?.(lhs, 'insert'); } catch {}
          }
        } catch {}
        appliedEditorMappingsRef.current = [];
        
        const mappings: Record<string, string> = (settings as any).vimEditorCustomKeybindings || {};
        const expand = (s: string): string => String(s)
          .replace(/<\s*leader\s*>/ig, Vim.mapleader || ',')
          .replace(/<\s*space\s*>/ig, ' ');
        for (const [lhsRaw, rhsRaw] of Object.entries(mappings)) {
          const lhs = expand(lhsRaw);
          const rhs = expand(rhsRaw);
          try {
            
            const toKw = (s: string) => s.trim().toLowerCase().replace(/[-_\s]/g, '');
            const am: Record<string,string> = { save:'md_save', copy:'md_copy', cut:'md_cut', paste:'md_paste', selectall:'md_selectAll', undo:'md_undo', redo:'md_redo' };
            const kw = toKw(rhs);
            if (am[kw] && typeof Vim.mapCommand === 'function') {
              Vim.mapCommand(lhs, 'action', am[kw], { context: 'normal' });
              appliedEditorMappingsRef.current.push(lhs);
            } else if (typeof Vim.map === 'function') {
              const normalize = (s: string) => {
                const k = toKw(s);
                if (k === 'save') return ':w<CR>';
                if (k === 'undo') return 'u';
                if (k === 'redo') return '<C-r>';
                if (k === 'esc') return '<Esc>';
                return s;
              };
              const r = normalize(rhs);
              Vim.map(lhs, r, 'normal');
              try { Vim.map(lhs, r, 'insert'); } catch {}
              try { Vim.map(lhs, r, 'visual'); } catch {}
              appliedEditorMappingsRef.current.push(lhs);
            }
          } catch {}
        }
        hasVimMapApiRef.current = typeof Vim?.map === 'function' || typeof (Vim)?.mapCommand === 'function';
      } catch {}
    };
    applyMappings();
  }, [isVimEnabled, (settings as any).vimEditorLeader, (settings as any).vimEditorCustomKeybindings]);

  
  useEffect(() => {
    const ed: any = editorRef.current as any;
    if (!ed) return;
    
    try { fallbackKeydownDisposableRef.current?.dispose?.(); } catch {}
    fallbackKeydownDisposableRef.current = null;
    if (!isVimEnabled) return;
    if (hasVimMapApiRef.current) return; 

    const expand = (s: string, leader: string) => String(s)
      .replace(/<\s*leader\s*>/ig, leader)
      .replace(/<\s*space\s*>/ig, ' ');

    const disposable = ed.onKeyDown((e: any) => {
      try {
        
        const vm = (ed)?._vimMode;
        const mode = vm?.state?.mode || null;
        if (mode && mode !== 'normal' && mode !== 'visual') return;
        const ev: KeyboardEvent = e.browserEvent as KeyboardEvent;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const key = ev.key;
        if (!key || key.length !== 1) return;
        const leader = ((settings as any).vimEditorLeader || ',');
        const maps: Record<string,string> = (settings as any).vimEditorCustomKeybindings || {};
        for (const [lhsRaw, rhsRaw] of Object.entries(maps)) {
          const lhs = expand(lhsRaw, leader);
          const rhs = expand(rhsRaw, leader);
          if (lhs.length === 1 && rhs.length === 1 && lhs === key) {
            e.preventDefault();
            e.stopPropagation();
            if (rhs === 'j') { ed.trigger('vim-map', 'cursorDown', null); return; }
            if (rhs === 'k') { ed.trigger('vim-map', 'cursorUp', null); return; }
            if (rhs === 'h') { ed.trigger('vim-map', 'cursorLeft', null); return; }
            if (rhs === 'l') { ed.trigger('vim-map', 'cursorRight', null); return; }
            if (rhs === 'x') { ed.trigger('vim-map', 'deleteRight', null); return; }
            if (rhs === 'u') { ed.trigger('vim-map', 'undo', null); return; }
            return;
          }
        }
      } catch {}
    });
    fallbackKeydownDisposableRef.current = disposable;
    return () => { try { disposable?.dispose?.(); } catch {} };
  }, [isVimEnabled, (settings as any).vimEditorLeader, (settings as any).vimEditorCustomKeybindings]);

  
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

      
      editorRef.current.updateOptions({
        fontSize: settings.fontSize || 14,
        fontFamily: settings.fontFamily || 'system-ui'
      });
    }
  }, [settings.theme, settings.fontSize, settings.fontFamily]);

  
  useEffect(() => {
    const apply = async () => {
      if (!editorRef.current) return;
      
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

  
  useEffect(() => {
    if (onResize && editorRef.current) {
      
      const timeoutId = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [onResize]);

  
  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      const isCtrlL = (e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L');
      if (!isCtrlL) return;
      
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

  
  useEffect(() => {
    const resizeHandler = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    
    if (onResize) {
      (window as any).__markdownEditor_forceLayout = resizeHandler;
    }

    
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
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
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
