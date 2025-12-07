import { useMindMapStore } from '../store';
import type { MindMapNode } from '@shared/types';

/**
 * Store selectors for data access
 * Provides a layer of abstraction over direct store access
 * Phase 3: Consolidated hook patterns for common store access
 *
 * IMPORTANT: Each selector uses separate useMindMapStore calls to avoid
 * creating new object references on every render, which would cause
 * infinite re-render loops in components.
 */

// Non-reactive store getters (for use in callbacks and event handlers)
// These are not hooks and don't cause re-renders
export const getStoreState = () => useMindMapStore.getState();
export const getRootNodes = (): MindMapNode[] => getStoreState().data?.rootNodes || [];
export const getEditingNodeId = () => getStoreState().editingNodeId;
export const getEditingMode = () => getStoreState().editingMode;
export const getSelectedNodeId = () => getStoreState().selectedNodeId;
export const getUIMode = () => getStoreState().ui.mode;

// Data selectors
export const useRootNodes = () => {
  return useMindMapStore(s => s.data?.rootNodes || []);
};

export const useMapTitle = () => {
  return useMindMapStore(s => s.data?.title || '');
};

export const useMapData = () => {
  return useMindMapStore(s => s.data);
};

export const useNormalizedData = () => {
  return useMindMapStore(s => s.normalizedData);
};

// UI selectors
export const useUIMode = () => {
  return useMindMapStore(s => s.ui.mode);
};

export const useUI = () => {
  return useMindMapStore(s => s.ui);
};

export const useViewport = () => {
  const zoom = useMindMapStore(s => s.ui.zoom);
  const pan = useMindMapStore(s => s.ui.pan);
  const setZoom = useMindMapStore(s => s.setZoom);
  const setPan = useMindMapStore(s => s.setPan);

  return { zoom, pan, setZoom, setPan };
};

// History selectors
export const useHistoryState = () => {
  const canUndo = useMindMapStore(s => s.canUndo());
  const canRedo = useMindMapStore(s => s.canRedo());
  const undo = useMindMapStore(s => s.undo);
  const redo = useMindMapStore(s => s.redo);

  return { canUndo, canRedo, undo, redo };
};

// Settings selectors
export const useSettings = () => {
  return useMindMapStore(s => s.settings);
};

export const useUpdateSetting = () => {
  return useMindMapStore(s => s.updateSetting);
};

// Panel control selectors
export const usePanelControls = () => {
  const setMarkdownPanelWidth = useMindMapStore(s => s.setMarkdownPanelWidth);
  const setNodeNotePanelHeight = useMindMapStore(s => s.setNodeNotePanelHeight);

  return { setMarkdownPanelWidth, setNodeNotePanelHeight };
};

// Cache control selectors
export const useCacheControls = () => {
  const clearMermaidRelatedCaches = useMindMapStore(s => s.clearMermaidRelatedCaches);

  return { clearMermaidRelatedCaches };
};

// Node operations selectors
export const useNodeOperations = () => {
  const addChildNode = useMindMapStore(s => s.addChildNode);
  const updateNode = useMindMapStore(s => s.updateNode);
  const deleteNode = useMindMapStore(s => s.deleteNode);
  const moveNode = useMindMapStore(s => s.moveNode);
  const moveNodeWithPosition = useMindMapStore(s => s.moveNodeWithPosition);
  const changeSiblingOrder = useMindMapStore(s => s.changeSiblingOrder);
  const toggleNodeCollapse = useMindMapStore(s => s.toggleNodeCollapse);

  return {
    addChildNode,
    updateNode,
    deleteNode,
    moveNode,
    moveNodeWithPosition,
    changeSiblingOrder,
    toggleNodeCollapse
  };
};

// Map operations selectors
export const useMapOperations = () => {
  const setData = useMindMapStore(s => s.setData);
  const setRootNodes = useMindMapStore(s => s.setRootNodes);
  const updateMapMetadata = useMindMapStore(s => s.updateMapMetadata);
  const applyAutoLayout = useMindMapStore(s => s.applyAutoLayout);

  return { setData, setRootNodes, updateMapMetadata, applyAutoLayout };
};

// UI operations selectors
export const useUIOperations = () => {
  const setMode = useMindMapStore(s => s.setMode);
  const setActiveView = useMindMapStore(s => s.setActiveView);
  const togglePanel = useMindMapStore(s => s.togglePanel);
  const toggleSidebar = useMindMapStore(s => s.toggleSidebar);
  const setSidebarCollapsed = useMindMapStore(s => s.setSidebarCollapsed);
  const closeAllPanels = useMindMapStore(s => s.closeAllPanels);
  const setShowNotesPanel = useMindMapStore(s => s.setShowNotesPanel);
  const toggleNotesPanel = useMindMapStore(s => s.toggleNotesPanel);
  const setShowImageModal = useMindMapStore(s => s.setShowImageModal);
  const setFileMenuPosition = useMindMapStore(s => s.setFileMenuPosition);
  const setShowFileActionMenu = useMindMapStore(s => s.setShowFileActionMenu);
  const resetZoom = useMindMapStore(s => s.resetZoom);

  return {
    setMode,
    setActiveView,
    togglePanel,
    toggleSidebar,
    setSidebarCollapsed,
    closeAllPanels,
    setShowNotesPanel,
    toggleNotesPanel,
    setShowImageModal,
    setFileMenuPosition,
    setShowFileActionMenu,
    resetZoom,
  };
};
