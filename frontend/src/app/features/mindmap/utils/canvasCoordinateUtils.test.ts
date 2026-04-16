import { describe, expect, it } from 'vitest';
import {
  convertScreenToSVG,
  convertSVGToScreen,
  getCanvasScale,
  getCanvasTransform,
  screenDeltaToCanvasPanDelta,
} from './canvasCoordinateUtils';

const createSvgRef = (left: number, top: number): React.RefObject<SVGSVGElement> => ({
  current: {
    getBoundingClientRect: () => ({ left, top }),
  } as SVGSVGElement,
});

describe('canvasCoordinateUtils', () => {
  it('uses a transform order that makes pan operate in canvas units', () => {
    expect(getCanvasTransform(1, { x: 10, y: -4 })).toBe('scale(1.5) translate(10, -4)');
  });

  it('converts between SVG and screen coordinates using the renderer scale', () => {
    const svgRef = createSvgRef(7, 11);
    const zoom = 2;
    const pan = { x: 10, y: -20 };

    const screen = convertSVGToScreen(100, 50, svgRef, zoom, pan);

    expect(screen).toEqual({ screenX: 337, screenY: 101 });
    expect(convertScreenToSVG(screen?.screenX ?? 0, screen?.screenY ?? 0, svgRef, zoom, pan)).toEqual({
      svgX: 100,
      svgY: 50,
    });
  });

  it('converts screen drag deltas to pan deltas with the full canvas scale', () => {
    expect(getCanvasScale(1)).toBe(1.5);
    expect(screenDeltaToCanvasPanDelta(15, 1)).toBe(10);
  });
});
