import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';

// 正規化されたデータ構造
export interface NormalizedData {
  nodes: Record<string, MindMapNode>;
  rootNodeIds: string[]; // Changed from single rootNodeId to array of rootNodeIds
  parentMap: Record<string, string>; // child -> parent
  childrenMap: Record<string, string[]>; // parent -> children
}

export interface NormalizedMindMapData {
  nodes: Record<string, MindMapNode>;
  rootNodeIds: string[]; // Changed from single rootNodeId to array of rootNodeIds
  parentMap: Record<string, string>; // child -> parent
  childrenMap: Record<string, string[]>; // parent -> children
}

/**
 * 従来の階層構造を正規化構造に変換
 */
export function normalizeTreeData(rootNodes: MindMapNode[] | undefined): NormalizedData {
  // 防御的プログラミング: rootNodesが無効な場合は空の構造を返す
  if (!Array.isArray(rootNodes) || rootNodes.length === 0) {
    return {
      nodes: {},
      rootNodeIds: [],
      parentMap: {},
      childrenMap: {}
    };
  }

  const nodes: Record<string, MindMapNode> = {};
  const parentMap: Record<string, string> = {};
  const childrenMap: Record<string, string[]> = {};

  function traverse(node: MindMapNode, parentId?: string) {
    // ノードを格納（childrenプロパティを除去）
    const { children, ...nodeWithoutChildren } = node;
    nodes[node.id] = { ...nodeWithoutChildren, children: [] };

    // 親子関係を記録
    if (parentId) {
      parentMap[node.id] = parentId;
    }

    // 子供のIDリストを記録
    const childIds = (children || []).map(child => child.id);
    childrenMap[node.id] = childIds;

    // 子ノードを再帰的に処理
    (children || []).forEach(child => {
      traverse(child, node.id);
    });
  }

  // 複数のルートノードを処理
  rootNodes.forEach(rootNode => {
    traverse(rootNode);
  });

  return {
    nodes,
    rootNodeIds: rootNodes.map(node => node.id),
    parentMap,
    childrenMap: {
      ...childrenMap,
      // 便宜上の仮想ルートを用意して、ルート一覧を保持しておく
      // これにより、削除や選択のフォールバックが簡単になる
      ['root']: rootNodes.map(node => node.id)
    }
  };
}

/**
 * 正規化構造から階層構造を復元
 */
export function denormalizeTreeData(normalizedData: NormalizedData): MindMapNode[] {
  const { nodes, rootNodeIds, childrenMap } = normalizedData;

  function buildTree(nodeId: string): MindMapNode {
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const childIds = childrenMap[nodeId] || [];
    const children = childIds.map(childId => buildTree(childId));

    return {
      ...node,
      children
    };
  }

  return rootNodeIds.map(rootNodeId => buildTree(rootNodeId));
}

/**
 * 正規化されたデータでのノード検索 - O(1)
 */
export function findNormalizedNode(
  normalizedData: NormalizedData, 
  nodeId: string
): MindMapNode | null {
  return normalizedData.nodes[nodeId] || null;
}

/**
 * 正規化されたデータでのノード更新 - O(1)
 */
export function updateNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string,
  updates: Partial<MindMapNode>
): NormalizedData {
  const existingNode = normalizedData.nodes[nodeId];
  if (!existingNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [nodeId]: { ...existingNode, ...updates }
    }
  };
}

/**
 * 正規化されたデータでのノード削除 - O(1)
 */
export function deleteNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string
): NormalizedData {
  const isRoot = normalizedData.rootNodeIds.includes(nodeId);
  let parentId = normalizedData.parentMap[nodeId];
  if (isRoot) {
    // ルートノードは親がいないので、仮想親 'root' を使う
    if (normalizedData.rootNodeIds.length <= 1) {
      throw new Error('Cannot delete the last root node');
    }
    parentId = 'root';
  } else if (!parentId) {
    throw new Error(`Parent not found for node: ${nodeId}`);
  }

  // 削除対象ノードとその子孫を特定
  const nodesToDelete = new Set<string>();
  
  function collectDescendants(id: string) {
    nodesToDelete.add(id);
    const children = normalizedData.childrenMap[id] || [];
    children.forEach(childId => collectDescendants(childId));
  }
  
  collectDescendants(nodeId);

  // 新しい構造を作成
  const newNodes = { ...normalizedData.nodes };
  const newParentMap = { ...normalizedData.parentMap };
  const newChildrenMap = { ...normalizedData.childrenMap };

  // 削除対象ノードを除去
  nodesToDelete.forEach(id => {
    delete newNodes[id];
    delete newParentMap[id];
    delete newChildrenMap[id];
  });

  // 親の子リストから削除（仮想親 'root' を含む）
  const parentChildren = newChildrenMap[parentId] || [];
  newChildrenMap[parentId] = parentChildren.filter(id => id !== nodeId);

  // ルート配列からも削除
  const newRootIds = isRoot
    ? normalizedData.rootNodeIds.filter(id => id !== nodeId)
    : normalizedData.rootNodeIds;

  return {
    ...normalizedData,
    nodes: newNodes,
    parentMap: newParentMap,
    childrenMap: newChildrenMap,
    rootNodeIds: newRootIds
  };
}

/**
 * 正規化されたデータでのノード追加 - O(1)
 */
export function addNormalizedNode(
  normalizedData: NormalizedData,
  parentId: string,
  newNode: MindMapNode
): NormalizedData {
  if (normalizedData.nodes[newNode.id]) {
    throw new Error(`Node already exists: ${newNode.id}`);
  }

  if (!normalizedData.nodes[parentId]) {
    throw new Error(`Parent node not found: ${parentId}`);
  }

  // Disallow adding children to table nodes (table renders as a single node)
  const parentNode = normalizedData.nodes[parentId];
  if ((parentNode as any)?.kind === 'table') {
    throw new Error('テーブルノードには子ノードを追加できません');
  }

  const { children, ...nodeWithoutChildren } = newNode;
  // childrenは使用しないがdestructuringで除外する必要がある
  void children;

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [newNode.id]: { ...nodeWithoutChildren, children: [] }
    },
    parentMap: {
      ...normalizedData.parentMap,
      [newNode.id]: parentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [parentId]: [...(normalizedData.childrenMap[parentId] || []), newNode.id],
      [newNode.id]: []
    }
  };
}

/**
 * ノード移動の制約をチェックする
 */
function validateNodeMovement(
  normalizedData: NormalizedData,
  nodeId: string,
  newParentId: string
): { isValid: boolean; reason?: string } {
  const node = normalizedData.nodes[nodeId];
  const newParent = normalizedData.nodes[newParentId];

  if (!node || !newParent) {
    return { isValid: false, reason: 'ノードが見つかりません' };
  }

  const nodeType = node.markdownMeta?.type;
  const parentType = newParent.markdownMeta?.type;

  // 1. リストノードは見出しノードを子ノードにできない
  if ((nodeType === 'heading') &&
      (parentType === 'unordered-list' || parentType === 'ordered-list')) {
    return {
      isValid: false,
      reason: 'リストノードは見出しノードを子ノードにできません'
    };
  }

  // 2. 見出しノードの階層制限（6階層まで）
  if (nodeType === 'heading') {
    const parentLevel = parentType === 'heading' ? (newParent.markdownMeta?.level || 1) : 0;

    if (parentType === 'heading' && parentLevel + 1 > 6) {
      return {
        isValid: false,
        reason: '見出しノードは6階層までです'
      };
    }
  }

  // 3. 見出しノードの兄弟がいる場合、リストノードは一番兄としてでしか子ノードになれない
  // 注意: この制約は「リストが見出しより後に配置されること」を禁止するが、
  // 「リストが見出しより前に配置されること」は許可する
  // つまり、基本的な移動は許可し、位置指定時にのみ制限をかける
  // ここでは基本的な移動の可否のみをチェックし、位置制約は別途処理

  return { isValid: true };
}

/**
 * ポジション指定での移動制約をチェックする
 */
function validateNodeMovementWithPosition(
  normalizedData: NormalizedData,
  nodeId: string,
  targetNodeId: string,
  position: 'before' | 'after' | 'child'
): { isValid: boolean; reason?: string } {
  const node = normalizedData.nodes[nodeId];
  const target = normalizedData.nodes[targetNodeId];

  if (!node || !target) {
    return { isValid: false, reason: 'ノードが見つかりません' };
  }

  if (position === 'child') {
    // child の場合は通常の移動制約チェック + 位置制約
    const basicValidation = validateNodeMovement(normalizedData, nodeId, targetNodeId);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // 制約3: リストノードが見出しノードの子になる場合の位置制約
    const nodeType = node.markdownMeta?.type;
    const parentType = target.markdownMeta?.type;

    if ((nodeType === 'unordered-list' || nodeType === 'ordered-list') &&
        parentType === 'heading') {
      const siblings = normalizedData.childrenMap[targetNodeId] || [];
      const hasHeadingSiblings = siblings.some(siblingId => {
        const sibling = normalizedData.nodes[siblingId];
        return sibling?.markdownMeta?.type === 'heading';
      });

      if (hasHeadingSiblings) {
        // 見出しの兄弟がいる場合、リストは一番最初に配置される
        // child位置での追加は最後に追加されるので、見出しがいる場合は禁止
        return {
          isValid: false,
          reason: '見出しノードの兄弟がいる場合、リストノードは一番最初にのみ配置できます'
        };
      }
    }

    return { isValid: true };
  }

  // before/after の場合は兄弟として配置されるので、その親に対してチェック
  const targetParentId = normalizedData.parentMap[targetNodeId];
  if (!targetParentId) {
    return { isValid: false, reason: 'ターゲットノードに親がありません' };
  }

  // 基本的な制約チェック
  const validationResult = validateNodeMovement(normalizedData, nodeId, targetParentId);
  if (!validationResult.isValid) {
    return validationResult;
  }

  // 制約3: リストノードが見出しノードの子になる場合の位置制約
  const nodeType = node.markdownMeta?.type;
  const targetParent = normalizedData.nodes[targetParentId];
  const parentType = targetParent?.markdownMeta?.type;

  if ((nodeType === 'unordered-list' || nodeType === 'ordered-list') &&
      parentType === 'heading') {
    const siblings = normalizedData.childrenMap[targetParentId] || [];
    const targetIndex = siblings.indexOf(targetNodeId);
    const hasHeadingSiblings = siblings.some(siblingId => {
      const sibling = normalizedData.nodes[siblingId];
      return sibling?.markdownMeta?.type === 'heading';
    });

    if (hasHeadingSiblings) {
      // リストは見出しより前（一番最初）にのみ配置可能
      if (position === 'before') {
        // targetの前に配置する場合、targetが最初の見出しでないと駄目
        const firstHeading = siblings.find(siblingId => {
          const sibling = normalizedData.nodes[siblingId];
          return sibling?.markdownMeta?.type === 'heading';
        });
        if (targetNodeId !== firstHeading) {
          return {
            isValid: false,
            reason: '見出しノードの兄弟がいる場合、リストノードは一番最初にのみ配置できます'
          };
        }
      }
      
      if (position === 'after') {
        // targetの後に配置する場合、targetより後に見出しがあると禁止
        const afterTargetSiblings = siblings.slice(targetIndex + 1);
        const hasHeadingAfterTarget = afterTargetSiblings.some(siblingId => {
          const sibling = normalizedData.nodes[siblingId];
          return sibling?.markdownMeta?.type === 'heading';
        });
        
        if (hasHeadingAfterTarget) {
          return {
            isValid: false,
            reason: '見出しノードの兄弟がいる場合、リストノードは一番最初にのみ配置できます'
          };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * 正規化されたデータでのノード移動 - O(1)
 */
export function moveNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string,
  newParentId: string
): { success: true; data: NormalizedData } | { success: false; reason: string } {
  if (normalizedData.rootNodeIds.includes(nodeId)) {
    return { success: false, reason: 'ルートノードは移動できません' };
  }

  const oldParentId = normalizedData.parentMap[nodeId];
  if (!oldParentId) {
    return { success: false, reason: `ノードの親が見つかりません: ${nodeId}` };
  }

  if (!normalizedData.nodes[newParentId]) {
    return { success: false, reason: `移動先のノードが見つかりません: ${newParentId}` };
  }

  // Disallow moving under a table node
  const targetParent = normalizedData.nodes[newParentId];
  if ((targetParent as any)?.kind === 'table') {
    return { success: false, reason: 'テーブルノードには子ノードを追加できません' };
  }

  // ノードの種類制約チェック
  const validation = validateNodeMovement(normalizedData, nodeId, newParentId);
  if (!validation.isValid) {
    return { success: false, reason: validation.reason || 'ノードの移動ができません' };
  }

  // 循環参照チェック: newParentId が nodeId の子孫でないかチェック
  function isDescendant(parentId: string, childId: string): boolean {
    const children = normalizedData.childrenMap[parentId] || [];
    return children.includes(childId) ||
           children.some(child => isDescendant(child, childId));
  }

  if (isDescendant(nodeId, newParentId)) {
    return { success: false, reason: '親ノードを子ノードの下に移動することはできません' };
  }

  // 同じ親内での移動の場合は何もしない
  if (oldParentId === newParentId) {
    return { success: true, data: normalizedData };
  }

  const newData = {
    ...normalizedData,
    parentMap: {
      ...normalizedData.parentMap,
      [nodeId]: newParentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [oldParentId]: normalizedData.childrenMap[oldParentId].filter(id => id !== nodeId),
      [newParentId]: [...(normalizedData.childrenMap[newParentId] || []), nodeId]
    }
  };

  return { success: true, data: newData };
}

/**
 * 位置指定付きでノードの親を変更
 */
export function moveNodeWithPositionNormalized(
  normalizedData: NormalizedData,
  nodeId: string,
  targetNodeId: string,
  position: 'before' | 'after' | 'child'
): { success: true; data: NormalizedData } | { success: false; reason: string } {
  if (normalizedData.rootNodeIds.includes(nodeId)) {
    return { success: false, reason: 'ルートノードは移動できません' };
  }

  const oldParentId = normalizedData.parentMap[nodeId];
  if (!oldParentId) {
    return { success: false, reason: `ノードの親が見つかりません: ${nodeId}` };
  }

  if (!normalizedData.nodes[targetNodeId]) {
    return { success: false, reason: `ターゲットノードが見つかりません: ${targetNodeId}` };
  }

  // If moving as child, disallow child under a table node
  if (position === 'child') {
    const targetNode = normalizedData.nodes[targetNodeId];
    if ((targetNode as any)?.kind === 'table') {
      return { success: false, reason: 'テーブルノードには子ノードを追加できません' };
    }
  }

  // ノードの種類制約チェック
  const validation = validateNodeMovementWithPosition(normalizedData, nodeId, targetNodeId, position);
  if (!validation.isValid) {
    return { success: false, reason: validation.reason || 'ノードの移動ができません' };
  }

  let newParentId: string;
  let insertionIndex: number;

  if (position === 'child') {
    // 子として追加
    newParentId = targetNodeId;
    insertionIndex = (normalizedData.childrenMap[newParentId] || []).length;
  } else {
    // 兄弟として追加（before/after）
    newParentId = normalizedData.parentMap[targetNodeId];
    if (!newParentId) {
      return { success: false, reason: `ターゲットノードに親がありません: ${targetNodeId}` };
    }

    const siblings = normalizedData.childrenMap[newParentId] || [];
    const targetIndex = siblings.indexOf(targetNodeId);
    if (targetIndex === -1) {
      return { success: false, reason: `ターゲットノードが親の子リストに見つかりません: ${targetNodeId}` };
    }

    insertionIndex = position === 'before' ? targetIndex : targetIndex + 1;
  }

  // 循環参照チェック: newParentId が nodeId の子孫でないかチェック
  function isDescendant(parentId: string, childId: string): boolean {
    const children = normalizedData.childrenMap[parentId] || [];
    return children.includes(childId) ||
           children.some(child => isDescendant(child, childId));
  }

  if (isDescendant(nodeId, newParentId)) {
    return { success: false, reason: '親ノードを子ノードの下に移動することはできません' };
  }

  // 古い親から削除
  const oldSiblings = normalizedData.childrenMap[oldParentId] || [];
  const newOldSiblings = oldSiblings.filter(id => id !== nodeId);

  // 新しい親に追加
  const newSiblings = [...(normalizedData.childrenMap[newParentId] || [])];

  // 同じ親内での移動の場合は調整が必要
  if (oldParentId === newParentId) {
    const currentIndex = newSiblings.indexOf(nodeId);
    if (currentIndex !== -1) {
      newSiblings.splice(currentIndex, 1);
      if (insertionIndex > currentIndex) {
        insertionIndex--;
      }
    }
  }

  newSiblings.splice(insertionIndex, 0, nodeId);

  const newData = {
    ...normalizedData,
    parentMap: {
      ...normalizedData.parentMap,
      [nodeId]: newParentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [oldParentId]: newOldSiblings,
      [newParentId]: newSiblings
    }
  };

  return { success: true, data: newData };
}

/**
 * 正規化されたデータで兄弟ノードを追加 - O(1)
 */
export function addSiblingNormalizedNode(
  normalizedData: NormalizedData,
  siblingNodeId: string,
  newNode: MindMapNode,
  insertAfter: boolean = true
): NormalizedData {
  const parentId = normalizedData.parentMap[siblingNodeId];
  if (!parentId) {
    throw new Error(`Parent not found for sibling node: ${siblingNodeId}`);
  }

  if (normalizedData.nodes[newNode.id]) {
    throw new Error(`Node already exists: ${newNode.id}`);
  }

  const { children, ...nodeWithoutChildren } = newNode;
  void children; // childrenは使用しないがdestructuringで除外する必要がある

  const siblings = normalizedData.childrenMap[parentId] || [];
  const siblingIndex = siblings.indexOf(siblingNodeId);
  
  if (siblingIndex === -1) {
    throw new Error(`Sibling node not found in parent's children: ${siblingNodeId}`);
  }

  // 兄弟ノードの後に挿入
  const insertionIndex = insertAfter ? siblingIndex + 1 : siblingIndex;
  const newSiblings = [...siblings];
  newSiblings.splice(insertionIndex, 0, newNode.id);

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [newNode.id]: { ...nodeWithoutChildren, children: [] }
    },
    parentMap: {
      ...normalizedData.parentMap,
      [newNode.id]: parentId
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [parentId]: newSiblings,
      [newNode.id]: []
    }
  };
}

// ルートノードの兄弟ノードを追加する関数（複数ルートノード対応）
export function addRootSiblingNode(
  normalizedData: NormalizedData,
  siblingRootNodeId: string,
  newNode: MindMapNode,
  insertAfter: boolean = true
): NormalizedData {
  if (normalizedData.nodes[newNode.id]) {
    throw new Error(`Node already exists: ${newNode.id}`);
  }

  const { children, ...nodeWithoutChildren } = newNode;
  void children; // childrenは使用しないがdestructuringで除外する必要がある

  // 新しいルートノードIDリストを作成
  const currentRootIds = normalizedData.rootNodeIds;
  const siblingIndex = currentRootIds.indexOf(siblingRootNodeId);
  
  if (siblingIndex === -1) {
    throw new Error(`Root sibling node not found: ${siblingRootNodeId}`);
  }

  // ルートノードリストに新しいノードを追加
  const insertionIndex = insertAfter ? siblingIndex + 1 : siblingIndex;
  const newRootIds = [...currentRootIds];
  newRootIds.splice(insertionIndex, 0, newNode.id);

  return {
    ...normalizedData,
    nodes: {
      ...normalizedData.nodes,
      [newNode.id]: { ...nodeWithoutChildren, children: [] }
    },
    rootNodeIds: newRootIds,
    parentMap: {
      ...normalizedData.parentMap,
      // 新しいルートノードには親を設定しない
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [newNode.id]: []
    }
  };
}

/**
 * 正規化されたデータで兄弟ノードの順序を変更 - O(1)
 */
export function changeSiblingOrderNormalized(
  normalizedData: NormalizedData,
  draggedNodeId: string,
  targetNodeId: string,
  insertBefore: boolean = true
): NormalizedData {
  logger.debug('🔧 changeSiblingOrderNormalized 開始:', { draggedNodeId, targetNodeId, insertBefore });
  
  const draggedParentId = normalizedData.parentMap[draggedNodeId];
  const targetParentId = normalizedData.parentMap[targetNodeId];
  
  logger.debug('🔧 親要素確認:', { draggedParentId, targetParentId });
  
  if (!draggedParentId || !targetParentId) {
    const error = 'Parent not found for one of the nodes';
    logger.error('❌', error);
    throw new Error(error);
  }
  
  if (draggedParentId !== targetParentId) {
    const error = 'Nodes must have the same parent to change sibling order';
    logger.error('❌', error);
    throw new Error(error);
  }
  
  const siblings = normalizedData.childrenMap[draggedParentId] || [];
  const draggedIndex = siblings.indexOf(draggedNodeId);
  const targetIndex = siblings.indexOf(targetNodeId);
  
  logger.debug('🔧 兄弟リスト:', { siblings, draggedIndex, targetIndex });
  
  if (draggedIndex === -1 || targetIndex === -1) {
    const error = 'One of the nodes is not a child of the parent';
    logger.error('❌', error, { draggedIndex, targetIndex, siblings });
    throw new Error(error);
  }
  
  if (draggedIndex === targetIndex) {
    logger.debug('🔧 同じインデックスのため変更なし');
    return normalizedData; // No change needed
  }
  
  // Remove dragged node from current position
  const newSiblings = siblings.filter(id => id !== draggedNodeId);
  
  // Find the new insertion index
  const adjustedTargetIndex = newSiblings.indexOf(targetNodeId);
  const insertionIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
  
  logger.debug('🔧 挿入処理:', { 
    originalSiblings: siblings, 
    newSiblings, 
    adjustedTargetIndex, 
    insertionIndex, 
    insertBefore 
  });
  
  // Insert dragged node at new position
  newSiblings.splice(insertionIndex, 0, draggedNodeId);
  
  logger.debug('🔧 最終的な兄弟リスト:', newSiblings);
  
  const result = {
    ...normalizedData,
    childrenMap: {
      ...normalizedData.childrenMap,
      [draggedParentId]: newSiblings
    }
  };
  
  logger.debug('✅ changeSiblingOrderNormalized 完了');
  return result;
}
