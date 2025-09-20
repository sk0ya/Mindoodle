import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import type { MapIdentifier } from '@shared/types';

type Props = {
  activeView: string | null;
  storageMode: 'local' | 'markdown';
  onModeChange?: (mode: 'local' | 'markdown') => void;
  // Mind map context
  allMindMaps: any[];
  currentMapId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => Promise<string>;
  onDeleteMap: (id: MapIdentifier) => Promise<void>;
  onRenameMap: (id: MapIdentifier, title: string) => Promise<void> | void;
  onChangeCategory: (id: MapIdentifier, category: string) => Promise<void> | void;
  onChangeCategoryBulk: (updates: Array<{ id: string; category: string }>) => Promise<void>;
  onShowKeyboardHelper: () => void;
  onAutoLayout: () => void;
  // Workspaces management
  workspaces?: Array<{ id: string; name: string }>;
  onAddWorkspace?: () => void;
  onRemoveWorkspace?: (id: string) => void;
  explorerTree: any;
  onCreateFolder: (path: string) => Promise<void>;
  currentMapData: any;
  onNodeSelect: (nodeId: string) => void;
  onMapSwitch: (id: MapIdentifier) => void;
};

const PrimarySidebarContainer: React.FC<Props> = (props) => {
  const {
    activeView,
    storageMode,
    onModeChange,
    allMindMaps,
    currentMapId,
    onSelectMap,
    onCreateMap,
    onDeleteMap,
    onRenameMap,
    onChangeCategory,
    onChangeCategoryBulk,
    onShowKeyboardHelper,
    onAutoLayout,
    workspaces,
    onAddWorkspace,
    onRemoveWorkspace,
    explorerTree,
    onCreateFolder,
    currentMapData,
    onNodeSelect,
    onMapSwitch,
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
      onDeleteMap={onDeleteMap}
      onRenameMap={onRenameMap}
      onChangeCategory={onChangeCategory}
      onChangeCategoryBulk={onChangeCategoryBulk}
      availableCategories={['仕事', 'プライベート', '学習', '未分類']}
      storageMode={storageMode}
      onStorageModeChange={onModeChange}
      onShowKeyboardHelper={onShowKeyboardHelper}
      onAutoLayout={onAutoLayout}
      workspaces={workspaces}
      onAddWorkspace={onAddWorkspace}
      onRemoveWorkspace={onRemoveWorkspace}
      explorerTree={explorerTree}
      onCreateFolder={onCreateFolder}
      currentMapData={currentMapData}
      onNodeSelect={onNodeSelect}
      onMapSwitch={onMapSwitch}
    />
  );
};

export default PrimarySidebarContainer;
