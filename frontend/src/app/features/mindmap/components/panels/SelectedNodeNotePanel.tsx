import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MarkdownEditor } from '../../../markdown/components/MarkdownEditor';
import { usePanelControls } from '../../hooks/useStoreSelectors';
import { useMindMapStore } from '../../store';
import { useResizingState } from '@/app/shared/hooks';
import { getLocalStorage, setLocalStorage, STORAGE_KEYS } from '@core/storage/localStorage';
import { viewportService } from '@/app/core/services';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';

type Props = {
  nodeId?: string | null;
  nodeTitle?: string;
  note: string;
  updateNode: (nodeId: string, updates: Partial<import('@shared/types').MindMapNode>) => void;
  onClose?: () => void;
  subscribeNoteChanges?: (cb: (text: string) => void) => () => void;
};

const HEIGHT_KEY = STORAGE_KEYS.NODE_NOTE_PANEL_HEIGHT;

const SelectedNodeNotePanel: React.FC<Props> = ({ nodeId, note, updateNode, onClose, subscribeNoteChanges }) => {
  const [height, setHeight] = useState<number>(viewportService.getDefaultNoteHeight());
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [leftOffset, setLeftOffset] = useState<number>(0);
  const [rightOffset, setRightOffset] = useState<number>(0);
  const { setNodeNotePanelHeight } = usePanelControls();
  const [noteText, setNoteText] = useState<string>(note || '');
  const { value: editorFocused, setTrue: setEditorFocusedTrue, setFalse: setEditorFocusedFalse } = useBooleanState({ initialValue: false });
  const editorFocusedRef = useRef<boolean>(false);
  const pendingNoteTextRef = useRef<string | null>(null);

  // Store nodeId in ref to always use the current value in onChange
  const nodeIdRef = useRef<string | null>(nodeId || null);
  useEffect(() => {
    nodeIdRef.current = nodeId || null;
  }, [nodeId]);

  
  useEffect(() => {
    try {
      const res = getLocalStorage<number>(HEIGHT_KEY);
      const value = typeof res.data === 'number' ? res.data : undefined;
      if (typeof value === 'number') {
        const restored = Math.min(Math.max(120, value), viewportService.getMaxNoteHeight());
        setHeight(restored);
      }
    } catch {}
  }, []);

  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startResizing();
    const startY = e.clientY;
    const startH = height;

    const handleMove = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const dy = startY - ev.clientY;
      const next = Math.min(Math.max(120, startH + dy), viewportService.getMaxAllowedNoteHeight());
      setHeight(next);
    };

    const finishResize = () => {
      setHeight(h => h + 0);
      try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
    };

    const handleUp = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      stopResizing();
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('mouseup', handleUp, true);
      try { setLocalStorage(HEIGHT_KEY, height); } catch {}
      setTimeout(finishResize, 50);
    };

    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('mouseup', handleUp, true);
  }, [height, startResizing, stopResizing]);

  
  useEffect(() => {
    const calcOffsets = () => {
      try {
        const act = document.querySelector<HTMLElement>('.activity-bar');
        const leftA = act?.offsetWidth || 0;
        const side = document.querySelector<HTMLElement>('.primary-sidebar');
        
        const style = side ? window.getComputedStyle(side) : null;
        const isSideVisible = !!side && style?.display !== 'none' && style?.visibility !== 'hidden';
        const leftB = isSideVisible ? (side.offsetWidth || 0) : 0;

        const md = document.querySelector<HTMLElement>('.markdown-panel');
        const rightW = md?.offsetWidth || 0;

        setLeftOffset(leftA + leftB);
        setRightOffset(rightW);
      } catch {}
    };

    
    calcOffsets();
    setNodeNotePanelHeight?.(height);
    try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
    


    const observers: ResizeObserver[] = [];
    const observeEl = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || !('ResizeObserver' in window)) return;
      const ro = new ResizeObserver(() => { calcOffsets(); });
      try { ro.observe(el); } catch {}
      observers.push(ro);
    };
    observeEl('.activity-bar');
    observeEl('.primary-sidebar');
    observeEl('.markdown-panel');

    
    const mo = new MutationObserver(() => calcOffsets());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observers.forEach(o => { try { o.disconnect(); } catch {} });
      try { mo.disconnect(); } catch {}
    };
  }, [height, setNodeNotePanelHeight]);

  
  const onWinResize = useCallback(() => {
    
    try {
      const act = document.querySelector<HTMLElement>('.activity-bar');
      const leftA = act?.offsetWidth || 0;
      const sidebar = document.querySelector<HTMLElement>('.primary-sidebar');
      const leftB = (sidebar?.offsetWidth || 0);
      setLeftOffset(leftA + leftB);
      const mdPanel = document.querySelector<HTMLElement>('.markdown-panel');
      const rightA = mdPanel?.offsetWidth || 0;
      setRightOffset(rightA);
    } catch {}
  }, []);

  useEventListener('resize', onWinResize);

  // Stream subscription: receive note updates from external sources
  useEffect(() => {
    if (!subscribeNoteChanges) return;
    const unsub = subscribeNoteChanges((text: string) => {
      // Use ref to get current focus state to avoid stale closure
      const isCurrentlyFocused = editorFocusedRef.current;

      // While editing, never override the user's input. Queue it instead.
      if (isCurrentlyFocused) {
        pendingNoteTextRef.current = text || '';
        return;
      }

      // Only update if content actually differs
      setNoteText(prevNote => {
        if (text !== prevNote) {
          return text || '';
        }
        return prevNote;
      });
    });
    return () => {
      try {
        unsub();
      } catch (e) {
        console.error('Failed to unsubscribe node note changes', e);
      }
    };
  }, [subscribeNoteChanges]);

  // Sync ref with state for reliable focus tracking
  useEffect(() => {
    editorFocusedRef.current = editorFocused;
  }, [editorFocused]);

  // When editing ends, if there is a queued note text, apply it once
  useEffect(() => {
    if (editorFocused) return;
    if (pendingNoteTextRef.current != null && pendingNoteTextRef.current !== noteText) {
      setNoteText(pendingNoteTextRef.current);
    }
    pendingNoteTextRef.current = null;
  }, [editorFocused, noteText]);

  // Sync initial note prop to state
  useEffect(() => {
    if (!editorFocused) {
      setNoteText(note || '');
    }
  }, [note, editorFocused]);

  // Handle note changes from editor
  // Use nodeIdRef to always get the current nodeId, preventing stale closure bugs
  const handleNoteChange = useCallback((value: string) => {
    setNoteText(value);
    // Use current nodeId from ref to prevent stale closure
    const currentNodeId = nodeIdRef.current;
    if (updateNode && currentNodeId) {
      updateNode(currentNodeId, { note: value });
    }
  }, [updateNode]);


  useEffect(() => {
    setNodeNotePanelHeight?.(height);
    try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
  }, [height, setNodeNotePanelHeight]);



  useEffect(() => () => { setNodeNotePanelHeight?.(0); }, [setNodeNotePanelHeight]);

  
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const id = requestAnimationFrame(() => {
      try { const h = Math.round(el.getBoundingClientRect().height); setNodeNotePanelHeight?.(h); } catch {}
      try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
    });

    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        const entry = entries[0];
        const h = Math.round(entry.contentRect.height);
        setNodeNotePanelHeight?.(h);

        try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
      });
      try { ro.observe(el); } catch {}
    }
    return () => {
      cancelAnimationFrame(id);
      try { ro?.disconnect(); } catch {}
    };
  }, [setNodeNotePanelHeight]);

  const currentMapIdentifier = (() => {
    try {
      const st = useMindMapStore.getState();
      return st?.data?.mapIdentifier || null;
    } catch { return null; }
  })();

  return (
    <div ref={containerRef} className="selected-node-note-panel" style={{ height, left: leftOffset, right: rightOffset }}>
      <div ref={handleRef} className={`drag-handle ${isResizing ? 'resizing' : ''}`} onMouseDown={handleResizeStart} />

      {}
      <div className="panel-editor">
        <MarkdownEditor
          value={noteText}
          onChange={handleNoteChange}
          onClose={onClose}
          className="node-note-editor"
          autoFocus={false}
          readOnly={false}
          onResize={() => {}}
          onCursorLineChange={() => {}}
          onFocusChange={(f) => (f ? setEditorFocusedTrue() : setEditorFocusedFalse())}
          mapIdentifier={currentMapIdentifier}
          title="ノート"
        />
      </div>

      <style>{getStyles(isResizing)}</style>
    </div>
  );
};

function getStyles(isResizing: boolean) {
  return `
    .selected-node-note-panel {
      position: fixed;
      bottom: var(--vim-statusbar-height, 24px);
      background: var(--bg-primary);
      border-top: 1px solid var(--border-color);
      box-shadow: 0 -6px 20px rgba(0,0,0,0.12);
      z-index: 900;
      display: flex;
      flex-direction: column;
      user-select: ${isResizing ? 'none' : 'auto'};
    }

    .selected-node-note-panel .drag-handle {
      position: absolute;
      top: -4px;
      left: 0;
      right: 0;
      height: 8px;
      cursor: row-resize;
      background: transparent;
    }
    .selected-node-note-panel .drag-handle.resizing { background: var(--accent-color); opacity: 0.3; }

    .selected-node-note-panel .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      min-height: 32px;
      flex-shrink: 0;
    }

    .selected-node-note-panel .panel-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-primary);
      font-weight: 500;
      font-size: 12px;
    }

    .selected-node-note-panel .panel-title svg {
      color: var(--text-secondary);
      width: 14px;
      height: 14px;
    }

    .selected-node-note-panel .panel-editor {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .selected-node-note-panel .node-note-editor { width: 100%; height: 100%; }
    .selected-node-note-panel .markdown-editor { width: 100%; height: 100%; }
  `;
}

export default React.memo(SelectedNodeNotePanel);
