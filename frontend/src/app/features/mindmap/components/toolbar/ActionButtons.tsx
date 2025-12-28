import React from 'react';
import { RotateCcw, RotateCw, Search, Ruler, Target, FileText, StickyNote } from 'lucide-react';
import { ShortcutTooltip } from '../Shared/ShortcutTooltip';

interface ActionButtonsProps {
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onAutoLayout?: () => void;
  onToggleNotesPanel?: () => void;
  showNotesPanel?: boolean;
  onToggleNodeNotePanel?: () => void;
  showNodeNotePanel?: boolean;
  onCenterRootNode?: () => void;
  layout?: 'default' | 'twoRows';
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onAutoLayout,
  onToggleNotesPanel,
  showNotesPanel = false,
  onToggleNodeNotePanel,
  showNodeNotePanel = false,

  onCenterRootNode,
  layout = 'default'
}) => {
  // Shared button rendering components
  const UndoButton = () => (
    <ShortcutTooltip shortcut="Ctrl+Z" description="元に戻す">
      <button className={`toolbar-btn undo ${!canUndo ? 'disabled' : ''}`} onClick={onUndo} disabled={!canUndo}>
        <RotateCcw size={16} />
      </button>
    </ShortcutTooltip>
  );

  const RedoButton = () => (
    <ShortcutTooltip shortcut="Ctrl+Y" description="やり直し">
      <button className={`toolbar-btn redo ${!canRedo ? 'disabled' : ''}`} onClick={onRedo} disabled={!canRedo}>
        <RotateCw size={16} />
      </button>
    </ShortcutTooltip>
  );

  const ZoomResetButton = () => (
    <ShortcutTooltip description={`ズームリセット (現在: ${Math.round(zoom * 100)}%)`}>
      <button className="toolbar-btn zoom-reset" onClick={onZoomReset}>
        <Search size={16} /> {Math.round(zoom * 100)}%
      </button>
    </ShortcutTooltip>
  );

  const AutoLayoutButton = () => onAutoLayout ? (
    <ShortcutTooltip shortcut="Ctrl+L" description="自動整列">
      <button className="toolbar-btn auto-layout" onClick={onAutoLayout}>
        <Ruler size={16} />
      </button>
    </ShortcutTooltip>
  ) : null;

  const CenterRootButton = () => onCenterRootNode ? (
    <ShortcutTooltip description="ルートノードを左端中央に表示">
      <button className="toolbar-btn center-root" onClick={onCenterRootNode}>
        <Target size={16} />
      </button>
    </ShortcutTooltip>
  ) : null;

  const NotesPanelButton = ({ enablePrefetch = false }) => onToggleNotesPanel ? (
    <ShortcutTooltip shortcut="Ctrl+Shift+N" description="マップのMarkdown">
      <button
        className={`toolbar-btn notes ${showNotesPanel ? 'active' : ''}`}
        onClick={onToggleNotesPanel}
        onMouseEnter={enablePrefetch ? () => {
          try { import('../layout/panel/NodeNotesPanelContainer'); } catch {}
        } : undefined}
      >
        <FileText size={16} />
      </button>
    </ShortcutTooltip>
  ) : null;

  const NodeNotePanelButton = ({ enablePrefetch = false }) => onToggleNodeNotePanel ? (
    <ShortcutTooltip shortcut="Ctrl+Shift+M" description="選択ノードのノート">
      <button
        className={`toolbar-btn notes ${showNodeNotePanel ? 'active' : ''}`}
        onClick={onToggleNodeNotePanel}
        onMouseEnter={enablePrefetch ? () => {
          try { import('../panels/SelectedNodeNotePanel'); } catch {}
        } : undefined}
      >
        <StickyNote size={16} />
      </button>
    </ShortcutTooltip>
  ) : null;

  if (layout === 'twoRows') {
    return (
      <div className="toolbar-actions two-rows">
        {}
        <div className="action-row">
          <div className="action-group edit-actions">
            <UndoButton />
            <RedoButton />
            <ZoomResetButton />
          </div>
        </div>
        {}
        <div className="action-row">
          <div className="action-group view-actions">
            <AutoLayoutButton />
            <CenterRootButton />
            <NotesPanelButton enablePrefetch={false} />
            <NodeNotePanelButton enablePrefetch={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar-actions">
      {}
      <div className="action-group edit-actions">
        <UndoButton />
        <RedoButton />
      </div>

      {}
      <div className="action-group view-actions">
        <ZoomResetButton />
        <AutoLayoutButton />
        <CenterRootButton />
      </div>

      {}
      <div className="action-group help-actions">
        <NotesPanelButton enablePrefetch={true} />
        <NodeNotePanelButton enablePrefetch={true} />
      </div>
    </div>
  );
};

export default ActionButtons;
