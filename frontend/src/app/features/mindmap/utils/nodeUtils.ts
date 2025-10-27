// Node Utils - Re-export Module
// This file aggregates all node utility functions from focused modules.
// The original 1,082-line file has been split into 5 specialized modules
// for better maintainability and clarity.

// Text Measurement & Wrapping (436 lines)
export {
  measureTextWidth,
  wrapNodeText,
  getNodeTextLineHeight,
  getNodeTextMaxWidth,
  resolveNodeTextWrapConfig,
  BREAK_BEFORE_CHARS,
  type WrappedToken,
  type WrappedLine,
  type WrapNodeTextResult,
  type WrapNodeTextOptions,
  type NodeTextWrapConfig,
  type NodeTextWrapSettingsLike
} from './nodeMeasurement';

// Node Size Calculation (338 lines)
export {
  calculateNodeSize,
  calculateIconLayout,
  getNodeHorizontalPadding,
  getMarkerPrefixTokens,
  TEXT_ICON_SPACING,
  type NodeSize,
  type IconLayout
} from './nodeSize';

// Node Geometry - Position & Bounds (38 lines)
export {
  getNodeLeftX,
  getNodeRightX,
  getNodeTopY,
  getNodeBottomY,
  getNodeBounds
} from './nodeGeometry';

// Node Layout Calculation (101 lines)
export {
  getToggleButtonPosition,
  getDynamicNodeSpacing,
  calculateChildNodeX
} from './nodeLayout';

// Color Management (178 lines)
export {
  getBranchColor,
  generateBranchColors,
  getColorSetColors
} from './nodeColor';
