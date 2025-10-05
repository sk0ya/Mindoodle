export type CanvasEvent = {
  type:
    | 'click'
    | 'dblclick'
    | 'contextmenu'
    | 'mousemove'
    | 'mousedown'
    | 'mouseup'
    | 'wheel'
    | 'bgclick'
    | 'nodeClick'
    | 'nodeDoubleClick'
    | 'nodeContextMenu'
    | 'nodeDragStart'
    | 'nodeDragMove'
    | 'nodeDragEnd';
  x: number;
  y: number;
  targetNodeId?: string;
};

export interface EventStrategy {
  handle(event: CanvasEvent): void;
}
