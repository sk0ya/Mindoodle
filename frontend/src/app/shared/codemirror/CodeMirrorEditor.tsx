/**
 * React wrapper for CodeMirror 6 editor
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from '@codemirror/view';
import {
  createEditor,
  reconfigureEditor,
  setEditorValue,
  getEditorValue,
  focusEditor,
  getCursorPosition,
  type EditorConfig,
} from './setup';

export interface CodeMirrorEditorProps extends Omit<EditorConfig, 'value'> {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

export interface CodeMirrorEditorRef {
  view: EditorView | null;
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  getCursorPosition: () => { line: number; column: number };
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  (props, ref) => {
    const {
      value,
      onChange,
      readOnly = false,
      theme = 'light',
      vimMode = false,
      language = 'markdown',
      fontSize,
      fontFamily,
      onCursorLineChange,
      onFocusChange,
      className = '',
      style,
      autoFocus = false,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const configRef = useRef<EditorConfig>({
      value,
      onChange,
      readOnly,
      theme,
      vimMode,
      language,
      fontSize,
      fontFamily,
      onCursorLineChange,
      onFocusChange,
    });

    // Expose editor instance and methods via ref
    useImperativeHandle(ref, () => ({
      view: editorViewRef.current,
      getValue: () => (editorViewRef.current ? getEditorValue(editorViewRef.current) : ''),
      setValue: (newValue: string) => {
        if (editorViewRef.current) {
          setEditorValue(editorViewRef.current, newValue);
        }
      },
      focus: () => {
        if (editorViewRef.current) {
          focusEditor(editorViewRef.current);
        }
      },
      getCursorPosition: () => {
        if (editorViewRef.current) {
          return getCursorPosition(editorViewRef.current);
        }
        return { line: 1, column: 1 };
      },
    }));

    // Initialize editor
    useEffect(() => {
      if (!containerRef.current) return;

      const config: EditorConfig = {
        value,
        onChange,
        readOnly,
        theme,
        vimMode,
        language,
        fontSize,
        fontFamily,
        onCursorLineChange,
        onFocusChange,
      };

      configRef.current = config;
      editorViewRef.current = createEditor(containerRef.current, config);

      if (autoFocus) {
        focusEditor(editorViewRef.current);
      }

      return () => {
        if (editorViewRef.current) {
          editorViewRef.current.destroy();
          editorViewRef.current = null;
        }
      };
    }, []); // Only run on mount

    // Update editor when config changes (except value)
    useEffect(() => {
      if (!editorViewRef.current) return;

      const newConfig: Partial<EditorConfig> = {
        onChange,
        readOnly,
        theme,
        vimMode,
        language,
        fontSize,
        fontFamily,
        onCursorLineChange,
        onFocusChange,
      };

      // Check if config changed
      const configChanged =
        configRef.current.readOnly !== readOnly ||
        configRef.current.theme !== theme ||
        configRef.current.vimMode !== vimMode ||
        configRef.current.language !== language ||
        configRef.current.fontSize !== fontSize ||
        configRef.current.fontFamily !== fontFamily;

      if (configChanged) {
        configRef.current = { ...configRef.current, ...newConfig };
        reconfigureEditor(editorViewRef.current, newConfig);
      }
    }, [
      onChange,
      readOnly,
      theme,
      vimMode,
      language,
      fontSize,
      fontFamily,
      onCursorLineChange,
      onFocusChange,
    ]);

    // Update value when prop changes (external update)
    useEffect(() => {
      if (!editorViewRef.current) return;

      const currentValue = getEditorValue(editorViewRef.current);
      if (currentValue !== value) {
        setEditorValue(editorViewRef.current, value);
      }
    }, [value]);

    // Handle container resize (feature-detect ResizeObserver)
    useEffect(() => {
      if (!containerRef.current || !editorViewRef.current) return;

      let timeoutId: NodeJS.Timeout | null = null;

      try {
        const RO: any = (window as any)?.ResizeObserver;
        if (RO) {
          const resizeObserver = new RO(() => {
            if (editorViewRef.current) {
              editorViewRef.current.requestMeasure();
              if (timeoutId) clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                editorViewRef.current && editorViewRef.current.dispatch({});
              }, 50);
            }
          });
          resizeObserver.observe(containerRef.current);
          return () => {
            if (timeoutId) clearTimeout(timeoutId);
            try { resizeObserver.disconnect(); } catch {}
          };
        }
      } catch {}

      // Fallback: listen to window resize
      const onResize = () => {
        try {
          if (!editorViewRef.current) return;
          editorViewRef.current.requestMeasure();
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            editorViewRef.current && editorViewRef.current.dispatch({});
          }, 50);
        } catch {}
      };
      window.addEventListener('resize', onResize, true);
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('resize', onResize, true);
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          ...style,
        }}
      />
    );
  }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
