// 自動レイアウト機能のユーティリティ
import { cloneDeep } from './lodash-utils';
import { COORDINATES, LAYOUT } from '../constants/index';
import { calculateNodeSize, getDynamicNodeSpacing, calculateChildNodeX } from './nodeUtils';
import type { MindMapNode } from '../types';

// Layout options interfaces
interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
  globalFontSize?: number;
}

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算（非ルート）
 */
const getChildNodeXFromParentEdge = (parentNode: MindMapNode, childNode: MindMapNode, globalFontSize?: number): number => {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize);
  const childNodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize);
  
  // 親ノードの右端から子ノードの左端までの距離を計算
  const edgeToEdgeDistance = getDynamicNodeSpacing(parentNodeSize, childNodeSize, false);
  return calculateChildNodeX(parentNode, childNodeSize, edgeToEdgeDistance);
};

/**
 * ルートノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算
 */
const getChildNodeXFromRootEdge = (rootNode: MindMapNode, childNode: MindMapNode, globalFontSize?: number): number => {
  const rootNodeSize = calculateNodeSize(rootNode, undefined, false, globalFontSize);
  const childNodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize);
  
  // ルートノードの右端から子ノードの左端までの距離を計算
  const edgeToEdgeDistance = getDynamicNodeSpacing(rootNodeSize, childNodeSize, true);
  return calculateChildNodeX(rootNode, childNodeSize, edgeToEdgeDistance);
};


/**
 * シンプルな右側階層レイアウト - 標準的なマインドマップスタイル
 * 実際のノードサイズを考慮して衝突を回避
 */
export const simpleHierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN, // 最小間隔を使用
    globalFontSize
  } = options;

  const newRootNode = cloneDeep(rootNode);

  // サブツリーの実際の高さを計算（画像サイズを考慮した適応的間隔）
  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize);
      return nodeSize.height;
    }
    
    // 子ノードの合計高さ + 最小限の間隔
    const childrenTotalHeight = node.children.reduce((sum, child, index) => {
      const childHeight = calculateSubtreeActualHeight(child);

      // 前の子ノードとの最小限のスペース計算
      let spacing = 0;
      if (index > 0) {
        // 密なレイアウトのため、最小間隔のみを使用
        spacing = Math.max(nodeSpacing * 0.5, 2); // 基本間隔の半分、最小2px
      }

      return sum + childHeight + spacing;
    }, 0);
    
    // 現在のノードの高さと子ノード群の高さの最大値
    const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize);
    return Math.max(nodeSize.height, childrenTotalHeight);
  };

  // サブツリーのノード数を計算（レイアウト調整用）
  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeNodeCount(child), 0);
  };

  // 再帰的にノードを配置
  const positionNode = (node: MindMapNode, parent: MindMapNode | null, depth: number, yOffset: number): void => {
    if (depth === 0) return; // ルートは既に配置済み
    
    // X座標の計算
    if (parent) {
      if (depth === 1) {
        // ルートノードの直接の子要素: ルートノードの右端から子ノードの左端まで
        node.x = getChildNodeXFromRootEdge(newRootNode, node, globalFontSize);
      } else {
        // それ以外: 親ノードの右端から子ノードの左端まで
        node.x = getChildNodeXFromParentEdge(parent, node, globalFontSize);
      }
    } else {
      // フォールバック: 従来の深度ベースの配置
      node.x = centerX + (depth * levelSpacing);
    }
    node.y = centerY + yOffset;
    
    if (!node.collapsed && node.children && node.children.length > 0) {
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
          // 密なレイアウトのため、最小間隔のみを使用
          spacing = Math.max(nodeSpacing * 0.5, 2); // 基本間隔の半分、最小2px
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
          // 密なレイアウトのため、基本間隔の半分を使用
          let spacing = Math.max(nodeSpacing * 0.5, 2); // 基本間隔の半分、最小2px
          currentOffset += spacing;
        }
      });

      // 子ノードの配置が完了した後、この親ノードを子ノード群の中心に再配置
      if (childrenWithHeights.length > 0) {
        // 子ノードのY座標の最小値と最大値を計算
        let minY = Infinity;
        let maxY = -Infinity;

        const calculateNodeBounds = (childNode: MindMapNode) => {
          const nodeSize = calculateNodeSize(childNode, undefined, false, globalFontSize);
          const nodeTop = childNode.y - nodeSize.height / 2;
          const nodeBottom = childNode.y + nodeSize.height / 2;
          
          minY = Math.min(minY, nodeTop);
          maxY = Math.max(maxY, nodeBottom);

          // 子ノードも再帰的にチェック
          if (childNode.children) {
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
        // 密なレイアウトのため、最小間隔のみを使用
        spacing = Math.max(nodeSpacing * 0.5, 2); // 基本間隔の半分、最小2px
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
        // 密なレイアウトのため、基本間隔の半分を使用
        let spacing = Math.max(nodeSpacing * 0.5, 2); // 基本間隔の半分、最小2px
        currentOffset += spacing;
      }
    });

    // 子ノードの配置が完了した後、ルートノードを子ノード群の中心に再配置
    if (childrenWithHeights.length > 0) {
      // 子ノードのY座標の最小値と最大値を計算
      let minY = Infinity;
      let maxY = -Infinity;

      const calculateNodeBounds = (node: MindMapNode) => {
        const nodeSize = calculateNodeSize(node, undefined, false, globalFontSize);
        const nodeTop = node.y - nodeSize.height / 2;
        const nodeBottom = node.y + nodeSize.height / 2;
        
        minY = Math.min(minY, nodeTop);
        maxY = Math.max(maxY, nodeBottom);

        // 子ノードも再帰的にチェック
        if (node.children) {
          node.children.forEach(child => calculateNodeBounds(child));
        }
      };

      newRootNode.children.forEach(child => calculateNodeBounds(child));

      // ルートノードを子ノード群の中心に配置
      const childrenCenterY = (minY + maxY) / 2;
      newRootNode.y = childrenCenterY;
    }
  } else {
    // 子ノードがない場合はデフォルト位置
    newRootNode.x = centerX;
    newRootNode.y = centerY;
  }

  return newRootNode;
};;;

/**
 * 自動レイアウト選択 - 常にシンプルな右側階層レイアウトを使用
 */
export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return simpleHierarchicalLayout(rootNode, options);
};

