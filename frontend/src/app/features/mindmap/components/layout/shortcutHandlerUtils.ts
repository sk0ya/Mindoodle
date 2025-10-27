import type { MindMapNode, MindMapData } from '@shared/types';

// Pure utility functions for shortcut handlers

/**
 * 最も近い子ノードを見つける（Y座標ベース）
 */
export const findClosestChild = (parent: MindMapNode): MindMapNode | null => {
  const children = parent.children || [];
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];

  return children.reduce((closest, child) => {
    const closestDist = Math.abs(closest.y - parent.y);
    const childDist = Math.abs(child.y - parent.y);
    return childDist < closestDist ? child : closest;
  });
};

/**
 * ノードのマークダウン行数をカウント
 */
export const countNodeLines = (node: MindMapNode): number => {
  // テーブルノードの特別処理
  if ('kind' in node && (node as { kind: string }).kind === 'table') {
    const textLines = (node.text?.match(/\n/g) || []).length + 1;
    const noteLines = node.note != null
      ? (node.note.match(/\n/g) || []).length + 1
      : 0;
    const childLines = node.children?.reduce((sum, c) => sum + countNodeLines(c), 0) || 0;
    return textLines + noteLines + childLines;
  }

  // 通常ノード
  const textLines = 1;
  const noteLines = node.note != null
    ? (node.note.match(/\n/g) || []).length + 1
    : 0;
  const childLines = node.children?.reduce((sum, c) => sum + countNodeLines(c), 0) || 0;
  return textLines + noteLines + childLines;
};

/**
 * マークダウンコンテンツからノードの行範囲を見つける
 */
export const findNodeLineRange = (
  roots: MindMapNode[],
  targetNodeId: string
): { startLine: number; endLine: number } | null => {
  let result: { startLine: number; endLine: number } | null = null;

  const search = (nodes: MindMapNode[], lineRef: { value: number }): boolean => {
    for (const node of nodes) {
      const nodeStartLine = lineRef.value;

      if (node.id === targetNodeId) {
        const lineCount = countNodeLines(node);
        result = { startLine: nodeStartLine, endLine: nodeStartLine + lineCount - 1 };
        return true;
      }

      // このノードの行をカウント
      if ('kind' in node && (node as { kind: string }).kind === 'table') {
        lineRef.value += (node.text?.match(/\n/g) || []).length + 1;
      } else {
        lineRef.value += 1;
      }

      if (node.note != null) {
        lineRef.value += (node.note.match(/\n/g) || []).length + 1;
      }

      // 子ノードを検索
      if (node.children?.length && search(node.children, lineRef)) {
        return true;
      }
    }
    return false;
  };

  search(roots, { value: 0 });
  return result;
};

/**
 * マップが空かどうか判定
 */
export const isMapEmpty = (map: MindMapData): boolean => {
  try {
    const roots = map?.rootNodes || [];
    if (!Array.isArray(roots) || roots.length === 0) return true;
    return roots.length === 1 && (!roots[0].children || roots[0].children.length === 0);
  } catch {
    return false;
  }
};

/**
 * マップ切り替えの汎用ロジック
 */
type MapOrder = Array<{ mapId: string; workspaceId: string }>;

export const switchMap = (
  direction: 'prev' | 'next',
  order: MapOrder,
  maps: MindMapData[],
  currentId: string | null
): { mapId: string; workspaceId: string } | null => {
  if (!Array.isArray(order) || order.length === 0) return null;

  let idx = order.findIndex((o) => o?.mapId === currentId);
  if (idx < 0) idx = 0;

  const advance = direction === 'next'
    ? (i: number) => (i >= order.length - 1 ? 0 : i + 1)
    : (i: number) => (i <= 0 ? order.length - 1 : i - 1);

  for (let step = 0; step < order.length; step++) {
    idx = advance(idx);
    const candidate = order[idx];
    const mapData = maps.find((m) => m?.mapIdentifier?.mapId === candidate.mapId);

    if (!mapData || !isMapEmpty(mapData)) {
      return candidate;
    }
  }

  return null;
};

/**
 * ノードをマークダウンに変換
 */
export const convertNodeToMarkdown = (node: MindMapNode, level = 0): string => {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  const text = node.text ?? '';
  let md = `${prefix}${text}\n`;
  if (node.note != null) md += `${node.note}\n`;
  if (node.children?.length) {
    md += node.children.map(c => convertNodeToMarkdown(c, level + 1)).join('');
  }
  return md;
};

/**
 * 結果型のラッパー（成功/失敗の統一処理）
 */
export const withNotification = <T extends { success: boolean; reason?: string }>(
  fn: () => T,
  onSuccess: () => void,
  onFailure: (reason?: string) => void
): void => {
  const result = fn();
  if (result.success) {
    onSuccess();
  } else {
    onFailure(result.reason);
  }
};
