// 自動レイアウト機能のユーティリティ
import { cloneDeep } from '@shared/utils';
import { COORDINATES, LAYOUT } from '../../../shared/constants/index';
import { calculateNodeSize, getDynamicNodeSpacing, calculateChildNodeX, getNodeTopY, getNodeBottomY, resolveNodeTextWrapConfig, type NodeTextWrapConfig } from './nodeUtils';
import type { MindMapNode } from '../../../shared/types';

// Layout options interfaces
interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
  globalFontSize?: number;
  wrapConfig?: NodeTextWrapConfig;
  // UI状態に応じた配置（サイドバー重なり回避のために使用）
  sidebarCollapsed?: boolean;
  activeView?: string | null;
}

// Compute a UI-aware default X so the root won't be hidden under the left sidebar
const calculateDynamicCenterX = (
  sidebarCollapsed?: boolean,
  activeView?: string | null
): number => {
  // When a view is active and the sidebar is expanded, reserve its width
  const leftPanelWidth = activeView && !sidebarCollapsed ? LAYOUT.SIDEBAR_WIDTH : 0;
  const margin = 12; // breathing room next to the sidebar edge
  return leftPanelWidth > 0 ? leftPanelWidth + margin : COORDINATES.DEFAULT_CENTER_X;
};

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算（非ルート）
 */
const getChildNodeXFromParentEdge = (
  parentNode: MindMapNode,
  childNode: MindMapNode,
  globalFontSize?: number,
  wrapConfig?: NodeTextWrapConfig
): number => {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize, wrapConfig);
  const childNodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize, wrapConfig);

  // 親ノードの右端から子ノードの左端までの距離を計算
  const edgeToEdgeDistance = getDynamicNodeSpacing(parentNodeSize, childNodeSize, false);
  return calculateChildNodeX(parentNode, childNodeSize, edgeToEdgeDistance, globalFontSize, wrapConfig);
};

// ルート直下を特別扱いしない方針に変更


/**
 * シンプルな右側階層レイアウト - 標準的なマインドマップスタイル
 * 実際のノードサイズを考慮して衝突を回避
 */
export const simpleHierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const uiAwareCenterX = calculateDynamicCenterX(options.sidebarCollapsed, options.activeView);

  const {
    centerX = uiAwareCenterX,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN, // 最小間隔を使用
    globalFontSize,
    wrapConfig: providedWrapConfig
  } = options;

  const effectiveFontSize = globalFontSize ?? 14;
  const wrapConfig = providedWrapConfig ?? resolveNodeTextWrapConfig(undefined, effectiveFontSize);

  const newRootNode = cloneDeep(rootNode);
  // Place root first so children use the final root.x as baseline
  newRootNode.x = centerX;
  newRootNode.y = centerY;

  // サブツリーの実際の高さを計算（折りたたみ状態を考慮）
  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);

    // 折りたたまれているか、子ノードがない場合は自分の高さのみ
    if (node.collapsed || !node.children || node.children.length === 0) {
      return nodeSize.height;
    }

    // 子ノードの合計高さ + 最小限の間隔
    const childrenTotalHeight = node.children.reduce((sum, child, index) => {
      const childHeight = calculateSubtreeActualHeight(child);

      // 前の子ノードとの最小限のスペース計算
      let spacing = 0;
      if (index > 0) {
        // ユーザー設定のノード間隔を使用
        spacing = Math.max(nodeSpacing, 2); // 設定値または最小2px
      }

      return sum + childHeight + spacing;
    }, 0);

    // 現在のノードの高さと子ノード群の高さの最大値（外側マージンなし）
    return Math.max(nodeSize.height, childrenTotalHeight);
  };

  // サブツリーのノード数を計算（レイアウト調整用）
  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeNodeCount(child), 0);
  };

  // 再帰的にノードを配置（折りたたみ状態を考慮した位置保持）
  const positionNode = (node: MindMapNode, parent: MindMapNode | null, depth: number, yOffset: number): void => {
    if (depth === 0) return; // ルートは既に配置済み

    // X座標の計算（ルート直下も含めて全て親基準の同一ロジック）
    if (parent) {
      node.x = getChildNodeXFromParentEdge(parent, node, globalFontSize, wrapConfig);
    } else {
      // フォールバック: 従来の深度ベースの配置
      node.x = centerX + (depth * levelSpacing);
    }
    node.y = centerY + yOffset;

    // 折りたたまれたノードの場合、子ノードの位置は更新しない（現在の位置を保持）
    if (node.collapsed) {
      return;
    }

    if (node.children && node.children.length > 0) {
      // 子ノードの実際の高さを考慮した配置
      const childrenWithHeights = node.children.map(child => ({
        node: child,
        actualHeight: calculateSubtreeActualHeight(child),
        nodeCount: calculateSubtreeNodeCount(child)
      }));
      
      // 全子ノードの合計高さ + 最小限の間隔を計算
      const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
        let spacing = 0;
        if (index > 0) {
          // ユーザー設定のノード間隔を使用
          spacing = Math.max(nodeSpacing, 2); // 設定値または最小2px
        }
        return sum + child.actualHeight + spacing;
      }, 0);
      
      // 子ノードの開始位置を計算（親ノードを中心とする）
      let currentOffset = -totalActualHeight / 2;
      
      childrenWithHeights.forEach((childInfo, index) => {
        // 各子ノードの中心位置を計算
        const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
        
        positionNode(childInfo.node, node, depth + 1, yOffset + childCenterOffset);
        
        // 次の子ノードのためのオフセット更新（最小限の間隔）
        currentOffset += childInfo.actualHeight;
        if (index < childrenWithHeights.length - 1) {
          // ユーザー設定のノード間隔を使用
          const spacing = Math.max(nodeSpacing, 2); // 設定値または最小2px
          currentOffset += spacing;
        }
      });

      // 子ノードの配置が完了した後、この親ノードを子ノード群の中心に再配置
      if (childrenWithHeights.length > 0) {
        // 子ノードのY座標の最小値と最大値を計算
        let minY = Infinity;
        let maxY = -Infinity;

        const calculateNodeBounds = (childNode: MindMapNode) => {
        const nodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize, wrapConfig);
          const nodeTop = getNodeTopY(childNode, nodeSize.height);
          const nodeBottom = getNodeBottomY(childNode, nodeSize.height);

          minY = Math.min(minY, nodeTop);
          maxY = Math.max(maxY, nodeBottom);

          // 折りたたまれていない場合のみ子ノードを再帰的にチェック
          if (childNode.children && !childNode.collapsed) {
            childNode.children.forEach(grandChild => calculateNodeBounds(grandChild));
          }
        };

        node.children.forEach(child => calculateNodeBounds(child));

        // 親ノードを子ノード群の中心に再配置
        const childrenCenterY = (minY + maxY) / 2;
        node.y = childrenCenterY;
      }
    }
  };

  if (!newRootNode.collapsed && newRootNode.children && newRootNode.children.length > 0) {
    // 最初に子ノードを仮配置して、実際の配置範囲を計算
    const childrenWithHeights = newRootNode.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));
    
    // 全子ノードの合計高さ + 最小限の間隔を計算
    const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
      let spacing = 0;
      if (index > 0) {
        // ユーザー設定のノード間隔を使用
        spacing = Math.max(nodeSpacing, 2); // 設定値または最小2px
      }
      return sum + child.actualHeight + spacing;
    }, 0);
    
    // 子ノードを配置
    let currentOffset = -totalActualHeight / 2;
    
    childrenWithHeights.forEach((childInfo, index) => {
      // 各子ノードの中心位置を計算
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
      
      positionNode(childInfo.node, newRootNode, 1, childCenterOffset);
      
      // 次の子ノードのためのオフセット更新（最小限の間隔）
      currentOffset += childInfo.actualHeight;
      if (index < childrenWithHeights.length - 1) {
        // ユーザー設定のノード間隔を使用
        const spacing = Math.max(nodeSpacing, 2); // 設定値または最小2px
        currentOffset += spacing;
      }
    });

    // 子ノードの配置が完了した後、ルートノードを子ノード群の中心に再配置
    if (childrenWithHeights.length > 0) {
      // 子ノードのY座標の最小値と最大値を計算
      let minY = Infinity;
      let maxY = -Infinity;

      const calculateNodeBounds = (node: MindMapNode) => {
        const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize, wrapConfig);
        const nodeTop = getNodeTopY(node, nodeSize.height);
        const nodeBottom = getNodeBottomY(node, nodeSize.height);

        minY = Math.min(minY, nodeTop);
        maxY = Math.max(maxY, nodeBottom);

        // 折りたたまれていない場合のみ子ノードを再帰的にチェック
        if (node.children && !node.collapsed) {
          node.children.forEach(child => calculateNodeBounds(child));
        }
      };

      newRootNode.children.forEach(child => calculateNodeBounds(child));

      // ルートノードを子ノード群の中心に配置
      const childrenCenterY = (minY + maxY) / 2;
      newRootNode.y = childrenCenterY;
    }

  } else {
    // 子ノードがない場合はデフォルト位置（すでに設定済み）
    // newRootNode.x = centerX; newRootNode.y = centerY;
  }

  return newRootNode;
};;;

/**
 * 自動レイアウト選択 - 常にシンプルな右側階層レイアウトを使用
 */
export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return simpleHierarchicalLayout(rootNode, options);
};
