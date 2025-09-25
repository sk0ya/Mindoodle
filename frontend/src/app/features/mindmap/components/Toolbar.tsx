import React, { memo } from 'react';
import ToolbarLogo from './toolbar/ToolbarLogo';
import TitleEditor from './toolbar/TitleEditor';
import ActionButtons from './toolbar/ActionButtons';
import StorageModeSwitch from './toolbar/StorageModeSwitch';
import ToolbarStyles from '../styles/ToolbarStyles';

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onAutoLayout?: () => void;
  storageMode?: 'local' | 'markdown';
  onStorageModeChange?: (mode: 'local' | 'markdown') => void;
  onToggleNotesPanel?: () => void;
  showNotesPanel?: boolean;
  onToggleNodeNotePanel?: () => void;
  showNodeNotePanel?: boolean;
  onCenterRootNode?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onAutoLayout,
  storageMode = 'local',
  onStorageModeChange,
  onToggleNotesPanel,
  showNotesPanel = false,
  onToggleNodeNotePanel,
  showNodeNotePanel = false,
  onCenterRootNode
}) => {
  return (
    <div className="toolbar">
      <ToolbarLogo />
      
      <TitleEditor 
        title={title}
        onTitleChange={onTitleChange}
      />
      
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
      />

      {onStorageModeChange && storageMode !== 'markdown' && (
        <StorageModeSwitch
          currentMode={storageMode as 'local' | 'markdown'}
          onModeChange={onStorageModeChange}
        />
      )}
      
      <ToolbarStyles />
    </div>
  );
};

export default memo(Toolbar);
