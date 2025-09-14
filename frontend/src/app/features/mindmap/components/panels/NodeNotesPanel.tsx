import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import MarkdownEditor from '../../../../shared/components/MarkdownEditor';
import type { MindMapNode } from '@shared/types';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '../../../../shared/utils/localStorage';
// Using Monaco-based MarkdownEditor for both note and map markdown views

interface NodeNotesPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onClose?: () => void;
  currentMapId?: string | null;
  getMapMarkdown?: (mapId: string) => Promise<string | null>;
  saveMapMarkdown?: (mapId: string, markdown: string) => Promise<void>;
  setAutoSaveEnabled?: (enabled: boolean) => void;
}

const NodeNotesPanel: React.FC<NodeNotesPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onClose,
  currentMapId,
  getMapMarkdown,
  saveMapMarkdown,
  setAutoSaveEnabled
}) => {
  const [noteValue, setNoteValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const saveDataRef = useRef({ selectedNode, noteValue, isDirty, onUpdateNode });
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'note' | 'map-md'>('note');
  const [mapMarkdown, setMapMarkdown] = useState<string>('');
  const [loadingMapMd, setLoadingMapMd] = useState<boolean>(false);
  const [mapMarkdownDirty, setMapMarkdownDirty] = useState<boolean>(false);
  const [resizeCounter, setResizeCounter] = useState<number>(0);

  // Update ref when values change
  useEffect(() => {
    saveDataRef.current = { selectedNode, noteValue, isDirty, onUpdateNode };
  });

  // Load note when selected node changes
  useEffect(() => {
    if (selectedNode) {
      const note = selectedNode.note || '';
      setNoteValue(note);
      setIsDirty(false);
    } else {
      setNoteValue('');
      setIsDirty(false);
    }
  }, [selectedNode]);

  // Load map markdown when switching to map tab or when map changes
  useEffect(() => {
    if (tab === 'map-md' && currentMapId && getMapMarkdown) {
      setLoadingMapMd(true);
      getMapMarkdown(currentMapId)
        .then(text => {
          setMapMarkdown(text || '');
          setMapMarkdownDirty(false);
        })
        .catch(error => {
          console.error('Failed to load map markdown:', error);
          setMapMarkdown('');
        })
        .finally(() => {
          setLoadingMapMd(false);
        });
    } else if (tab === 'map-md') {
      setMapMarkdown('');
    }
  }, [tab, currentMapId, getMapMarkdown]);

  // Handle note changes
  const handleNoteChange = useCallback((value: string) => {
    setNoteValue(value);
    setIsDirty(true);
  }, []);

  // Handle map markdown changes
  const handleMapMarkdownChange = useCallback((value: string) => {
    setMapMarkdown(value);
    setMapMarkdownDirty(true);
  }, []);

  // Stable function for loading map markdown
  const loadMapMarkdown = useCallback(async () => {
    if (!currentMapId || !getMapMarkdown) {
      setMapMarkdown('');
      return;
    }
    setLoadingMapMd(true);
    try {
      const text = await getMapMarkdown(currentMapId);
      setMapMarkdown(text || '');
      setMapMarkdownDirty(false);
    } catch (error) {
      console.error('Failed to load map markdown:', error);
      setMapMarkdown('');
    } finally {
      setLoadingMapMd(false);
    }
  }, [currentMapId, getMapMarkdown]);

  // Save map markdown
  const handleSaveMapMarkdown = useCallback(async () => {
    if (currentMapId && mapMarkdownDirty && saveMapMarkdown) {
      try {
        await saveMapMarkdown(currentMapId, mapMarkdown);
        setMapMarkdownDirty(false);
      } catch (error) {
        console.error('Failed to save map markdown:', error);
      }
    }
  }, [currentMapId, mapMarkdown, mapMarkdownDirty, saveMapMarkdown]);

  // Memoized resize trigger function
  const handleResize = useCallback(() => {
    return resizeCounter;
  }, [resizeCounter]);

  // Constants to prevent re-renders
  const EDITOR_HEIGHT = "calc(100vh - 140px)";
  const EDITOR_CLASS_NAME = "node-editor";

  // Save note
  const handleSave = useCallback(() => {
    if (selectedNode && isDirty && noteValue !== (selectedNode.note || '')) {
      onUpdateNode(selectedNode.id, { note: noteValue });
      setIsDirty(false);
    }
  }, [selectedNode?.id, selectedNode?.note, noteValue, isDirty, onUpdateNode]);

  // Auto-save on blur or when component unmounts  
  useEffect(() => {
    return () => {
      const { selectedNode: node, noteValue: value, isDirty: dirty, onUpdateNode: updateFn } = saveDataRef.current;
      if (node && dirty && value !== (node.note || '')) {
        updateFn(node.id, { note: value });
      }
    };
  }, []);

  // Handle resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    let currentWidth = startWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX; // Reverse direction for left panel
      currentWidth = Math.max(300, Math.min(1200, startWidth + deltaX));
      setPanelWidth(currentWidth);
      // Trigger Monaco Editor layout update
      setResizeCounter(prev => prev + 1);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Save width to localStorage
      setLocalStorage(STORAGE_KEYS.NOTES_PANEL_WIDTH, currentWidth);
      // Final Monaco Editor layout update
      setTimeout(() => {
        setResizeCounter(prev => prev + 1);
      }, 50);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // Load saved width on mount
  useEffect(() => {
    const result = getLocalStorage<number>(STORAGE_KEYS.NOTES_PANEL_WIDTH);
    if (result.success && result.data !== undefined) {
      const width = result.data;
      if (width >= 300 && width <= 1200) {
        setPanelWidth(width);
      }
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        handleSave();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onClose]);

  // Disable auto-save when editing map markdown tab is active; re-enable otherwise
  useEffect(() => {
    if (!setAutoSaveEnabled) return;
    const enabled = tab !== 'map-md';
    setAutoSaveEnabled(enabled);
    return () => { setAutoSaveEnabled(true); };
  }, [tab, setAutoSaveEnabled]);

  // When no node is selected, still allow viewing map markdown tab
  if (!selectedNode) {
    return (
      <div 
        ref={panelRef}
        className="node-notes-panel" 
        style={{ width: `${panelWidth}px` }}
      >
        <div 
          ref={resizeHandleRef}
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
        />
        <div className="panel-header">
          <h3 className="panel-title">📝 ノート / 📄 マップMD</h3>
          <div className="panel-controls">
            <div className="note-tabs" role="tablist" aria-label="Notes tabs">
              <button type="button" className={`note-tab ${tab === 'note' ? 'active' : ''}`} onClick={() => setTab('note')} role="tab" aria-selected={tab === 'note'}>ノート</button>
              <button type="button" className={`note-tab ${tab === 'map-md' ? 'active' : ''}`} onClick={() => setTab('map-md')} role="tab" aria-selected={tab === 'map-md'}>マークダウン</button>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="close-button"
                title="閉じる (Esc)"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        {tab === 'map-md' ? (
          <div className="editor-container">
            {loadingMapMd ? (
              <div className="preview-empty"><div className="preview-empty-icon">⏳</div><div className="preview-empty-message">読み込み中...</div></div>
            ) : (
              <MarkdownEditor
                value={mapMarkdown}
                onChange={handleMapMarkdownChange}
                onSave={handleSaveMapMarkdown}
                height={EDITOR_HEIGHT}
                className={EDITOR_CLASS_NAME}
                autoFocus={false}
                readOnly={false}
                onResize={handleResize}
              />
            )}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div className="empty-message">ノードを選択してください</div>
            <div className="empty-description">選択したノードにマークダウン形式のノートを追加できます</div>
          </div>
        )}
        <style>{getStyles(panelWidth, isResizing)}</style>
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="node-notes-panel" 
      style={{ width: `${panelWidth}px` }}
    >
      <div 
        ref={resizeHandleRef}
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      />
      <div className="panel-header">
        <div className="panel-title-section">
          <h3 className="panel-title">📝 ノート / 📄 マップMD</h3>
          {tab === 'note' && (
            <div className="node-info">
              <span className="node-name">{selectedNode.text}</span>
              {isDirty && <span className="dirty-indicator">●</span>}
            </div>
          )}
        </div>
        <div className="panel-controls">
          <div className="note-tabs" role="tablist" aria-label="Notes tabs">
            <button type="button" className={`note-tab ${tab === 'note' ? 'active' : ''}`} onClick={() => setTab('note')} role="tab" aria-selected={tab === 'note'}>ノート</button>
            <button type="button" className={`note-tab ${tab === 'map-md' ? 'active' : ''}`} onClick={() => setTab('map-md')} role="tab" aria-selected={tab === 'map-md'}>マークダウン</button>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="close-button"
              title="閉じる (Esc)"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {tab === 'note' ? (
        <div className="editor-container">
          <MarkdownEditor
            value={noteValue}
            onChange={handleNoteChange}
            onSave={handleSave}
            height={EDITOR_HEIGHT}
            className={EDITOR_CLASS_NAME}
            autoFocus={false}
            onResize={handleResize}
          />
        </div>
      ) : (
        <div className="editor-container">
          {loadingMapMd ? (
            <div className="preview-empty"><div className="preview-empty-icon">⏳</div><div className="preview-empty-message">読み込み中...</div></div>
          ) : (
            <MarkdownEditor
              value={mapMarkdown}
              onChange={handleMapMarkdownChange}
              onSave={handleSaveMapMarkdown}
              height={EDITOR_HEIGHT}
              className={EDITOR_CLASS_NAME}
              autoFocus={false}
              readOnly={false}
              onResize={handleResize}
            />
          )}
        </div>
      )}

      {tab === 'note' && isDirty && (
        <div className="save-status">
          <span className="unsaved-changes">未保存の変更があります</span>
          <button
            type="button"
            onClick={handleSave}
            className="save-button"
          >
            保存
          </button>
        </div>
      )}

      {tab === 'map-md' && mapMarkdownDirty && (
        <div className="save-status">
          <span className="unsaved-changes">未保存の変更があります</span>
          <button
            type="button"
            onClick={handleSaveMapMarkdown}
            className="save-button"
          >
            保存
          </button>
        </div>
      )}

      <style>{getStyles(panelWidth, isResizing)}</style>
    </div>
  );
};

function getStyles(_panelWidth: number, isResizing: boolean) {
  return `
    .node-notes-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      position: relative;
      user-select: ${isResizing ? 'none' : 'auto'};
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
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      flex-shrink: 0;
    }

    .panel-title-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .node-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .node-name {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .dirty-indicator {
      color: #ef4444;
      font-size: 18px;
      line-height: 1;
    }

    .panel-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }


    .close-button {
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: var(--hover-color);
      color: var(--text-primary);
    }

    .note-tabs { display: inline-flex; gap: 6px; margin-right: 8px; }
    .note-tab { 
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .note-tab.active { background: var(--bg-primary); border-color: var(--accent); }

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

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      text-align: center;
      padding: 40px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.6;
    }

    .empty-message {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .empty-description {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .save-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .unsaved-changes {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .save-button {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .save-button:hover {
      background: var(--accent-color);
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .node-notes-panel {
        width: 100vw !important;
      }

      .resize-handle {
        display: none;
      }

      .panel-header {
        padding: 12px 16px;
      }

      .panel-title {
        font-size: 14px;
      }

      .node-name {
        font-size: 12px;
      }

      .empty-state {
        padding: 20px;
        height: 200px;
      }

      .empty-icon {
        font-size: 36px;
      }

      .empty-message {
        font-size: 16px;
      }
    }
  `;
}

export default React.memo(NodeNotesPanel);
