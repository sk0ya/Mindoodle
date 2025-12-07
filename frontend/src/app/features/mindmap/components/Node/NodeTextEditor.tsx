import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMindMapStore } from '../../store';
import { getEditingMode } from '../../hooks/useStoreSelectors';
import { resolveNodeTextWrapConfig, wrapNodeText } from '@mindmap/utils';
import type { MindMapNode } from '@shared/types';

interface NodeTextEditorProps {
  node: MindMapNode;
  nodeLeftX: number;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onEditHeightChange?: (height: number) => void;
}

const NodeTextEditor: React.FC<NodeTextEditorProps> = ({
  node,
  nodeLeftX,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  blurTimeoutRef,
  onDragOver,
  onDrop,
  onEditHeightChange,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { settings, clearMermaidRelatedCaches } = useMindMapStore();

  const clearMermaidCacheOnChange = useCallback((oldText: string, newText: string) => {
    // Invalidate caches if mermaid blocks changed
    const hasMermaid = (text: string) => /```mermaid[\s\S]*?```/i.test(text);
    if (hasMermaid(oldText) !== hasMermaid(newText)) {
      clearMermaidRelatedCaches();
    }
  }, [clearMermaidRelatedCaches]);

  // Focus and caret control when entering edit mode
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        const winX = window.scrollX || window.pageXOffset;
        const winY = window.scrollY || window.pageYOffset;
        const containers = Array.from(document.querySelectorAll<HTMLElement>(
          '.mindmap-canvas-container, .workspace-container, .mindmap-app, .mindmap-sidebar, .markdown-panel'
        ));
        const containerScroll = containers.map((el) => ({ el, x: el.scrollLeft, y: el.scrollTop }));
        const restoreScroll = () => {
          try { window.scrollTo(winX, winY); } catch {}
          try {
            const se = document.scrollingElement as HTMLElement | null;
            if (se) { se.scrollLeft = winX; se.scrollTop = winY; }
          } catch {}
          try { for (const { el, x, y } of containerScroll) { el.scrollLeft = x; el.scrollTop = y; } } catch {}
        };
        try { (inputRef.current as unknown as { focus: (o?: { preventScroll?: boolean }) => void }).focus({ preventScroll: true }); } catch { inputRef.current?.focus(); }

        const editingMode = getEditingMode();
        if (editingMode === 'cursor-at-end') {
          const length = inputRef.current?.value.length ?? 0;
          inputRef.current?.setSelectionRange(length, length);
        } else if (editingMode === 'cursor-at-start') {
          inputRef.current?.setSelectionRange(0, 0);
        } else {
          inputRef.current?.select();
        }

        restoreScroll();
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 0);
      }, 10);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) { clearTimeout(blurTimeoutRef.current); blurTimeoutRef.current = null; }
      clearMermaidCacheOnChange(node.text, editText);
      onFinishEdit(node.id, editText);
    }
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (blurTimeoutRef.current) { clearTimeout(blurTimeoutRef.current); blurTimeoutRef.current = null; }
    const currentValue = e.target ? e.target.value : editText;
    clearMermaidCacheOnChange(node.text, currentValue);
    onFinishEdit(node.id, currentValue);
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  // Measure edit layout to size textarea and notify parent height
  const editHeightData = React.useMemo(() => {
    const noteStr2: string = (node as MindMapNode & { note?: string })?.note || '';
    const noteHasImages2 = !!noteStr2 && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr2) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr2) );
    const noteHasMermaid2 = !!noteStr2 && /```mermaid[\s\S]*?```/i.test(noteStr2);
    const hasImage = noteHasImages2 || noteHasMermaid2;

    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      if (node.customImageWidth && node.customImageHeight) return node.customImageHeight;
      if (noteStr2 && noteHasImages2) {
        const tagMatch = /<img[^>]*>/i.exec(noteStr2);
        if (tagMatch) {
          const hMatch = /\sheight=["']?(\d+)(?:px)?["']?/i.exec(tagMatch[0]);
          if (hMatch) {
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(h) && h > 0) return h;
          }
        }
      }
      return 105;
    };

    const actualImageHeight = getActualImageHeight();
    const editWidth = Math.max(20, nodeWidth - 8);
    const fontSize = settings.fontSize || node.fontSize || 14;
    const wrapConfig = resolveNodeTextWrapConfig(settings, fontSize);
    const wrapEnabled = wrapConfig.enabled !== false;
    const textareaPadding = 20;
    const actualTextWidth = editWidth - textareaPadding;
    const wrapMaxWidth = wrapEnabled ? Math.min(actualTextWidth, wrapConfig.maxWidth) : actualTextWidth;

    const wrapResult = wrapNodeText(editText, {
      fontSize,
      fontFamily: settings.fontFamily || 'system-ui',
      fontWeight: node.fontWeight || 'normal',
      fontStyle: node.fontStyle || 'normal',
      maxWidth: wrapMaxWidth,
      prefixTokens: []
    });

    const lineHeight = wrapResult.lineHeight;
    const totalLines = Math.max(1, wrapResult.lines.length);
    const verticalPadding = 8;
    const borderWidth = 2;
    const textareaHeight = totalLines * lineHeight + verticalPadding + borderWidth;

    return { hasImage, actualImageHeight, editWidth, fontSize, lineHeight, textareaHeight, editX: nodeLeftX + 4 };
  }, [node, nodeWidth, settings, editText, nodeLeftX]);

  useEffect(() => {
    if (onEditHeightChange) {
      onEditHeightChange(editHeightData.textareaHeight);
    }
  }, [editHeightData.textareaHeight, onEditHeightChange]);

  const baseY = editHeightData.hasImage ? node.y + editHeightData.actualImageHeight / 2 : node.y;
  const editY = baseY - editHeightData.textareaHeight / 2;

  return (
    <foreignObject
      x={editHeightData.editX}
      y={editY}
      width={editHeightData.editWidth}
      height={editHeightData.textareaHeight}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <textarea
        ref={inputRef}
        className="node-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        onMouseDown={(e) => { e.stopPropagation(); }}
        onMouseUp={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); }}
        onDoubleClick={(e) => { e.stopPropagation(); }}
        onPointerDown={(e) => { e.stopPropagation(); }}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ccc',
          background: settings.theme === 'dark' ? 'var(--bg-primary)' : 'white',
          textAlign: 'left',
          fontSize: `${editHeightData.fontSize}px`,
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          fontFamily: settings.fontFamily || 'system-ui',
          color: settings.theme === 'dark' ? 'var(--text-primary)' : 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          boxSizing: 'border-box',
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          lineHeight: `${editHeightData.lineHeight}px`
        }}
      />
    </foreignObject>
  );
};

export default memo(NodeTextEditor);
