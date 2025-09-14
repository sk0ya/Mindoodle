import React from 'react';
import PrimarySidebar from './PrimarySidebar';

type Props = {
  activeView: string | null;
  storageMode: 'local' | 'cloud' | 'markdown';
  onModeChange?: (mode: 'local' | 'cloud' | 'markdown') => void;
  // Mind map context
  allMindMaps: any[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string, category?: string) => Promise<string>;
  onDeleteMap: (mapId: string) => Promise<void>;
  onRenameMap: (mapId: string, title: string) => Promise<void> | void;
  onChangeCategory: (mapId: string, category: string) => Promise<void> | void;
  onChangeCategoryBulk: (updates: Array<{ id: string; category: string }>) => Promise<void>;
  onShowKeyboardHelper: () => void;
  onAutoLayout: () => void;
  onSelectFolder: () => Promise<void>;
  onShowFolderGuide: () => void;
  currentFolderLabel: string | null;
  explorerTree: any;
  onCreateFolder: (path: string) => Promise<void>;
  onExport: () => void;
  onImport: () => void;
  currentMapData: any;
  onNodeSelect: (nodeId: string) => void;
  onMapSwitch: (mapId: string) => void;
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
    onSelectFolder,
    onShowFolderGuide,
    currentFolderLabel,
    explorerTree,
    onCreateFolder,
    onExport,
    onImport,
    currentMapData,
    onNodeSelect,
    onMapSwitch,
  } = props;

  return (
    <PrimarySidebar
      activeView={activeView}
      isVisible={activeView !== null}
      mindMaps={allMindMaps}
      currentMapId={currentMapId}
      onSelectMap={onSelectMap}
      onCreateMap={onCreateMap}
      onDeleteMap={onDeleteMap}
      onRenameMap={onRenameMap}
      onChangeCategory={onChangeCategory}
      onChangeCategoryBulk={onChangeCategoryBulk}
      availableCategories={['仕事', 'プライベート', '学習', '未分類']}
      storageMode={storageMode}
      onStorageModeChange={onModeChange}
      onShowKeyboardHelper={onShowKeyboardHelper}
      onAutoLayout={onAutoLayout}
      onSelectFolder={onSelectFolder}
      onShowFolderGuide={onShowFolderGuide}
      currentFolderLabel={currentFolderLabel}
      explorerTree={explorerTree}
      onCreateFolder={onCreateFolder}
      onExport={onExport}
      onImport={onImport}
      currentMapData={currentMapData}
      onNodeSelect={onNodeSelect}
      onMapSwitch={onMapSwitch}
    />
  );
};

export default PrimarySidebarContainer;

