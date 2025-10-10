import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import { MarkdownEditor } from '../../../markdown/components/MarkdownEditor';
import { useMindMapStore } from '../../store';
import { useResizingState } from '@/app/shared/hooks';
import { getLocalStorage, setLocalStorage, STORAGE_KEYS } from '@shared/utils';
import { viewportService } from '@/app/core/services';
import { useEventListener } from '@shared/hooks/system/useEventListener';

type Props = {
  nodeId?: string | null;
  nodeTitle?: string;
  note: string;
  onChange: (value: string) => void;
  onClose?: () => void;
};

const HEIGHT_KEY = STORAGE_KEYS.NODE_NOTE_PANEL_HEIGHT;

const SelectedNodeNotePanel: React.FC<Props> = ({ note, onChange }) => {
  const [height, setHeight] = useState<number>(viewportService.getDefaultNoteHeight());
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [leftOffset, setLeftOffset] = useState<number>(0);
  const [rightOffset, setRightOffset] = useState<number>(0);
  const { setNodeNotePanelHeight } = useMindMapStore();

  
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

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const dy = startY - ev.clientY;
      const next = Math.min(Math.max(120, startH + dy), viewportService.getMaxAllowedNoteHeight());
      setHeight(next);
    };
    const onUp = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      stopResizing();
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      try { setLocalStorage(HEIGHT_KEY, height); } catch {}

      
      setTimeout(() => {
        setHeight(h => h + 0);
        try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
      }, 50);
    };

    
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
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
    

    
    const observers: any[] = [];
    const observeEl = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || !(window as any).ResizeObserver) return;
      const RO = (window as any).ResizeObserver;
      const ro = new RO(() => { calcOffsets(); });
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
  }, []);

  
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

  
  useEffect(() => {
    setNodeNotePanelHeight?.(height);
    try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
  }, [height]);

  
  useEffect(() => () => { setNodeNotePanelHeight?.(0); }, []);

  
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const id = requestAnimationFrame(() => {
      try { const h = Math.round(el.getBoundingClientRect().height); setNodeNotePanelHeight?.(h); } catch {}
      try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
    });

    let ro: any = null;
    if ((window as any).ResizeObserver) {
      const RO = (window as any).ResizeObserver;
      ro = new RO((entries: any[]) => {
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
  }, []);

  const currentMapIdentifier = (() => {
    try {
      const st = useMindMapStore.getState() as any;
      return st?.data?.mapIdentifier || null;
    } catch { return null; }
  })();

  return (
    <div ref={containerRef} className="selected-node-note-panel" style={{ height, left: leftOffset, right: rightOffset }}>
      <div ref={handleRef} className={`drag-handle ${isResizing ? 'resizing' : ''}`} onMouseDown={handleResizeStart} />

      {}
      <div className="panel-header">
        <div className="panel-title">
          <StickyNote size={14} />
          <span>ノート</span>
        </div>
      </div>

      <div className="panel-editor">
        <MarkdownEditor
          value={note || ''}
          onChange={onChange}
          className="node-note-editor"
          autoFocus={false}
          readOnly={false}
          onResize={() => {}}
          onCursorLineChange={() => {}}
          onFocusChange={() => {}}
          mapIdentifier={currentMapIdentifier}
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
      bottom: 0;
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

    .selected-node-note-panel .panel-editor { flex: 1; min-height: 0; }
    .selected-node-note-panel .node-note-editor { width: 100%; height: 100%; }
    .selected-node-note-panel .markdown-editor { width: 100%; height: 100%; }
  `;
}

export default React.memo(SelectedNodeNotePanel);
