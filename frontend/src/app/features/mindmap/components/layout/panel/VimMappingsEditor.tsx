// moved to layout/panel
import React, { useEffect, useRef, useState } from 'react';
import { useMindMapStore } from '@mindmap/store';
import { parseVimMappingsText } from '@/app/features/vim/utils/parseVimMappings';

type Props = {
  sourceKey: string;
  leaderKey: string;
  mappingsKey: string;
  title?: string;
};

const VimMappingsEditor: React.FC<Props> = ({ sourceKey, leaderKey, mappingsKey }) => {
  const { settings, updateSetting } = useMindMapStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const applyTimerRef = useRef<number | null>(null);
  // Track whether user actually edited text (to avoid overwriting settings on tab switch)
  const isDirtyRef = useRef<boolean>(false);
  // Suppress onDidChangeModelContent for programmatic updates (setValue)
  const suppressChangeRef = useRef<boolean>(false);
  const applyRef = useRef<() => void>(() => {});
  // keep for future diagnostics (errors/warnings)
  const [, setStatus] = useState<{ errors: number; warnings: number }>();

  const source = (settings as any)[sourceKey] as string || '';
  const isDark = (settings as any).theme === 'dark';
  const fontSize = (settings as any).fontSize || 12;
  const fontFamily = (settings as any).fontFamily || 'system-ui';
  const vimEditorEnabled = !!(settings as any).vimEditor;
  const vimEnabledRef = useRef<boolean>(false);

  // Initialize Monaco editor lazily
  useEffect(() => {
    let disposed = false;
    (async () => {
      const monaco = await import('monaco-editor');

      if (disposed || !containerRef.current) return;

      // Register lightweight language for mappings
      const LANG_ID = 'vimmap';
      monaco.languages.register({ id: LANG_ID });
      monaco.languages.setMonarchTokensProvider(LANG_ID, {
        tokenizer: {
          root: [
            [/^\s*".*/, 'comment'],
            [/\b(set)\b/, 'keyword'],
            [/\b(map|nmap|noremap|nnoremap|unmap|nunmap|unmap!)\b/, 'keyword'],
            [/\b(leader)\b/, 'type'],
          ],
        },
      } as any);

      monaco.languages.registerCompletionItemProvider(LANG_ID, {
        provideCompletionItems: async (model, position) => {
          const textUntil = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
          const tokens = textUntil.trim().split(/\s+/);
          const suggestions: any[] = [];

          if (tokens.length <= 1) {
            ['set', 'map', 'nmap', 'noremap', 'nnoremap', 'unmap', 'nunmap', 'unmap!'].forEach(k => suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k }));
          } else if (tokens[0] === 'set' && tokens[1] && 'leader'.startsWith(tokens[1])) {
            suggestions.push({ label: 'leader ,', kind: monaco.languages.CompletionItemKind.Property, insertText: 'leader ,' });
            suggestions.push({ label: 'leader <Space>', kind: monaco.languages.CompletionItemKind.Property, insertText: 'leader <Space>' });
          } else if (['map','nmap','noremap','nnoremap'].includes(tokens[0])) {
            if (tokens.length >= 3) {
              // suggest commands for RHS
              try {
                const { commands } = await import('@/app/commands');
                const names = Array.from(new Set((commands as any[]).map((c: any) => c?.name).filter(Boolean)));
                names.sort();
                names.forEach((n: string) => suggestions.push({ label: n, kind: monaco.languages.CompletionItemKind.Function, insertText: n }));
              } catch {}
              // Common vim sequences
              ['zz','gg','dd','yy','za','zo','zc','zR','zM','gt','gT','ciw','h','j','k','l','p','x','u','M','G','0','/','n','N'].forEach(seq => suggestions.push({ label: seq, kind: monaco.languages.CompletionItemKind.Text, insertText: seq }));
            }
          }
          return { suggestions };
        }
      });

      const editor = monaco.editor.create(containerRef.current!, {
        value: source,
        language: LANG_ID,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize,
        fontFamily,
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        glyphMargin: false,
        guides: { indentation: false } as any,
      });
      editorRef.current = editor;

      // Theme
      monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');

      // Enable/disable Vim mode based on focus + setting
      const enableVim = async () => {
        if (vimEnabledRef.current || !vimEditorEnabled) return;
        try {
          const mod: any = await import('monaco-vim');
          const init: any = mod?.initVimMode || mod?.default || mod;
          if (typeof init !== 'function') return;
          const vm = init(editor);
          (editor as any)._vimMode = vm;
          vimEnabledRef.current = true;
        } catch {}
      };
      const disableVim = () => {
        const vm = (editor as any)._vimMode;
        if (vm && typeof vm.dispose === 'function') {
          try { vm.dispose(); } catch {}
        }
        delete (editor as any)._vimMode;
        vimEnabledRef.current = false;
      };

      const focusDisp = editor.onDidFocusEditorText?.(async () => { if (vimEditorEnabled) await enableVim(); });
      const blurDisp = editor.onDidBlurEditorText?.(() => { if (vimEnabledRef.current) disableVim(); });

      const apply = () => {
        try {
          const text = editor.getValue();
          updateSetting(sourceKey as any, text as any);
          const parsed = parseVimMappingsText(text);
          setStatus({ errors: parsed.errors.length, warnings: parsed.warnings.length });
          // Apply leader + compiled mappings
          updateSetting(leaderKey as any, parsed.leader as any);
          updateSetting(mappingsKey as any, parsed.mappings as any);
          // Applied successfully; clear dirty flag
          isDirtyRef.current = false;
        } catch {
          // ignore
        }
      };
      applyRef.current = apply;

      const sub = editor.onDidChangeModelContent(() => {
        // debounce local timer; also flush on blur/unmount
        if (suppressChangeRef.current) return;
        isDirtyRef.current = true;
        if (applyTimerRef.current) window.clearTimeout(applyTimerRef.current);
        applyTimerRef.current = window.setTimeout(apply, 250);
      });

      // Flush edits on blur to avoid losing changes on tab switch
      const blurFlush = editor.onDidBlurEditorText?.(() => {
        if (applyTimerRef.current) {
          window.clearTimeout(applyTimerRef.current);
          applyTimerRef.current = null;
        }
        // Only apply if user actually edited
        if (isDirtyRef.current) {
          apply();
        }
      });

      // initial parse/apply
      setTimeout(() => {
        try {
          const parsed = parseVimMappingsText(source);
          setStatus({ errors: parsed.errors.length, warnings: parsed.warnings.length });
        } catch {}
      }, 0);

      // Global flush listener (used by tab switch)
      const onFlush = () => {
        try {
          // Only flush to settings if there are pending edits
          if (isDirtyRef.current) applyRef.current?.();
        } catch {}
      };
      window.addEventListener('mindoodle:vim-mapping-flush', onFlush as EventListener);

      return () => {
        disposed = true;
        // On unmount, flush pending changes, then dispose
        try {
          if (applyTimerRef.current) {
            window.clearTimeout(applyTimerRef.current);
            applyTimerRef.current = null;
          }
          // Apply on unmount only if dirty; avoid overwriting with stale text
          if (isDirtyRef.current) apply();
        } catch {}
        try { window.removeEventListener('mindoodle:vim-mapping-flush', onFlush as EventListener); } catch {}
        try { sub.dispose(); } catch {}
        try { blurFlush?.dispose?.(); } catch {}
        try { focusDisp?.dispose?.(); } catch {}
        try { blurDisp?.dispose?.(); } catch {}
        try {
          const vm = (editor as any)?._vimMode; if (vm) vm.dispose?.();
        } catch {}
        try { editor.dispose(); } catch {}
      };
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep external updates (rare) in sync, avoid overriding active edits
  useEffect(() => {
    try {
      const ed = editorRef.current;
      if (ed) {
        const current = ed.getValue();
        const hasFocus = ed.hasTextFocus?.() ?? false;
        // If user is actively editing (focus + pending timer), do not override
        if (current !== source && !(hasFocus && applyTimerRef.current != null)) {
          try {
            suppressChangeRef.current = true;
            ed.setValue(source);
          } finally {
            // Let monaco emit change then re-enable
            setTimeout(() => { suppressChangeRef.current = false; }, 0);
          }
        }
      }
    } catch {}
  }, [source]);

  // React to theme/font/vim setting changes
  useEffect(() => {
    (async () => {
      try {
        const monaco = await import('monaco-editor');
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        const ed = editorRef.current;
        if (ed) {
          ed.updateOptions({ fontSize, fontFamily });
          if (!vimEditorEnabled && vimEnabledRef.current) {
            const vm = (ed as any)._vimMode; if (vm) { try { vm.dispose(); } catch {} }
            delete (ed as any)._vimMode;
            vimEnabledRef.current = false;
          }
        }
      } catch {}
    })();
  }, [isDark, fontSize, fontFamily, vimEditorEnabled]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4 }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
};

export default VimMappingsEditor;
