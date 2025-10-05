export type CanvasEvent = {
  type: 'click' | 'dblclick' | 'contextmenu' | 'mousemove' | 'mousedown' | 'mouseup' | 'wheel';
  x: number;
  y: number;
  targetNodeId?: string;
};

export interface EventStrategy {
  handle(event: CanvasEvent): void;
}

