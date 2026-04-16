import type { Position } from '@shared/types';

type NodePosition = {
  x?: number;
  y?: number;
};

export const calculateStableNodePan = (
  currentPan: Position,
  before: NodePosition,
  after: NodePosition
): Position => ({
  // Pan is in map units. Move it opposite to the layout delta so the anchor's
  // screen position stays unchanged after auto-layout.
  x: currentPan.x + ((before.x ?? 0) - (after.x ?? 0)),
  y: currentPan.y + ((before.y ?? 0) - (after.y ?? 0)),
});
