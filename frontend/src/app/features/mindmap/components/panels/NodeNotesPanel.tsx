import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Loader, FileText } from 'lucide-react';
import MarkdownEditor from '../../../markdown/components/MarkdownEditor';
import type { MapIdentifier } from '@shared/types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@shared/utils';
import { useResizingState } from '@/app/shared/hooks';
import { useMindMapStore } from '../../store';

interface MarkdownPanelProps {
  currentMapIdentifier?: MapIdentifier | null;
  getMapMarkdown?: (id: MapIdentifier) => Promise<string | null>;
  onMapMarkdownInput?: (markdown: string) => void;
  subscribeMarkdownFromNodes?: (cb: (text: string) => void) => () => void;
  // Cursor mapping helpers
  getNodeIdByMarkdownLine?: (line: number) => string | null;
  onSelectNode?: (nodeId: string) => void;
}

const MarkdownPanel: React.FC<MarkdownPanelProps> = ({
  currentMapIdentifier,
  getMapMarkdown,
  onMapMarkdownInput,
  subscribeMarkdownFromNodes,
  getNodeIdByMarkdownLine,
  onSelectNode
}) => {
  const [panelWidth, setPanelWidth] = useState(600); // Default width
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const { setMarkdownPanelWidth } = useMindMapStore();
  const [mapMarkdown, setMapMarkdown] = useState<string>('');
  const [loadingMapMd, setLoadingMapMd] = useState<boolean>(false);
  const [resizeCounter, setResizeCounter] = useState<number>(0);
  const [editorFocused, setEditorFocused] = useState<boolean>(false);
  const editorFocusedRef = useRef<boolean>(false);
  const pendingNodesTextRef = useRef<string | null>(null);

  // Load map markdown when component mounts or map changes
  const lastLoadedMapIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentMapIdentifier || !getMapMarkdown) return;
    if (lastLoadedMapIdRef.current === currentMapIdentifier.mapId) return;

    setLoadingMapMd(true);
    getMapMarkdown(currentMapIdentifier)
      .then(text => {
        setMapMarkdown(text || '');
        lastLoadedMapIdRef.current = currentMapIdentifier.mapId;
      })
      .catch(error => {
        console.error('Failed to load map markdown:', error);
        setMapMarkdown('');
      })
      .finally(() => {
        setLoadingMapMd(false);
      });
  }, [currentMapIdentifier, getMapMarkdown]);

  // Handle map markdown changes
  const handleMapMarkdownChange = useCallback((value: string) => {
    setMapMarkdown(value);
    // Push to live markdown stream if provided
    if (onMapMarkdownInput) {
      onMapMarkdownInput(value);
    }
  }, [onMapMarkdownInput]);

  // Receive-side sync: when nodes change, update editor only if not focused
  useEffect(() => {
    if (!subscribeMarkdownFromNodes) return;
    const unsub = subscribeMarkdownFromNodes((text: string) => {
      // Use ref to get current focus state to avoid stale closure
      const isCurrentlyFocused = editorFocusedRef.current;

      // While editing, never override the user's input. Queue it instead.
      if (isCurrentlyFocused) {
        pendingNodesTextRef.current = text || '';
        return;
      }

      // Only update if content actually differs
      setMapMarkdown(prevMarkdown => {
        if (text !== prevMarkdown) {
          return text || '';
        }
        return prevMarkdown;
      });
    });
    return () => { try { unsub(); } catch (_e) { /* ignore */ } };
  }, [subscribeMarkdownFromNodes]); // Remove mapMarkdown and editorFocused from deps

  // Sync ref with state for reliable focus tracking
  useEffect(() => {
    editorFocusedRef.current = editorFocused;
  }, [editorFocused]);

  // When editing ends, if there is a queued nodes text, apply it once
  useEffect(() => {
    if (editorFocused) return;
    if (pendingNodesTextRef.current != null && pendingNodesTextRef.current !== mapMarkdown) {
      setMapMarkdown(pendingNodesTextRef.current);
    }
    pendingNodesTextRef.current = null;
  }, [editorFocused, mapMarkdown]);

  // Cursor sync only from editor to mindmap selection (one-way)
  const handleCursorLineChange = useCallback((line: number) => {
    if (!getNodeIdByMarkdownLine || !onSelectNode) return;
    const nodeId = getNodeIdByMarkdownLine(line);
    if (nodeId) onSelectNode(nodeId);
  }, [getNodeIdByMarkdownLine, onSelectNode]);

  // Memoized resize trigger function
  const handleResize = useCallback(() => {
    return resizeCounter;
  }, [resizeCounter]);

  // Constants to prevent re-renders
  // Editor height is managed by inner component; keep container flexible
  const EDITOR_CLASS_NAME = "node-editor";

  // Handle resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startResizing();

    const startX = e.clientX;
    const startWidth = panelWidth;
    let currentWidth = startWidth;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = startX - e.clientX; // Reverse direction for left panel
      currentWidth = Math.max(300, Math.min(1200, startWidth + deltaX));
      setPanelWidth(currentWidth);
      // Trigger Monaco Editor layout update
      setResizeCounter(prev => prev + 1);
      // Push width into UI store for overlay computations
      setMarkdownPanelWidth?.(currentWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stopResizing();
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      // Save width to localStorage
      setLocalStorage(STORAGE_KEYS.NOTES_PANEL_WIDTH, currentWidth);
      // Final Monaco Editor layout update
      setTimeout(() => { setResizeCounter(prev => prev + 1); }, 50);
    };

    // Use capture phase to ensure events are caught even if other elements try to stop propagation
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
  }, [panelWidth, startResizing, stopResizing, setMarkdownPanelWidth]);

  // Load saved width on mount
  useEffect(() => {
    const result = getLocalStorage<number>(STORAGE_KEYS.NOTES_PANEL_WIDTH);
    if (result.success && result.data !== undefined) {
      const width = result.data;
      if (width >= 300 && width <= 1200) {
        setPanelWidth(width);
        setMarkdownPanelWidth?.(width);
      }
    }
    
    // On unmount, reset width to 0
    return () => { setMarkdownPanelWidth?.(0); };
  }, []);

  // Do not close this panel with ESC at all (no global handler here)

  // Disable auto-save when editing map markdown; re-enable otherwise
  // Note: autosave is toggled by parent (MindMapApp) based on panel visibility

  return (
    <div
      ref={panelRef}
      className="markdown-panel"
      style={{ width: `${panelWidth}px` }}
    >
      <div
        ref={resizeHandleRef}
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      />

      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title">
          <FileText size={14} />
          <span>Markdown</span>
        </div>
      </div>

      <div className="editor-container">
        {loadingMapMd ? (
          <div className="preview-empty">
            <div className="preview-empty-icon">
              <Loader size={48} className="animate-spin" />
            </div>
            <div className="preview-empty-message">読み込み中...</div>
          </div>
        ) : (
          <MarkdownEditor
            value={mapMarkdown}
            onChange={handleMapMarkdownChange}
            className={EDITOR_CLASS_NAME}
            autoFocus={false}
            readOnly={false}
            onResize={handleResize}
            onCursorLineChange={handleCursorLineChange}
            onFocusChange={setEditorFocused}
          />
        )}
      </div>


      <style>{getStyles(panelWidth, isResizing)}</style>
    </div>
  );
};

function getStyles(_panelWidth: number, isResizing: boolean) {
  return `
    .markdown-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      position: relative;
      user-select: ${isResizing ? 'none' : 'auto'};
      padding-bottom: 24px;
    }

    .resize-handle {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: transparent;
      cursor: col-resize;
      z-index: 10;
    }

    .resize-handle:hover {
      background: var(--accent-color);
    }

    .resize-handle.resizing {
      background: var(--accent-color);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      min-height: 32px;
      flex-shrink: 0;
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-primary);
      font-weight: 500;
      font-size: 12px;
    }

    .panel-title svg {
      color: var(--text-secondary);
      width: 14px;
      height: 14px;
    }

    .editor-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      padding: 0;
    }

    .node-editor {
      flex: 1;
      width: 100%;
      border: none;
      border-radius: 0;
    }

    .node-editor .markdown-editor {
      width: 100%;
      height: 100%;
    }

    .preview-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      text-align: center;
      padding: 40px;
    }

    .preview-empty-icon {
      margin-bottom: 16px;
      opacity: 0.6;
      color: var(--text-secondary);
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .preview-empty-message {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    @media (max-width: 768px) {
      .markdown-panel {
        width: 100vw !important;
      }

      .resize-handle {
        display: none;
      }

      /* Header responsive styles removed */
    }
  `;
}

export default React.memo(MarkdownPanel);
