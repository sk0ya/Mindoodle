import React, { useRef, useState, useEffect } from 'react';
import { useMindMapStore } from '@mindmap/store';
import { parseVimMappingsText } from '@/app/features/vim/utils/parseVimMappings';
import { CodeMirrorEditor, type CodeMirrorEditorRef } from '@shared/codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

type Props = {
  sourceKey: string;
  leaderKey: string;
  mappingsKey: string;
  title?: string;
};

const VimMappingsEditor: React.FC<Props> = ({ sourceKey, leaderKey, mappingsKey }) => {
  const { settings, updateSetting } = useMindMapStore();
  const editorRef = useRef<CodeMirrorEditorRef>(null);
  const applyTimerRef = useRef<number | null>(null);

  const isDirtyRef = useRef<boolean>(false);
  const suppressChangeRef = useRef<boolean>(false);

  const [, setStatus] = useState<{ errors: number; warnings: number }>();

  const source = (settings as any)[sourceKey] as string || '';
  const isDark = (settings as any).theme === 'dark';
  const fontSize = (settings as any).fontSize || 12;
  const fontFamily = (settings as any).fontFamily || 'system-ui';
  const vimEditorEnabled = !!(settings as any).vimEditor;

  // Validation and auto-apply logic
  const validateAndApply = (text: string) => {
    try {
      const result = parseVimMappingsText(text);
      const errors = result.errors.filter(e => e.severity === 'error').length;
      const warnings = result.errors.filter(e => e.severity === 'warning').length;

      setStatus({ errors, warnings });

      // Auto-apply if no errors and editor is dirty
      if (errors === 0 && isDirtyRef.current) {
        if (applyTimerRef.current !== null) {
          window.clearTimeout(applyTimerRef.current);
        }

        applyTimerRef.current = window.setTimeout(() => {
          if (!suppressChangeRef.current) {
            updateSetting(sourceKey as any, text);
            updateSetting(leaderKey as any, result.leader || ',');
            updateSetting(mappingsKey as any, result.parsedMappings);
            isDirtyRef.current = false;
          }
        }, 500);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  // Handle editor changes
  const handleChange = (newValue: string) => {
    isDirtyRef.current = true;
    validateAndApply(newValue);
  };

  // Sync external changes
  useEffect(() => {
    if (editorRef.current && !isDirtyRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== source) {
        suppressChangeRef.current = true;
        editorRef.current.setValue(source);
        suppressChangeRef.current = false;
      }
    }
  }, [source]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (applyTimerRef.current !== null) {
        window.clearTimeout(applyTimerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <CodeMirrorEditor
        ref={editorRef}
        value={source}
        onChange={handleChange}
        theme={isDark ? 'dark' : 'light'}
        vimMode={vimEditorEnabled}
        language="plain"
        fontSize={fontSize}
        fontFamily={fontFamily}
        style={{ height: '100%' }}
      />
    </div>
  );
};

export default VimMappingsEditor;
