import React from 'react';
import PrimarySidebar from './PrimarySidebar';
import type { MapIdentifier } from '@shared/types';

type Props = {
  activeView: string | null;
  storageMode: 'local';
  onModeChange?: (mode: 'local') => void;
  // Mind map context
  allMindMaps: any[];
  currentMapId: string | null;
  onSelectMap: (id: MapIdentifier) => void;
  onCreateMap: (title: string, workspaceId: string, category?: string) => Promise<string>;
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
  onMapSwitch: (id: MapIdentifier) => Promise<void>;
  onMapSwitchWithNodeSelect?: (id: MapIdentifier, nodeId: string) => Promise<void>;
  // Provide storage adapter to lazy-load all maps for search
  storageAdapter?: any;
};

const PrimarySidebarContainer: React.FC<Props> = (props) => {
  const {
    activeView,
    storageMode,
    allMindMaps,
    currentMapId,
    onSelectMap,
    onCreateMap,
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
    onMapSwitchWithNodeSelect,
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
      storageMode={storageMode}
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
      onMapSwitchWithNodeSelect={onMapSwitchWithNodeSelect}
      loadAllMaps={async () => {
        try {
          const adapter = storageAdapter;
          if (adapter && typeof adapter.loadAllMaps === 'function') {
            const maps = await adapter.loadAllMaps();
            return maps || [];
          }
        } catch {}
        // Fallback to in-memory list
        return allMindMaps || [];
      }}
    />
  );
};

export default PrimarySidebarContainer;
