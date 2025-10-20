import React, { useRef, useState, useEffect } from 'react';
import { useSettings, useUpdateSetting } from '@mindmap/hooks/useStoreSelectors';
import { parseVimMappingsText } from '@/app/features/vim/utils/parseVimMappings';
import { CodeMirrorEditor, type CodeMirrorEditorRef } from '@shared/codemirror';
import type { AppSettings } from '@mindmap/store/slices/settingsSlice';

type Props = {
  sourceKey: keyof AppSettings;
  leaderKey: keyof AppSettings;
  mappingsKey: keyof AppSettings;
  title?: string;
};

const VimMappingsEditor: React.FC<Props> = ({ sourceKey, leaderKey, mappingsKey }) => {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();
  const editorRef = useRef<CodeMirrorEditorRef>(null);
  const applyTimerRef = useRef<number | null>(null);

  const isDirtyRef = useRef<boolean>(false);
  const suppressChangeRef = useRef<boolean>(false);

  const [, setStatus] = useState<{ errors: number; warnings: number }>();

  const source = String(settings[sourceKey] || '');
  const isDark = settings.theme === 'dark';
  const fontSize = settings.fontSize || 12;
  const fontFamily = settings.fontFamily || 'system-ui';
  const vimEditorEnabled = !!settings.vimEditor;

  // Validation and auto-apply logic
  const validateAndApply = (text: string) => {
    try {
      const result = parseVimMappingsText(text);
      const errors = result.errors.length;
      const warnings = result.warnings.length;

      setStatus({ errors, warnings });

      // Auto-apply if no errors and editor is dirty
      if (errors === 0 && isDirtyRef.current) {
        if (applyTimerRef.current !== null) {
          window.clearTimeout(applyTimerRef.current);
        }

        applyTimerRef.current = window.setTimeout(() => {
          if (!suppressChangeRef.current) {
            updateSetting(sourceKey, text as AppSettings[typeof sourceKey]);
            updateSetting(leaderKey, (result.leader || ',') as AppSettings[typeof leaderKey]);
            updateSetting(mappingsKey, result.mappings as AppSettings[typeof mappingsKey]);
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
        language="vim"
        fontSize={fontSize}
        fontFamily={fontFamily}
        style={{ height: '100%' }}
      />
    </div>
  );
};

export default VimMappingsEditor;
