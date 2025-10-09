/**
 * ノード操作ユーティリティ統合ファイル
 *
 * ノードツリー操作、空間的ナビゲーション、バリデーションを統合
 */

import type { MindMapNode, MindMapData } from '@shared/types';

// ========================================
// ノードツリー操作 (from nodeTreeUtils.ts)
// ========================================

/**
 * IDによるノード検索
 */
export function findNodeById(rootNode: MindMapNode, nodeId: string): MindMapNode | null {
  if (rootNode.id === nodeId) return rootNode;

  for (const child of rootNode.children || []) {
    const result = findNodeById(child, nodeId);
    if (result) return result;
  }

  return null;
}

/**
 * IDによるノードパス検索
 */
export function findNodePathById(rootNode: MindMapNode, nodeId: string): MindMapNode[] | null {
  if (rootNode.id === nodeId) return [rootNode];

  for (const child of rootNode.children || []) {
    const childPath = findNodePathById(child, nodeId);
    if (childPath) return [rootNode, ...childPath];
  }

  return null;
}

/**
 * ノードツリーの走査
 */
export function traverseNodes(rootNode: MindMapNode, callback: (node: MindMapNode) => void): void {
  callback(rootNode);

  for (const child of rootNode.children || []) {
    traverseNodes(child, callback);
  }
}

/**
 * ノードツリー内のノードを更新
 */
export function updateNodeInTree(
  rootNode: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode {
  if (rootNode.id === nodeId) {
    return updater(rootNode);
  }

  return {
    ...rootNode,
    children: rootNode.children?.map(child =>
      updateNodeInTree(child, nodeId, updater)
    )
  };
}

/**
 * ノードツリーからノードを削除
 */
export function removeNodeFromTree(rootNode: MindMapNode, nodeId: string): MindMapNode {
  return {
    ...rootNode,
    children: rootNode.children?.filter(child => child.id !== nodeId)
      .map(child => removeNodeFromTree(child, nodeId))
  };
}

/**
 * 親ノードを検索
 */
export function findParentNode(rootNode: MindMapNode, nodeId: string): MindMapNode | null {
  if (!rootNode.children) return null;

  for (const child of rootNode.children) {
    if (child.id === nodeId) return rootNode;
    const parent = findParentNode(child, nodeId);
    if (parent) return parent;
  }

  return null;
}

/**
 * 兄弟ノードを取得
 */
export function getSiblingNodes(rootNode: MindMapNode, nodeId: string): { siblings: MindMapNode[], currentIndex: number } {
  const parent = findParentNode(rootNode, nodeId);
  if (!parent || !parent.children) {
    return { siblings: [], currentIndex: -1 };
  }

  const siblings = parent.children;
  const currentIndex = siblings.findIndex(node => node.id === nodeId);

  return { siblings, currentIndex };
}

/**
 * 最初の表示可能な子ノードを取得
 */
export function getFirstVisibleChild(node: MindMapNode): MindMapNode | null {
  if (!node.children || node.children.length === 0 || node.collapsed) {
    return null;
  }

  return node.children[0];
}

/**
 * ノードがルートノード（親がいない）かどうかを判定
 */
export function isRootNode(rootNode: MindMapNode, nodeId: string): boolean {
  if (rootNode.id === nodeId) return true;
  return findParentNode(rootNode, nodeId) === null;
}

/**
 * 複数のルートノードからノードを検索
 */
export function findNodeInRoots(roots: MindMapNode[] | undefined, nodeId: string): MindMapNode | null {
  const list = roots || [];
  for (const r of list) {
    const found = findNodeById(r, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * データオブジェクトからノードを検索
 */
export function findNodeInData(data: { rootNodes?: MindMapNode[] } | MindMapData | null | undefined, nodeId: string): MindMapNode | null {
  if (!data) return null;
  return findNodeInRoots((data as any).rootNodes, nodeId);
}

// ========================================
// 空間的ナビゲーション (from shared/utils/navigation.ts)
// ========================================

/**
 * 空間的方向によるノード検索
 * 現在のノードから指定した方向で最も近いノードを見つける
 */
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

// ========================================
// ノードバリデーション (from shared/utils/validation.ts)
// ========================================

/**
 * データバリデーション結果型
 */
export interface NodeValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MindMapNodeの詳細バリデーション
 */
export function validateMindMapNode(node: unknown): NodeValidationResult {
  const errors: string[] = [];

  if (!node || typeof node !== 'object') {
    errors.push('Node must be an object');
    return { isValid: false, errors };
  }

  const obj = node as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('Missing or invalid node id');
  }

  if (typeof obj.text !== 'string') {
    errors.push('Missing or invalid node text');
  }

  if (typeof obj.x !== 'number' || isNaN(obj.x)) {
    errors.push('Missing or invalid node x coordinate');
  }

  if (typeof obj.y !== 'number' || isNaN(obj.y)) {
    errors.push('Missing or invalid node y coordinate');
  }

  // 子ノードのバリデーション
  if (!Array.isArray(obj.children)) {
    errors.push('Node children must be an array');
  } else {
    obj.children.forEach((child, index) => {
      const childValidation = validateMindMapNode(child);
      if (!childValidation.isValid) {
        errors.push(`Invalid child node at index ${index}: ${childValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ノードが有効かどうかを簡易チェック
 */
export function isMindMapNode(node: unknown): node is MindMapNode {
  if (!node || typeof node !== 'object') return false;

  const obj = node as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    Array.isArray(obj.children) &&
    obj.children.every((child: unknown) => isMindMapNode(child))
  );
}
