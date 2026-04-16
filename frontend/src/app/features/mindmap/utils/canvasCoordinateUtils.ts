

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

export const CANVAS_SCALE_MULTIPLIER = 1.5;

export const getCanvasScale = (zoom: number): number => zoom * CANVAS_SCALE_MULTIPLIER;

export const getCanvasTransform = (
  zoom: number,
  pan: { x?: number; y?: number }
): string => `scale(${getCanvasScale(zoom)}) translate(${pan.x ?? 0}, ${pan.y ?? 0})`;

export const screenDeltaToCanvasPanDelta = (delta: number, zoom: number): number =>
  delta / getCanvasScale(zoom);

export const convertScreenToSVG = (
  screenX: number,
  screenY: number,
  svgRef: React.RefObject<SVGSVGElement>,
  zoom: number,
  pan: { x: number; y: number }
): { svgX: number; svgY: number } | null => {
  if (!svgRef.current) return null;

  const svgRect = svgRef.current.getBoundingClientRect();
  const scale = getCanvasScale(zoom);
  const svgX = (screenX - svgRect.left) / scale - pan.x;
  const svgY = (screenY - svgRect.top) / scale - pan.y;

  return { svgX, svgY };
};


export const convertSVGToScreen = (
  svgX: number,
  svgY: number,
  svgRef: React.RefObject<SVGSVGElement>,
  zoom: number,
  pan: { x: number; y: number }
): { screenX: number; screenY: number } | null => {
  if (!svgRef.current) return null;

  const svgRect = svgRef.current.getBoundingClientRect();
  const scale = getCanvasScale(zoom);
  const screenX = (svgX + pan.x) * scale + svgRect.left;
  const screenY = (svgY + pan.y) * scale + svgRect.top;

  return { screenX, screenY };
};


export const calculateDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};


export const isNodeElement = (target: Element): boolean => {
  return target.tagName === 'rect' ||
         target.tagName === 'circle' ||
         target.tagName === 'foreignObject' ||
         target.closest('foreignObject') !== null;
};



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
