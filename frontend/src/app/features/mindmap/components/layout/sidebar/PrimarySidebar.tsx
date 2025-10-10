
import React from 'react';
import MindMapSidebar from './MindMapSidebar';
import SettingsSidebar from './SettingsSidebar';
import ColorSettingsSidebar from './ColorSettingsSidebar';
import AISidebar from './AISidebar';
import SearchSidebar from './SearchSidebar';
import VimSidebar from './VimSidebar';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';
import '../PrimarySidebar.css';

interface PrimarySidebarProps {
  activeView: string | null;
  isVisible: boolean;
  
  mindMaps?: MindMapData[];
  currentMapId?: string | null;
  currentWorkspaceId?: string | null;
  onSelectMap?: (id: MapIdentifier) => void;
  onCreateMap?: (title: string, workspaceId: string, category?: string) => void;
  onDeleteMap?: (id: MapIdentifier) => void;
  onRenameMap?: (id: MapIdentifier, newTitle: string) => void;
  onChangeCategory?: (id: MapIdentifier, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  onSwitchWorkspace?: (workspaceId: string | null) => void;
  explorerTree: ExplorerItem;
  onCreateFolder?: (path: string) => Promise<void> | void;
  
  onMapSwitch?: (mapIdentifier: MapIdentifier) => Promise<void>;
  onNodeSelectByLine?: (lineNumber: number) => Promise<void>;
  
  storageAdapter?: any;
}

const PrimarySidebar: React.FC<PrimarySidebarProps> = ({
  activeView,
  isVisible,
  
  mindMaps = [],
  currentMapId,
  currentWorkspaceId,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  onChangeCategoryBulk,
  workspaces = [],
  onAddWorkspace,
  onRemoveWorkspace,
  onSwitchWorkspace,
  explorerTree,
  onCreateFolder,
  
  onMapSwitch,
  onNodeSelectByLine,
  storageAdapter
}) => {
  if (!isVisible || !activeView) {
    return null;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'maps':
        return (
          <MindMapSidebar
            mindMaps={mindMaps}
            currentMapId={currentMapId || null}
            currentWorkspaceId={currentWorkspaceId || null}
            onSelectMap={onSelectMap || (() => {})}
            onCreateMap={onCreateMap || (() => {})}
            onDeleteMap={onDeleteMap || (() => {})}
            onRenameMap={onRenameMap || (() => {})}
            onChangeCategory={onChangeCategory || (() => {})}
            onChangeCategoryBulk={onChangeCategoryBulk}
            isCollapsed={false}
            onToggleCollapse={() => {}}
            workspaces={workspaces}
            onAddWorkspace={onAddWorkspace}
            onRemoveWorkspace={onRemoveWorkspace}
            onSwitchWorkspace={onSwitchWorkspace}
            explorerTree={explorerTree}
            onCreateFolder={onCreateFolder}
          />
        );
      
      case 'search':
        return (
          <SearchSidebar
            onMapSwitch={onMapSwitch}
            onNodeSelectByLine={onNodeSelectByLine}
            storageAdapter={storageAdapter}
            workspaces={workspaces}
          />
        );
      case 'ai':
        return <AISidebar />;

      case 'colors':
        return <ColorSettingsSidebar />;

      case 'settings':
        return (
          <SettingsSidebar
          />
        );

      case 'vim':
        return <VimSidebar />;

      default:
        return null;
    }
  };

  return (
    <div className="primary-sidebar">      
      <div className="primary-sidebar-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default PrimarySidebar;
