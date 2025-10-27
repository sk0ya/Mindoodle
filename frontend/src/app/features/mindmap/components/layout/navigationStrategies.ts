import type { MindMapNode } from '@shared/types';
import { getFirstVisibleChild, findNodeBySpatialDirection } from '@mindmap/utils';
import { getSiblingNodes } from '@mindmap/selectors/mindMapSelectors';
import { findClosestChild } from './shortcutHandlerUtils';

export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

export interface NavigationContext {
  currentNodeId: string;
  currentNode: MindMapNode;
  currentRoot: MindMapNode;
  roots: MindMapNode[];
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  toggleNodeCollapse?: (id: string) => void;
}

export type NavigationStrategy = (
  context: NavigationContext,
  count?: number
) => string | null;

/**
 * 左方向のナビゲーション（親ノードへ）
 */
export const navigateLeft: NavigationStrategy = ({ currentNodeId, currentRoot }) => {
  const stack: MindMapNode[] = [currentRoot];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.children?.some(c => c.id === currentNodeId)) {
      return node.id;
    }
    if (node.children) stack.push(...node.children);
  }
  return null;
};

/**
 * 右方向のナビゲーション（子ノードへ）
 */
export const navigateRight: NavigationStrategy = ({
  currentNode,
  currentNodeId,
  updateNode,
  toggleNodeCollapse
}) => {
  const firstChild = getFirstVisibleChild(currentNode);

  if (firstChild) {
    const closest = findClosestChild(currentNode);
    return closest?.id || firstChild.id;
  }

  // 折りたたまれている場合は展開
  if (currentNode.children?.length && currentNode.collapsed) {
    if (toggleNodeCollapse) {
      toggleNodeCollapse(currentNodeId);
    } else {
      updateNode(currentNodeId, { collapsed: false });
    }
    const closest = findClosestChild(currentNode);
    return closest?.id || currentNode.children[0].id;
  }

  return null;
};

/**
 * 上下方向のナビゲーション（兄弟ノード間）
 */
export const navigateVertical: NavigationStrategy = (
  { currentNodeId, currentRoot, roots },
  count = 1
) => {
  const direction = count > 0 ? 'down' : 'up';
  const absCount = Math.abs(count);

  // 兄弟ノード内の移動
  const { siblings, currentIndex } = getSiblingNodes(currentRoot, currentNodeId);
  if (siblings.length > 1 && currentIndex !== -1) {
    const targetIndex = direction === 'down'
      ? Math.min(siblings.length - 1, currentIndex + absCount)
      : Math.max(0, currentIndex - absCount);

    if (targetIndex !== currentIndex) {
      return siblings[targetIndex].id;
    }
  }

  // ルートノード間の移動
  const rootIndex = roots.findIndex(r => r.id === currentRoot.id);
  if (rootIndex !== -1) {
    if (direction === 'down' && rootIndex < roots.length - 1) {
      return roots[rootIndex + 1].id;
    }
    if (direction === 'up' && rootIndex > 0) {
      return roots[rootIndex - 1].id;
    }
  }

  return null;
};

/**
 * ナビゲーションディスパッチャー
 */
export const navigateToDirection = (
  direction: NavigationDirection,
  context: NavigationContext,
  count: number = 1
): string | null => {
  const strategies: Record<NavigationDirection, NavigationStrategy> = {
    left: navigateLeft,
    right: navigateRight,
    up: (ctx) => navigateVertical(ctx, -count),
    down: (ctx) => navigateVertical(ctx, count),
  };

  const nextNodeId = strategies[direction](context, count);

  // フォールバック: 空間的な方向で検索
  return nextNodeId || findNodeBySpatialDirection(
    context.currentNodeId,
    direction,
    context.currentRoot
  );
};
