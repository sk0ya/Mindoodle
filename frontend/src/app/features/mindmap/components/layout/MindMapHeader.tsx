import React, { memo } from 'react';
import Toolbar from '../../../../shared/components/ui/Toolbar';
import type { MindMapData } from '@shared/types';

interface MindMapHeaderProps {
  data: MindMapData;
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
  onCenterRootNode?: () => void;
}

const MindMapHeader: React.FC<MindMapHeaderProps> = ({
  data,
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
  onCenterRootNode
}) => {
  return (
    <Toolbar
      title={data.title}
      onTitleChange={onTitleChange}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      zoom={zoom}
      onZoomReset={onZoomReset}
      onAutoLayout={onAutoLayout}
      storageMode={storageMode}
      onStorageModeChange={onStorageModeChange}
      onToggleNotesPanel={onToggleNotesPanel}
      showNotesPanel={showNotesPanel}
      onCenterRootNode={onCenterRootNode}
    />
  );
};

export default memo(MindMapHeader);
