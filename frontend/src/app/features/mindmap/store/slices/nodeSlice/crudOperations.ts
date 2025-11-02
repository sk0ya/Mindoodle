/**
 * CRUD operations for node management - refactored with functional patterns
 * Reduced from 481 lines to 385 lines (20% reduction)
 */

import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import {
  getBranchColor,
  calculateNodeSize,
  getDynamicNodeSpacing,
  calculateChildNodeX,
  resolveNodeTextWrapConfig
} from '../../../utils';
import {
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  addSiblingNormalizedNode,
  addRootSiblingNode,
} from '@core/data/normalizedStore';
import { COLORS } from '@shared/constants';
import type { MindMapStore } from '../types';
import { createNewNode, nearestNonTableSiblingMeta } from './helpers';

// === Helpers ===

const beginHistoryGroup = (get: () => MindMapStore, type: string, pasteInProgress?: boolean) => {
  if (pasteInProgress) return;
  const state = get() as MindMapStore & { beginHistoryGroup?: (type: string) => void };
  try { state.beginHistoryGroup?.(type); } catch {}
};

const endHistoryGroup = (get: () => MindMapStore, commit: boolean, pasteInProgress?: boolean) => {
  if (pasteInProgress) return;
  const state = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
  try { state.endHistoryGroup?.(commit); } catch {}
};

const applyAutoLayoutIfEnabled = (get: () => MindMapStore, operationName: string) => {
  const { data, applyAutoLayout } = get();
  logger.debug(`Auto layout check (${operationName}):`, {
    hasData: !!data,
    autoLayoutEnabled: data?.settings?.autoLayout
  });

  if (data?.settings?.autoLayout) {
    logger.debug(`Applying auto layout after ${operationName}`);
    if (typeof applyAutoLayout === 'function') {
      // For node insertion operations, apply layout immediately to prevent visual overlap
      const immediate = operationName === 'addChildNode' || operationName === 'addSiblingNode';
      applyAutoLayout(immediate);
    } else {
      logger.error('applyAutoLayout function not found');
    }
  } else {
    logger.debug('Auto layout disabled or settings missing');
  }
};

const syncAndApplyLayout = (get: () => MindMapStore, operationName: string) => {
  get().syncToMindMapData();
  applyAutoLayoutIfEnabled(get, operationName);
};

const calculateNodePosition = (
  node: MindMapNode,
  parentNode: MindMapNode,
  settings: MindMapStore['settings'],
  fallback: { x: number; y: number }
) => {
  try {
    const fontSize = settings?.fontSize ?? 14;
    const wrapConfig = resolveNodeTextWrapConfig(settings, fontSize);
    const parentSize = calculateNodeSize(parentNode, undefined, false, fontSize, wrapConfig);
    const childSize = calculateNodeSize(node, undefined, false, fontSize, wrapConfig);
    const edge = getDynamicNodeSpacing(parentSize, childSize, false);
    node.x = calculateChildNodeX(parentNode, childSize, edge, fontSize, wrapConfig);
    node.y = parentNode.y;
  } catch (posErr) {
    logger.warn('Position calculation failed, using fallback', posErr);
    node.x = fallback.x;
    node.y = fallback.y;
  }
};

const assignBranchColor = (
  node: MindMapNode,
  normalizedData: NonNullable<MindMapStore['normalizedData']>,
  parentId?: string,
  childCount?: number
) => {
  const isRootNode = !parentId || !(parentId in normalizedData.parentMap);
  const color = isRootNode
    ? COLORS.NODE_COLORS[(childCount ?? 0) % COLORS.NODE_COLORS.length]
    : getBranchColor(node.id, normalizedData);
  node.color = color;
  normalizedData.nodes[node.id] = { ...node };
};

const deriveChildMetadata = (
  parentNode: MindMapNode,
  siblings: MindMapNode[]
): Partial<MindMapNode['markdownMeta']> | undefined => {
  // Inherit from non-table siblings
  const nonTableSiblings = siblings.filter((s) => s && 'kind' in s && s.kind !== 'table');
  if (nonTableSiblings.length > 0) {
    const lastSibling = nonTableSiblings[nonTableSiblings.length - 1];
    if (lastSibling?.markdownMeta) {
      return {
        ...lastSibling.markdownMeta,
        lineNumber: -1,
        ...(lastSibling.markdownMeta.isCheckbox && {
          isCheckbox: true,
          isChecked: false
        })
      };
    }
  }

  // Derive from parent
  if (parentNode.markdownMeta) {
    if (parentNode.markdownMeta.type === 'heading') {
      const childLevel = (parentNode.markdownMeta.level || 1) + 1;
      // Convert to list if level exceeds 6
      return childLevel >= 7
        ? { type: 'unordered-list', level: 1, originalFormat: '-', indentLevel: 0, lineNumber: -1 }
        : { type: 'heading', level: childLevel, originalFormat: '#'.repeat(childLevel), indentLevel: 0, lineNumber: -1 };
    } else {
      return {
        type: parentNode.markdownMeta.type,
        level: (parentNode.markdownMeta.level || 1) + 1,
        originalFormat: parentNode.markdownMeta.originalFormat,
        indentLevel: (parentNode.markdownMeta.indentLevel || 0) + 2,
        lineNumber: -1,
        ...(parentNode.markdownMeta.isCheckbox && {
          isCheckbox: true,
          isChecked: false
        })
      };
    }
  }

  return undefined;
};

const deriveSiblingMetadata = (
  currentNode: MindMapNode,
  parentId: string | undefined,
  normalizedData: NonNullable<MindMapStore['normalizedData']>
): Partial<MindMapNode['markdownMeta']> | undefined => {
  const isTable = 'kind' in currentNode && (currentNode as MindMapNode & { kind?: string }).kind === 'table';

  if (!isTable) {
    // Copy from current node
    if (currentNode.markdownMeta?.isCheckbox) {
      return { ...currentNode.markdownMeta, isChecked: false };
    }
    return currentNode.markdownMeta;
  }

  // Handle table node metadata
  if (!parentId) {
    const roots = normalizedData.rootNodeIds || [];
    const idx = roots.indexOf(currentNode.id);
    return nearestNonTableSiblingMeta(normalizedData, roots, idx) ||
      { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 };
  } else {
    const siblings = normalizedData.childrenMap[parentId] || [];
    const idx = siblings.indexOf(currentNode.id);
    const meta = nearestNonTableSiblingMeta(normalizedData, siblings, idx);
    if (meta) return meta;

    const parentNode = normalizedData.nodes[parentId];
    const pMeta = parentNode?.markdownMeta;
    if (pMeta) {
      if (pMeta.type === 'heading') {
        const lvl = Math.min((pMeta.level || 1) + 1, 6);
        return { type: 'heading', level: lvl, originalFormat: '#'.repeat(lvl), indentLevel: 0, lineNumber: -1 };
      } else if (pMeta.type === 'unordered-list' || pMeta.type === 'ordered-list') {
        return {
          type: pMeta.type,
          level: (pMeta.level || 1) + 1,
          originalFormat: pMeta.originalFormat,
          indentLevel: (pMeta.indentLevel || 0) + 2,
          lineNumber: -1,
          ...(pMeta.isCheckbox && { isCheckbox: true, isChecked: false })
        };
      }
    }

    return { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 };
  }
};

const updateSelection = (state: MindMapStore, nodeId: string, previousNodeId?: string) => {
  state.lastSelectionBeforeInsert = previousNodeId ?? null;
  state.selectedNodeId = nodeId;
};

// === Operations ===

export function createCRUDOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    updateNode: (nodeId: string, updates: Partial<MindMapNode>) => {
      const collapsedChanged = 'collapsed' in updates;

      set((state) => {
        if (!state.normalizedData) return;

        try {
          const existingNode = state.normalizedData.nodes[nodeId];

          // Prevent text changes to preface nodes
          if (existingNode?.markdownMeta?.type === 'preface' && 'text' in updates) {
            const { text, ...allowedUpdates } = updates;
            state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, allowedUpdates);
          } else {
            state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, updates);
          }
        } catch (error) {
          logger.error('updateNode error:', error);
        }
      });

      get().syncToMindMapData();

      if (collapsedChanged) {
        const { data } = get();
        if (data?.settings?.autoLayout) {
          get().applyAutoLayout();
        }
      }
    },

    addChildNode: (parentId: string, text: string = 'New Node'): string | undefined => {
      let newNodeId: string | undefined;
      const state = get() as MindMapStore & { _pasteInProgress?: boolean };
      const pasteInProgress = state._pasteInProgress;

      beginHistoryGroup(get, 'insert-node', pasteInProgress);

      set((state) => {
        if (!state.normalizedData) return;

        try {
          const parentNode = state.normalizedData.nodes[parentId];
          if (!parentNode) return;

          // Block adding children to table or preface nodes
          if (('kind' in parentNode && (parentNode as MindMapNode & { kind?: string }).kind === 'table') ||
              parentNode.markdownMeta?.type === 'preface') {
            return;
          }

          // Expand parent if collapsed
          if (parentNode.collapsed) {
            parentNode.collapsed = false;
            state.normalizedData.nodes[parentId] = { ...parentNode };
          }

          // Create new node
          const newNode = createNewNode(text, parentNode, state.settings, true);
          newNodeId = newNode.id;

          const childIds = state.normalizedData.childrenMap[parentId] || [];
          const childNodes = childIds
            .map((id: string) => state.normalizedData?.nodes[id])
            .filter((n): n is MindMapNode => Boolean(n));

          // Calculate position
          calculateNodePosition(newNode, parentNode, state.settings, { x: parentNode.x, y: parentNode.y });

          // Inherit metadata
          const metadata = deriveChildMetadata(parentNode, childNodes);
          if (metadata) newNode.markdownMeta = metadata as MindMapNode['markdownMeta'];

          // Add to normalized data
          state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);

          // Assign color
          assignBranchColor(newNode, state.normalizedData, parentId, childNodes.length);

          // Update selection
          updateSelection(state, newNode.id, parentId);
        } catch (error) {
          logger.error('addChildNode error:', error);
        }
      });

      syncAndApplyLayout(get, 'addChildNode');
      endHistoryGroup(get, true, pasteInProgress);

      return newNodeId;
    },

    addSiblingNode: (nodeId: string, text: string = 'New Node', insertAfter: boolean = true): string | undefined => {
      let newNodeId: string | undefined;
      const state = get() as MindMapStore & { _pasteInProgress?: boolean };
      const pasteInProgress = state._pasteInProgress;

      beginHistoryGroup(get, 'insert-sibling', pasteInProgress);

      set((state) => {
        if (!state.normalizedData) return;

        try {
          const currentNode = state.normalizedData.nodes[nodeId];
          if (!currentNode) return;

          const parentId = state.normalizedData.parentMap[nodeId];
          const derivedMeta = deriveSiblingMetadata(currentNode, parentId, state.normalizedData);
          let newNode: MindMapNode;

          if (!parentId) {
            // Root sibling
            newNode = createNewNode(text, currentNode, state.settings, true);
            newNodeId = newNode.id;
            newNode.x = currentNode.x;
            newNode.y = currentNode.y;

            if (derivedMeta) newNode.markdownMeta = { ...derivedMeta, lineNumber: -1 } as MindMapNode['markdownMeta'];

            state.normalizedData = addRootSiblingNode(state.normalizedData, nodeId, newNode, true);
            assignBranchColor(newNode, state.normalizedData);
          } else {
            // Child sibling
            const parentNode = state.normalizedData.nodes[parentId];
            if (!parentNode) return;

            newNode = createNewNode(text, parentNode, state.settings, true);
            newNodeId = newNode.id;

            // Calculate position
            calculateNodePosition(newNode, parentNode, state.settings, { x: currentNode.x, y: currentNode.y });

            if (derivedMeta) newNode.markdownMeta = { ...derivedMeta, lineNumber: -1 } as MindMapNode['markdownMeta'];

            state.normalizedData = addSiblingNormalizedNode(state.normalizedData, nodeId, newNode, insertAfter);
            assignBranchColor(newNode, state.normalizedData);
          }

          // Update selection
          updateSelection(state, newNode.id, nodeId);
        } catch (error) {
          logger.error('addSiblingNode error:', error);
        }
      });

      syncAndApplyLayout(get, 'addSiblingNode');
      endHistoryGroup(get, true, pasteInProgress);

      return newNodeId;
    },

    deleteNode: (nodeId: string) => {
      let nextNodeToSelect: string | null = null;

      beginHistoryGroup(get, 'delete-node');

      set((state) => {
        if (!state.normalizedData) return;

        try {
          // Find next node to select
          const parentId = state.normalizedData.parentMap[nodeId];
          if (parentId) {
            const siblings = state.normalizedData.childrenMap[parentId] || [];
            const currentIndex = siblings.indexOf(nodeId);

            if (currentIndex !== -1) {
              // Select next sibling, previous sibling, or parent
              if (currentIndex < siblings.length - 1) {
                nextNodeToSelect = siblings[currentIndex + 1];
              } else if (currentIndex > 0) {
                nextNodeToSelect = siblings[currentIndex - 1];
              } else if (parentId !== 'root') {
                nextNodeToSelect = parentId;
              }
            }
          }

          state.normalizedData = deleteNormalizedNode(state.normalizedData, nodeId);

          // Update selection
          if (state.selectedNodeId === nodeId || !state.selectedNodeId) {
            if (!nextNodeToSelect) {
              const roots = state.normalizedData.childrenMap['root'] || [];
              nextNodeToSelect = roots.length > 0 ? roots[0] : null;
            }
            state.selectedNodeId = nextNodeToSelect;
          }
          if (state.editingNodeId === nodeId) {
            state.editingNodeId = null;
            state.editText = '';
          }
        } catch (error) {
          logger.error('deleteNode error:', error);
        }
      });

      syncAndApplyLayout(get, 'deleteNode');
      endHistoryGroup(get, true);
    },
  };
}
