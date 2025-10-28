import React from 'react';
import TopLeftTitlePanel from '../panel/TopLeftTitlePanel';

interface Props {
  title: string;
  activeView: any;
  sidebarCollapsed?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onUndo: () => any;
  onRedo: () => any;
  onZoomReset: () => void;
  onAutoLayout: () => void;
  onToggleNotesPanel: () => void;
  showNotesPanel: boolean;
  onToggleNodeNotePanel: () => void;
  showNodeNotePanel: boolean;
  onCenterRootNode: () => void;
}

const MindMapTopBar: React.FC<Props> = (props) => {
  const { sidebarCollapsed, ...rest } = props;
  return <TopLeftTitlePanel sidebarCollapsed={!!sidebarCollapsed} {...rest as any} />;
};

export default MindMapTopBar;
