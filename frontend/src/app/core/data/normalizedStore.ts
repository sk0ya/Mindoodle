import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';


export interface NormalizedData {
  nodes: Record<string, MindMapNode>;
  rootNodeIds: string[]; 
  parentMap: Record<string, string>; 
  childrenMap: Record<string, string[]>; 
}

export interface NormalizedMindMapData {
  nodes: Record<string, MindMapNode>;
  rootNodeIds: string[]; 
  parentMap: Record<string, string>; 
  childrenMap: Record<string, string[]>; 
}

export function normalizeTreeData(rootNodes: MindMapNode[] | undefined): NormalizedData {
  
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
    
    const { children, ...nodeWithoutChildren } = node;
    nodes[node.id] = { ...nodeWithoutChildren, children: [] };

    
    if (parentId) {
      parentMap[node.id] = parentId;
    }

    
    const childIds = (children || []).map(child => child.id);
    childrenMap[node.id] = childIds;

    
    (children || []).forEach(child => {
      traverse(child, node.id);
    });
  }

  
  rootNodes.forEach(rootNode => {
    traverse(rootNode);
  });

  return {
    nodes,
    rootNodeIds: rootNodes.map(node => node.id),
    parentMap,
    childrenMap: {
      ...childrenMap,
      
      
      ['root']: rootNodes.map(node => node.id)
    }
  };
}

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

export function findNormalizedNode(
  normalizedData: NormalizedData, 
  nodeId: string
): MindMapNode | null {
  return normalizedData.nodes[nodeId] || null;
}

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

export function deleteNormalizedNode(
  normalizedData: NormalizedData,
  nodeId: string
): NormalizedData {
  const isRoot = normalizedData.rootNodeIds.includes(nodeId);
  let parentId = normalizedData.parentMap[nodeId];
  if (isRoot) {
    
    if (normalizedData.rootNodeIds.length <= 1) {
      throw new Error('Cannot delete the last root node');
    }
    parentId = 'root';
  } else if (!parentId) {
    throw new Error(`Parent not found for node: ${nodeId}`);
  }

  
  const nodesToDelete = new Set<string>();
  
  function collectDescendants(id: string) {
    nodesToDelete.add(id);
    const children = normalizedData.childrenMap[id] || [];
    children.forEach(childId => collectDescendants(childId));
  }
  
  collectDescendants(nodeId);

  
  const newNodes = { ...normalizedData.nodes };
  const newParentMap = { ...normalizedData.parentMap };
  const newChildrenMap = { ...normalizedData.childrenMap };

  
  nodesToDelete.forEach(id => {
    delete newNodes[id];
    delete newParentMap[id];
    delete newChildrenMap[id];
  });

  
  const parentChildren = newChildrenMap[parentId] || [];
  newChildrenMap[parentId] = parentChildren.filter(id => id !== nodeId);

  
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

  
  const parentNode = normalizedData.nodes[parentId];
  if ((parentNode as any)?.kind === 'table') {
    throw new Error('テーブルノードには子ノードを追加できません');
  }

  const { children, ...nodeWithoutChildren } = newNode;
  
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

  
  if ((nodeType === 'heading') &&
      (parentType === 'unordered-list' || parentType === 'ordered-list')) {
    return {
      isValid: false,
      reason: 'リストノードは見出しノードを子ノードにできません'
    };
  }

  
  if (nodeType === 'heading') {
    const parentLevel = parentType === 'heading' ? (newParent.markdownMeta?.level || 1) : 0;

    if (parentType === 'heading' && parentLevel + 1 > 6) {
      return {
        isValid: false,
        reason: '見出しノードは6階層までです'
      };
    }
  }

  
  
  
  
  

  return { isValid: true };
}

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
    
    const basicValidation = validateNodeMovement(normalizedData, nodeId, targetNodeId);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    
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
        
        
        return {
          isValid: false,
          reason: '見出しノードの兄弟がいる場合、リストノードは一番最初にのみ配置できます'
        };
      }
    }

    return { isValid: true };
  }

  
  const targetParentId = normalizedData.parentMap[targetNodeId];
  if (!targetParentId) {
    return { isValid: false, reason: 'ターゲットノードに親がありません' };
  }

  
  const validationResult = validateNodeMovement(normalizedData, nodeId, targetParentId);
  if (!validationResult.isValid) {
    return validationResult;
  }

  
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
      
      if (position === 'before') {
        
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

  
  const targetParent = normalizedData.nodes[newParentId];
  if ((targetParent as any)?.kind === 'table') {
    return { success: false, reason: 'テーブルノードには子ノードを追加できません' };
  }

  
  if (targetParent.markdownMeta?.type === 'preface') {
    return { success: false, reason: '前文ノードには子ノードを追加できません' };
  }

  
  const validation = validateNodeMovement(normalizedData, nodeId, newParentId);
  if (!validation.isValid) {
    return { success: false, reason: validation.reason || 'ノードの移動ができません' };
  }

  
  function isDescendant(parentId: string, childId: string): boolean {
    const children = normalizedData.childrenMap[parentId] || [];
    return children.includes(childId) ||
           children.some(child => isDescendant(child, childId));
  }

  if (isDescendant(nodeId, newParentId)) {
    return { success: false, reason: '親ノードを子ノードの下に移動することはできません' };
  }

  
  if (oldParentId === newParentId) {
    return { success: true, data: normalizedData };
  }

  
  
  const movingNode = normalizedData.nodes[nodeId] as any;
  if (movingNode?.kind === 'table') {
    const siblings = (normalizedData.childrenMap[newParentId] || []).filter(id => id !== nodeId);
    if (siblings.length > 0) {
      return { success: false, reason: '表ノードは兄弟がいる親へ末尾追加できません（先頭のみ許可）' };
    }
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

  
  if (position === 'child') {
    const targetNode = normalizedData.nodes[targetNodeId];
    if ((targetNode as any)?.kind === 'table') {
      return { success: false, reason: 'テーブルノードには子ノードを追加できません' };
    }
  }

  
  const validation = validateNodeMovementWithPosition(normalizedData, nodeId, targetNodeId, position);
  if (!validation.isValid) {
    return { success: false, reason: validation.reason || 'ノードの移動ができません' };
  }

  let newParentId: string;
  let insertionIndex: number;

  if (position === 'child') {
    
    newParentId = targetNodeId;
    insertionIndex = (normalizedData.childrenMap[newParentId] || []).length;
  } else {
    
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

  
  function isDescendant(parentId: string, childId: string): boolean {
    const children = normalizedData.childrenMap[parentId] || [];
    return children.includes(childId) ||
           children.some(child => isDescendant(child, childId));
  }

  if (isDescendant(nodeId, newParentId)) {
    return { success: false, reason: '親ノードを子ノードの下に移動することはできません' };
  }

  
  const oldSiblings = normalizedData.childrenMap[oldParentId] || [];
  const newOldSiblings = oldSiblings.filter(id => id !== nodeId);

  
  const newSiblings = [...(normalizedData.childrenMap[newParentId] || [])];

  
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

  
  const movingNode2 = normalizedData.nodes[nodeId] as any;
  if (movingNode2?.kind === 'table') {
    const siblingsCountExcludingSelf = newSiblings.filter(id => id !== nodeId).length;
    if (siblingsCountExcludingSelf > 0 && insertionIndex !== 0) {
      return { success: false, reason: '表ノードは兄弟がいる場合は先頭にのみ配置できます' };
    }
  }

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
  void children; 

  const siblings = normalizedData.childrenMap[parentId] || [];
  const siblingIndex = siblings.indexOf(siblingNodeId);
  
  if (siblingIndex === -1) {
    throw new Error(`Sibling node not found in parent's children: ${siblingNodeId}`);
  }

  
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
  void children; 

  
  const currentRootIds = normalizedData.rootNodeIds;
  const siblingIndex = currentRootIds.indexOf(siblingRootNodeId);
  
  if (siblingIndex === -1) {
    throw new Error(`Root sibling node not found: ${siblingRootNodeId}`);
  }

  
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
      
    },
    childrenMap: {
      ...normalizedData.childrenMap,
      [newNode.id]: []
    }
  };
}

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
    return normalizedData; 
  }
  
  
  const newSiblings = siblings.filter(id => id !== draggedNodeId);
  
  
  const adjustedTargetIndex = newSiblings.indexOf(targetNodeId);
  const insertionIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
  
  logger.debug('🔧 挿入処理:', { 
    originalSiblings: siblings, 
    newSiblings, 
    adjustedTargetIndex, 
    insertionIndex, 
    insertBefore 
  });
  
  
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
