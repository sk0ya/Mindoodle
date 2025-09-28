/**
 * Canvas coordinate conversion utilities
 * Handles conversion between screen coordinates and SVG coordinates
 */

export interface CanvasCoordinates {
  svgX: number;
  svgY: number;
  screenX: number;
  screenY: number;
}

export interface ViewportTransform {
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Convert screen coordinates to SVG coordinates
 */
export const convertScreenToSVG = (
  screenX: number,
  screenY: number,
  svgRef: React.RefObject<SVGSVGElement>,
  zoom: number,
  pan: { x: number; y: number }
): { svgX: number; svgY: number } | null => {
  if (!svgRef.current) return null;

  const svgRect = svgRef.current.getBoundingClientRect();
  const svgX = (screenX - svgRect.left) / (zoom * 1.5) - pan.x;
  const svgY = (screenY - svgRect.top) / (zoom * 1.5) - pan.y;

  return { svgX, svgY };
};

/**
 * Convert SVG coordinates to screen coordinates
 */
export const convertSVGToScreen = (
  svgX: number,
  svgY: number,
  svgRef: React.RefObject<SVGSVGElement>,
  zoom: number,
  pan: { x: number; y: number }
): { screenX: number; screenY: number } | null => {
  if (!svgRef.current) return null;

  const svgRect = svgRef.current.getBoundingClientRect();
  const screenX = (svgX + pan.x) * (zoom * 1.5) + svgRect.left;
  const screenY = (svgY + pan.y) * (zoom * 1.5) + svgRect.top;

  return { screenX, screenY };
};

/**
 * Calculate distance between two points
 */
export const calculateDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Check if element is a node element (for click detection)
 */
export const isNodeElement = (target: Element): boolean => {
  return target.tagName === 'rect' ||
         target.tagName === 'circle' ||
         target.tagName === 'foreignObject' ||
         target.closest('foreignObject') !== null;
};


/**
 * Extract client coordinates from mouse or touch event
 */
export const getClientCoordinates = (
  e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
): { clientX: number; clientY: number } => {
  if ('clientX' in e) {
    return { clientX: e.clientX, clientY: e.clientY };
  } else {
    const touch = e.touches[0] || e.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
};