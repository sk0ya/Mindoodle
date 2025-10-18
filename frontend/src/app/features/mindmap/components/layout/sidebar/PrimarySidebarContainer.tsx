
import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import type { MapIdentifier, MindMapData } from '@shared/types';
import type { ExplorerItem, StorageAdapter } from '@core/types';

type Props = {
  activeView: string | null;

  allMindMaps: MindMapData[];
  currentMapId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => Promise<string>;
  onRenameMap: (id: MapIdentifier, title: string) => Promise<void> | void;
  onChangeCategory: (id: MapIdentifier, category: string) => Promise<void> | void;
  onChangeCategoryBulk: (updates: Array<{ id: string; category: string }>) => Promise<void>;

  workspaces?: Array<{ id: string; name: string }>;
  currentWorkspaceId?: string | null;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  onSwitchWorkspace?: (workspaceId: string | null) => void;
  explorerTree: ExplorerItem;
  onCreateFolder: (path: string) => Promise<void>;
  currentMapData: MindMapData | null;
  onMapSwitch: (mapIdentifier: MapIdentifier) => Promise<void>;
  onNodeSelectByLine: (lineNumber: number) => Promise<void>;

  storageAdapter?: StorageAdapter;
};

const PrimarySidebarContainer: React.FC<Props> = (props) => {
  const {
    activeView,
    allMindMaps,
    currentMapId,
    onSelectMap,
    onCreateMap,
    onRenameMap,
    onChangeCategory,
    onChangeCategoryBulk,
    workspaces,
    currentWorkspaceId,
    onAddWorkspace,
    onRemoveWorkspace,
    onSwitchWorkspace,
    explorerTree,
    onCreateFolder,
    currentMapData,
    onMapSwitch,
    onNodeSelectByLine,
    storageAdapter,
  } = props;


  
  const handleCreateMap = React.useCallback((title: string, workspaceId: string, category?: string) => {
    return onCreateMap(title, workspaceId, category);
  }, [onCreateMap]);

  return (
    <PrimarySidebar
      activeView={activeView}
      isVisible={activeView !== null}
      mindMaps={allMindMaps}
      currentMapId={currentMapId}
      currentWorkspaceId={currentWorkspaceId || currentMapData?.mapIdentifier?.workspaceId || null}
      onSelectMap={onSelectMap}
      onCreateMap={handleCreateMap}
      onRenameMap={onRenameMap}
      onChangeCategory={onChangeCategory}
      onChangeCategoryBulk={onChangeCategoryBulk}
      workspaces={workspaces}
      onAddWorkspace={onAddWorkspace}
      onRemoveWorkspace={onRemoveWorkspace}
      onSwitchWorkspace={onSwitchWorkspace}
      explorerTree={explorerTree}
      onCreateFolder={onCreateFolder}
      onMapSwitch={onMapSwitch}
      onNodeSelectByLine={onNodeSelectByLine}
      storageAdapter={storageAdapter}
    />
  );
};

export default React.memo(PrimarySidebarContainer);
