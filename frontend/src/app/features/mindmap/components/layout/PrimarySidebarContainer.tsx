import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import type { MapIdentifier } from '@shared/types';

type Props = {
  activeView: string | null;
  // Mind map context
  allMindMaps: any[];
  currentMapId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => Promise<string>;
  onRenameMap: (id: MapIdentifier, title: string) => Promise<void> | void;
  onChangeCategory: (id: MapIdentifier, category: string) => Promise<void> | void;
  onChangeCategoryBulk: (updates: Array<{ id: string; category: string }>) => Promise<void>;
  // Workspaces management
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  explorerTree: any;
  onCreateFolder: (path: string) => Promise<void>;
  currentMapData: any;
  onMapSwitch: (mapIdentifier: MapIdentifier) => Promise<void>;
  onNodeSelectByLine: (lineNumber: number) => Promise<void>;
  // Provide storage adapter to lazy-load all maps for search
  storageAdapter?: any;
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
    onAddWorkspace,
    onRemoveWorkspace,
    explorerTree,
    onCreateFolder,
    currentMapData,
    onMapSwitch,
    onNodeSelectByLine,
    storageAdapter,
  } = props;


  // onCreateMapをラップして適切なworkspaceIdを渡す
  const handleCreateMap = React.useCallback((title: string, workspaceId: string, category?: string) => {
    return onCreateMap(title, workspaceId, category);
  }, [onCreateMap]);

  return (
    <PrimarySidebar
      activeView={activeView}
      isVisible={activeView !== null}
      mindMaps={allMindMaps}
      currentMapId={currentMapId}
      currentWorkspaceId={currentMapData?.mapIdentifier?.workspaceId || null}
      onSelectMap={onSelectMap}
      onCreateMap={handleCreateMap}
      onRenameMap={onRenameMap}
      onChangeCategory={onChangeCategory}
      onChangeCategoryBulk={onChangeCategoryBulk}
      workspaces={workspaces}
      onAddWorkspace={onAddWorkspace}
      onRemoveWorkspace={onRemoveWorkspace}
      explorerTree={explorerTree}
      onCreateFolder={onCreateFolder}
      onMapSwitch={onMapSwitch}
      onNodeSelectByLine={onNodeSelectByLine}
      storageAdapter={storageAdapter}
    />
  );
};

export default PrimarySidebarContainer;
