import type { MindMapNode } from '@shared/types';

// Find next node by spatial direction relative to current node.
export function findNodeBySpatialDirection(
  currentNodeId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  rootNode: MindMapNode
): string | null {
  const collect = (node: MindMapNode, acc: MindMapNode[]) => {
    acc.push(node);
    if (node.children && !node.collapsed) {
      for (const child of node.children) collect(child, acc);
    }
  };

  const all: MindMapNode[] = [];
  collect(rootNode, all);
  const current = all.find((n) => n.id === currentNodeId);
  if (!current) return null;

  let best: MindMapNode | null = null;
  let bestScore = Infinity;

  for (const node of all) {
    if (node.id === currentNodeId) continue;
    const dx = node.x - current.x;
    const dy = node.y - current.y;

    let ok = false;
    let score = 0;
    switch (direction) {
      case 'right':
        ok = dx > 20;
        score = dx + Math.abs(dy) * 0.5;
        break;
      case 'left':
        ok = dx < -20;
        score = -dx + Math.abs(dy) * 0.5;
        break;
      case 'down':
        ok = dy > 20;
        score = dy + Math.abs(dx) * 0.5;
        break;
      case 'up':
        ok = dy < -20;
        score = -dy + Math.abs(dx) * 0.5;
        break;
    }

    if (ok && score < bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return best?.id ?? null;
}

