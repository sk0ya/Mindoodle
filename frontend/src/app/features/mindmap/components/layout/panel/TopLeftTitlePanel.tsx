// moved to layout/panel
import React from 'react';
import ActionButtons from '../../toolbar/ActionButtons';
import ToolbarStyles from '../../../styles/ToolbarStyles';

type Props = {
  title: string;
  activeView: string | null;
  sidebarCollapsed: boolean;
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
};

const TopLeftTitlePanel: React.FC<Props> = ({
  title,
  activeView,
  sidebarCollapsed,
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
}) => {
  // Calculate left offset to hug the visible left edge of the map area
  const ACTIVITY_BAR = 48; // matches ActivityBar.css width
  const SIDEBAR = 280; // matches PrimarySidebar.css width
  // Ensure buttons are always aligned to the actual visible left edge
  const leftOffset = ACTIVITY_BAR + (activeView && !sidebarCollapsed ? SIDEBAR : 0) + 8; // consistent padding

  return (
    <div
      className="top-left-title-panel"
      style={{
        position: 'fixed',
        top: 6,
        left: leftOffset,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none', // allow map interactions; buttons re-enable
      }}
    >
      {/* Brand small label */}
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-secondary)',
          letterSpacing: 0.6,
          fontWeight: 600,
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        aria-label="App name"
      >
        Mindoodle
      </div>

      {/* Non-editable map title */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.2,
          userSelect: 'none',
          pointerEvents: 'auto',
          maxWidth: 'calc(100vw - 400px)', // Dynamic width based on viewport
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={title}
        aria-label="Map title"
      >
        {title}
      </div>

      {/* Action buttons under title */}
      <div style={{
        pointerEvents: 'auto',
        alignSelf: 'flex-start', // Force buttons to align to left edge
        width: 'auto' // Don't stretch to fill container width
      }}>
        <ActionButtons
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
          onZoomReset={onZoomReset}
          onAutoLayout={onAutoLayout}
          onToggleNotesPanel={onToggleNotesPanel}
          showNotesPanel={showNotesPanel}
          onToggleNodeNotePanel={onToggleNodeNotePanel}
          showNodeNotePanel={showNodeNotePanel}
          onCenterRootNode={onCenterRootNode}
          layout="twoRows"
        />
      </div>

      {/* Reuse button styles from toolbar */}
      <ToolbarStyles />
      <style>{`
        /* Two-row layout via rows containers */
        .top-left-title-panel .toolbar-actions.two-rows {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .top-left-title-panel .toolbar-actions.two-rows .action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .top-left-title-panel .toolbar-actions.two-rows .action-group {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0;
          border-left: none;
        }
        /* Slightly compact buttons for the small panel */
        .top-left-title-panel .toolbar-btn {
          padding: 6px 10px;
        }
      `}</style>
    </div>
  );
};

export default TopLeftTitlePanel;
