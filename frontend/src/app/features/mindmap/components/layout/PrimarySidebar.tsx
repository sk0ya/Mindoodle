import React from 'react';
import MindMapSidebar from './MindMapSidebar';
import SettingsSidebar from './SettingsSidebar';
import AISidebar from './AISidebar';
import SearchSidebar from './SearchSidebar';
import type { MindMapData, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '../../../../core/storage/types';
import './PrimarySidebar.css';

interface PrimarySidebarProps {
  activeView: string | null;
  isVisible: boolean;
  // Maps view props
  mindMaps?: MindMapData[];
  currentMapId?: string | null;
  currentWorkspaceId?: string | null;
  onSelectMap?: (id: MapIdentifier) => void;
  onCreateMap?: (title: string, category?: string) => void;
  onDeleteMap?: (id: MapIdentifier) => void;
  onRenameMap?: (id: MapIdentifier, newTitle: string) => void;
  onChangeCategory?: (id: MapIdentifier, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  availableCategories?: string[];
  // Workspaces
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  // Settings props
  storageMode?: 'local' | 'markdown';
  onStorageModeChange?: (mode: 'local' | 'markdown') => void;
  onShowKeyboardHelper?: () => void;
  onAutoLayout?: () => void;
  explorerTree?: ExplorerItem | null;
  onCreateFolder?: (path: string) => Promise<void> | void;
  // Current map data for export
  currentMapData?: MindMapData | null;
  // Search props
  onNodeSelect?: (nodeId: string) => void;
  onMapSwitch?: (id: MapIdentifier) => void;
}

const PrimarySidebar: React.FC<PrimarySidebarProps> = ({
  activeView,
  isVisible,
  // Maps props
  mindMaps = [],
  currentMapId,
  currentWorkspaceId,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  onChangeCategoryBulk,
  availableCategories = [],
  workspaces = [],
  onAddWorkspace,
  onRemoveWorkspace,
  // Settings props
  storageMode,
  onStorageModeChange,
  onShowKeyboardHelper,
  onAutoLayout,
  explorerTree,
  onCreateFolder,
  // Current map data
  currentMapData,
  // Search props
  onNodeSelect,
  onMapSwitch
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
            availableCategories={availableCategories}
            isCollapsed={false}
            onToggleCollapse={() => {}}
            workspaces={workspaces}
            onAddWorkspace={onAddWorkspace}
            onRemoveWorkspace={onRemoveWorkspace}
            explorerTree={explorerTree || undefined}
            onCreateFolder={onCreateFolder}
          />
        );
      
      case 'search':
        return (
          <SearchSidebar
            currentMapData={currentMapData}
            allMapsData={mindMaps}
            onNodeSelect={onNodeSelect}
            onMapSwitch={onMapSwitch}
          />
        );
      
      // attachments view removed
      
      // import/export sidebars removed
      
      case 'ai':
        return <AISidebar />;
      
      case 'settings':
        return (
          <SettingsSidebar
            storageMode={storageMode}
            onStorageModeChange={onStorageModeChange}
            onShowKeyboardHelper={onShowKeyboardHelper}
            onAutoLayout={onAutoLayout}
          />
        );
      
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
