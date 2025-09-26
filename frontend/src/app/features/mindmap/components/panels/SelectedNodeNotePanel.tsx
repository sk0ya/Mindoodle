import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import MarkdownEditor from '../../../markdown/components/MarkdownEditor';
import { useMindMapStore } from '../../store';
import { useResizingState } from '@/app/shared/hooks';

type Props = {
  nodeId?: string | null;
  nodeTitle?: string;
  note: string;
  onChange: (value: string) => void;
  onClose?: () => void;
};

const HEIGHT_KEY = 'mindoodle_node_note_panel_height';

const SelectedNodeNotePanel: React.FC<Props> = ({ note, onChange }) => {
  const [height, setHeight] = useState<number>(Math.round(window.innerHeight * 0.3));
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [leftOffset, setLeftOffset] = useState<number>(0);
  const [rightOffset, setRightOffset] = useState<number>(0);
  const { setNodeNotePanelHeight } = useMindMapStore();

  // Restore saved height
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HEIGHT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'number') {
          const restored = Math.min(Math.max(120, parsed), Math.round(window.innerHeight * 0.8));
          setHeight(restored);
        }
      }
    } catch {}
  }, []);

  // Resize handler (drag from top edge)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startResizing();
    const startY = e.clientY;
    const startH = height;

    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY;
      const next = Math.min(Math.max(120, startH + dy), Math.round(window.innerHeight * 0.9));
      setHeight(next);
    };
    const onUp = () => {
      stopResizing();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try { window.localStorage.setItem(HEIGHT_KEY, JSON.stringify(height)); } catch {}
      
      // force editor layout pass after resize settles
      setTimeout(() => {
        setHeight(h => h + 0);
        try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
      }, 50);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height, startResizing, stopResizing]);

  // Compute dynamic offsets to avoid overlapping activity bar, primary sidebar, and markdown panel
  useEffect(() => {
    const calcOffsets = () => {
      try {
        const act = document.querySelector<HTMLElement>('.activity-bar');
        const leftA = act?.offsetWidth || 0;
        const side = document.querySelector<HTMLElement>('.primary-sidebar');
        // Primary sidebar might be hidden; count width only if visible in layout
        const style = side ? window.getComputedStyle(side) : null;
        const isSideVisible = !!side && style?.display !== 'none' && style?.visibility !== 'hidden';
        const leftB = isSideVisible ? (side!.offsetWidth || 0) : 0;

        const md = document.querySelector<HTMLElement>('.markdown-panel');
        const rightW = md?.offsetWidth || 0;

        setLeftOffset(leftA + leftB);
        setRightOffset(rightW);
      } catch {}
    };

    // Initial
    calcOffsets();
    setNodeNotePanelHeight?.(height);
    try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
    

    // Observe size changes for the relevant panels
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

    // Also listen to window resize
    const onWin = () => calcOffsets();
    window.addEventListener('resize', onWin);

    // Fallback: mutation observer to catch DOM add/remove of panels
    const mo = new MutationObserver(() => calcOffsets());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observers.forEach(o => { try { o.disconnect(); } catch {} });
      window.removeEventListener('resize', onWin);
      try { mo.disconnect(); } catch {}
    };
  }, []);

  // When internal height state changes (programmatic), store height then notify listeners
  useEffect(() => {
    setNodeNotePanelHeight?.(height);
    try { window.dispatchEvent(new CustomEvent('node-note-panel-resize')); } catch {}
  }, [height]);

  // Reset height in store on unmount
  useEffect(() => () => { setNodeNotePanelHeight?.(0); }, []);

  // Observe actual container size to keep store height in sync even if CSS/layout adjusts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Set initial from DOM for safety (rAF to ensure styles applied)
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

  return (
    <div ref={containerRef} className="selected-node-note-panel" style={{ height, left: leftOffset, right: rightOffset }}>
      <div ref={handleRef} className={`drag-handle ${isResizing ? 'resizing' : ''}`} onMouseDown={handleResizeStart} />

      {/* Panel Header */}
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
