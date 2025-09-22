import type { MindMapData, MapIdentifier } from '@shared/types';

// Basic constants for initial data creation
const DEFAULTS = {
  NEW_MAP_TITLE: 'New Mind Map',
  AUTO_SAVE: true,
  AUTO_LAYOUT: false,
  SNAP_TO_GRID: false,
  SHOW_GRID: false,
  ANIMATION_ENABLED: true
};

const COORDINATES = {
  ROOT_NODE_X: 400,
  ROOT_NODE_Y: 300,
  DEFAULT_CENTER_X: 400,
  DEFAULT_CENTER_Y: 300
};

const TYPOGRAPHY = {
  DEFAULT_FONT_SIZE: 16,
  DEFAULT_FONT_WEIGHT: '500'
};

export const createInitialData = (mapIdentifier: MapIdentifier): MindMapData => ({
  title: DEFAULTS.NEW_MAP_TITLE,
  category: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mapIdentifier,
  rootNodes: [{
    id: 'root',
    text: DEFAULTS.NEW_MAP_TITLE,
    x: COORDINATES.ROOT_NODE_X,
    y: COORDINATES.ROOT_NODE_Y,
    fontSize: TYPOGRAPHY.DEFAULT_FONT_SIZE,
    fontWeight: TYPOGRAPHY.DEFAULT_FONT_WEIGHT,
    children: [],
  }],
  settings: {
    autoSave: DEFAULTS.AUTO_SAVE,
    autoLayout: DEFAULTS.AUTO_LAYOUT,
    snapToGrid: DEFAULTS.SNAP_TO_GRID,
    showGrid: DEFAULTS.SHOW_GRID,
    animationEnabled: DEFAULTS.ANIMATION_ENABLED
  }
});