import { useMindMapStore } from '../store';

/**
 * Store selectors for data access
 * Provides a layer of abstraction over direct store access
 * Phase 3: Consolidated hook patterns for common store access
 */

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
  return useMindMapStore(s => ({
    zoom: s.ui.zoom,
    pan: s.ui.pan,
    setZoom: s.setZoom,
    setPan: s.setPan,
  }));
};

// History selectors
export const useHistoryState = () => {
  return useMindMapStore(s => ({
    canUndo: s.canUndo(),
    canRedo: s.canRedo(),
    undo: s.undo,
    redo: s.redo,
  }));
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
  return useMindMapStore(s => ({
    setMarkdownPanelWidth: s.setMarkdownPanelWidth,
    setNodeNotePanelHeight: s.setNodeNotePanelHeight,
  }));
};

// Cache control selectors
export const useCacheControls = () => {
  return useMindMapStore(s => ({
    clearMermaidRelatedCaches: s.clearMermaidRelatedCaches,
  }));
};
