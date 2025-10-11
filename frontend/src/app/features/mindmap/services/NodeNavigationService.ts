import type { MindMapNode } from '@shared/types';
import { findNodeById, getFirstVisibleChild, getSiblingNodes, findNodeBySpatialDirection } from '@mindmap/utils';

export function getNextNodeId(direction: 'up'|'down'|'left'|'right', selectedNodeId: string, roots: MindMapNode[]): string | null {
  const currentRoot = roots.find(r => !!findNodeById(r, selectedNodeId)) || roots[0];
  if (!currentRoot) return null;
  const currentNode = findNodeById(currentRoot, selectedNodeId);
  if (!currentNode) return null;

  let nextNodeId: string | null = null;
  switch (direction) {
    case 'left': {
      const stack: MindMapNode[] = currentRoot ? [currentRoot] : [];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        if (node.children?.some(c => c.id === selectedNodeId)) { nextNodeId = node.id; break; }
        if (node.children) stack.push(...node.children);
      }
      break;
    }
    case 'right': {
      const firstChild = getFirstVisibleChild(currentNode);
      if (firstChild) {
        const children = currentNode.children || [];
        if (children.length > 1) {
          let closestChild = children[0];
          let minDistance = Math.abs(children[0].y - currentNode.y);
          for (let i = 1; i < children.length; i++) {
            const distance = Math.abs(children[i].y - currentNode.y);
            if (distance < minDistance) { minDistance = distance; closestChild = children[i]; }
          }
          nextNodeId = closestChild.id;
        } else {
          nextNodeId = children[0].id;
        }
      }
      break;
    }
    case 'up':
    case 'down': {
      const { siblings, currentIndex } = getSiblingNodes(currentRoot, selectedNodeId);
      if (siblings.length > 1 && currentIndex !== -1) {
        let targetIndex = -1;
        if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
        else if (direction === 'down' && currentIndex < siblings.length - 1) targetIndex = currentIndex + 1;
        if (targetIndex !== -1) nextNodeId = siblings[targetIndex].id;
      }
      if (!nextNodeId) {
        const rootIndex = roots.findIndex(r => r.id === currentRoot.id);
        if (rootIndex !== -1) {
          if (direction === 'down' && rootIndex < roots.length - 1) nextNodeId = roots[rootIndex + 1].id;
          else if (direction === 'up' && rootIndex > 0) nextNodeId = roots[rootIndex - 1].id;
        }
      }
      break;
    }
  }
  if (!nextNodeId) nextNodeId = findNodeBySpatialDirection(selectedNodeId, direction, currentRoot);
  return nextNodeId;
}

export function findParent(roots: MindMapNode[], nodeId: string): MindMapNode | null {
  for (const root of roots) {
    const parent = (function find(node: MindMapNode, target: string, parent: MindMapNode | null): MindMapNode | null {
      if (node.id === target) return parent;
      for (const c of node.children || []) {
        const p = find(c, target, node);
        if (p) return p;
      }
      return null;
    })(root, nodeId, null);
    if (parent) return parent;
  }
  return null;
}
