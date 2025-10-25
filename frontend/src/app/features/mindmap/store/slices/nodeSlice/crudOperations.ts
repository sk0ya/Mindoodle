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

/**
 * CRUD operations for node management
 * Handles create, update, and delete operations with history tracking
 */
export function createCRUDOperations(
  set: (fn: (state: MindMapStore) => void) => void,
  get: () => MindMapStore
) {
  return {
    /**
     * Update node properties
     * Preserves preface node text (immutable)
     */
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

      // Sync to tree structure
      get().syncToMindMapData();

      // Apply auto layout if collapse state changed
      if (collapsedChanged) {
        const { data } = get();
        if (data?.settings?.autoLayout) {
          get().applyAutoLayout();
        }
      }
    },

    /**
     * Add a child node to a parent
     * Inherits metadata from siblings and applies positioning
     */
    addChildNode: (parentId: string, text: string = 'New Node'): string | undefined => {
      let newNodeId: string | undefined;

      const state = get() as MindMapStore & { _pasteInProgress?: boolean; beginHistoryGroup?: (type: string) => void; endHistoryGroup?: (commit: boolean) => void };
      const pasteInProgress = state._pasteInProgress;
      if (!pasteInProgress) {
        try { state.beginHistoryGroup?.('insert-node'); } catch {}
      }

      set((state) => {
        if (!state.normalizedData) return;

        try {
          const parentNode = state.normalizedData.nodes[parentId];
          if (!parentNode) return;

          // Block adding children to table nodes
          if ('kind' in parentNode && (parentNode as MindMapNode & { kind?: string }).kind === 'table') {
            return;
          }

          // Block adding children to preface nodes
          if (parentNode.markdownMeta?.type === 'preface') {
            return;
          }

          // Expand parent node if collapsed
          if (parentNode.collapsed) {
            parentNode.collapsed = false;
            state.normalizedData.nodes[parentId] = { ...parentNode };
          }

          // Create new node
          const settings = state.settings;
          const newNode = createNewNode(text, parentNode, settings, true);
          newNodeId = newNode.id;

          const childIds = state.normalizedData.childrenMap[parentId] || [];
          const childNodes = childIds.map((id: string) => state.normalizedData?.nodes[id]).filter(Boolean);

          // Calculate position
          try {
            const fontSize = state.settings?.fontSize ?? 14;
            const wrapConfig = resolveNodeTextWrapConfig(state.settings, fontSize);
            const parentSize = calculateNodeSize(parentNode, undefined, false, fontSize, wrapConfig);
            const childSize = calculateNodeSize(newNode, undefined, false, fontSize, wrapConfig);
            const edge = getDynamicNodeSpacing(parentSize, childSize, false);
            newNode.x = calculateChildNodeX(parentNode, childSize, edge, fontSize, wrapConfig);
            newNode.y = parentNode.y;
          } catch (posErr) {
            logger.warn('Position calculation failed, using fallback', posErr);
            newNode.x = parentNode.x;
            newNode.y = parentNode.y;
          }

          // Inherit metadata from siblings
          const nonTableSiblings = childNodes.filter((s) => s && 'kind' in s && s.kind !== 'table');
          if (nonTableSiblings.length > 0) {
            const lastSibling = nonTableSiblings[nonTableSiblings.length - 1];
            if (lastSibling && lastSibling.markdownMeta) {
              newNode.markdownMeta = {
                type: lastSibling.markdownMeta.type,
                level: lastSibling.markdownMeta.level,
                originalFormat: lastSibling.markdownMeta.originalFormat,
                indentLevel: lastSibling.markdownMeta.indentLevel,
                lineNumber: -1,
                // Inherit checkbox but reset checked state
                ...(lastSibling.markdownMeta.isCheckbox && {
                  isCheckbox: true,
                  isChecked: false
                })
              };
            }
          } else if (parentNode.markdownMeta) {
            // Derive from parent
            if (parentNode.markdownMeta.type === 'heading') {
              const childLevel = (parentNode.markdownMeta.level || 1) + 1;

              // Convert to list if level exceeds 6
              if (childLevel >= 7) {
                newNode.markdownMeta = {
                  type: 'unordered-list',
                  level: 1,
                  originalFormat: '-',
                  indentLevel: 0,
                  lineNumber: -1
                };
              } else {
                newNode.markdownMeta = {
                  type: 'heading',
                  level: childLevel,
                  originalFormat: '#'.repeat(childLevel),
                  indentLevel: 0,
                  lineNumber: -1
                };
              }
            } else {
              newNode.markdownMeta = {
                type: parentNode.markdownMeta.type,
                level: (parentNode.markdownMeta.level || 1) + 1,
                originalFormat: parentNode.markdownMeta.originalFormat,
                indentLevel: (parentNode.markdownMeta.indentLevel || 0) + 2,
                lineNumber: -1,
                // Inherit checkbox but reset checked state
                ...(parentNode.markdownMeta.isCheckbox && {
                  isCheckbox: true,
                  isChecked: false
                })
              };
            }
          }

          // Add to normalized data
          state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);

          // Assign color based on position
          const isRootNode = !(parentId in state.normalizedData.parentMap);
          const color = isRootNode
            ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length]
            : getBranchColor(newNode.id, state.normalizedData);

          newNode.color = color;
          state.normalizedData.nodes[newNode.id] = { ...newNode };

          // Update selection
          state.lastSelectionBeforeInsert = parentId;
          state.selectedNodeId = newNode.id;
        } catch (error) {
          logger.error('addChildNode error:', error);
        }
      });

      // Sync to tree structure
      get().syncToMindMapData();

      // End history group
      if (!pasteInProgress) {
        try { state.endHistoryGroup?.(true); } catch {}
      }

      // Apply auto layout (debounced to batch multiple rapid operations)
      const { data } = get();
      logger.debug('🔍 Auto layout check (addChildNode):', {
        hasData: !!data,
        hasSettings: !!data?.settings,
        autoLayoutEnabled: data?.settings?.autoLayout,
        settingsObject: data?.settings
      });
      if (data?.settings?.autoLayout) {
        logger.debug('✅ Applying auto layout after addChildNode');
        const applyAutoLayout = get().applyAutoLayout;
        if (typeof applyAutoLayout === 'function') {
          applyAutoLayout();
        } else {
          logger.error('❌ applyAutoLayout function not found');
        }
      } else {
        logger.debug('❌ Auto layout disabled or settings missing');
      }

      return newNodeId;
    },

    /**
     * Add a sibling node next to an existing node
     * Handles both root and child node contexts
     */
    addSiblingNode: (nodeId: string, text: string = 'New Node', insertAfter: boolean = true): string | undefined => {
      let newNodeId: string | undefined;

      const state2 = get() as MindMapStore & { _pasteInProgress?: boolean; beginHistoryGroup?: (type: string) => void; endHistoryGroup?: (commit: boolean) => void };
      const pasteInProgress = state2._pasteInProgress;
      if (!pasteInProgress) {
        try { state2.beginHistoryGroup?.('insert-sibling'); } catch {}
      }

      set((state) => {
        if (!state.normalizedData) return;

        try {
          const currentNode = state.normalizedData.nodes[nodeId];
          if (!currentNode) return;

          const parentId = state.normalizedData.parentMap[nodeId];

          // Derive sibling markdown metadata
          const deriveSiblingMarkdownMeta = (): Partial<MindMapNode['markdownMeta']> | undefined => {
            const nd = state.normalizedData;
            if (!nd) return undefined;
            const isTable = 'kind' in currentNode && (currentNode as MindMapNode & { kind?: string }).kind === 'table';

            if (!isTable) {
              // Copy from current node
              if (currentNode.markdownMeta?.isCheckbox) {
                return {
                  ...currentNode.markdownMeta,
                  isChecked: false
                };
              }
              return currentNode.markdownMeta;
            }

            if (!parentId) {
              // Root level table
              const roots = nd.rootNodeIds || [];
              const idx = roots.indexOf(nodeId);
              const meta = nearestNonTableSiblingMeta(nd, roots, idx);
              if (meta) return meta;

              return { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 };
            } else {
              const siblings = nd.childrenMap[parentId] || [];
              const idx = siblings.indexOf(nodeId);
              const meta = nearestNonTableSiblingMeta(nd, siblings, idx);
              if (meta) return meta;
              const parentNode = nd.nodes[parentId];
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
                    // Inherit checkbox but reset checked state
                    ...(pMeta.isCheckbox && {
                      isCheckbox: true,
                      isChecked: false
                    })
                  };
                }
              }

              return { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 };
            }
          };

          // Create new node
          const settings = state.settings;
          let newNode: MindMapNode;

          if (!parentId) {
            // Root sibling
            newNode = createNewNode(text, currentNode, settings, true);
            newNodeId = newNode.id;

            newNode.x = currentNode.x;
            newNode.y = currentNode.y;

            const derivedMeta = deriveSiblingMarkdownMeta();
            if (derivedMeta) newNode.markdownMeta = { ...derivedMeta, lineNumber: -1 } as MindMapNode['markdownMeta'];

            state.normalizedData = addRootSiblingNode(state.normalizedData, nodeId, newNode, true);

            const color = getBranchColor(newNode.id, state.normalizedData);
            newNode.color = color;
            state.normalizedData.nodes[newNode.id] = { ...newNode };

          } else {
            // Child sibling
            const parentNode = state.normalizedData.nodes[parentId];
            if (!parentNode) return;

            newNode = createNewNode(text, parentNode, settings, true);
            newNodeId = newNode.id;

            // Calculate position
            try {
              const fontSize = state.settings?.fontSize ?? 14;
              const wrapConfig = resolveNodeTextWrapConfig(state.settings, fontSize);
              const pNode = state.normalizedData.nodes[parentId];
              const parentSize = calculateNodeSize(pNode, undefined, false, fontSize, wrapConfig);
              const childSize = calculateNodeSize(newNode, undefined, false, fontSize, wrapConfig);
              const edge = getDynamicNodeSpacing(parentSize, childSize, false);
              newNode.x = calculateChildNodeX(pNode, childSize, edge, fontSize, wrapConfig);
              newNode.y = pNode.y;
            } catch (posErr) {
              logger.warn('Position calculation failed for sibling, using fallback', posErr);
              newNode.x = currentNode.x;
              newNode.y = currentNode.y;
            }

            const derivedMeta2 = deriveSiblingMarkdownMeta();
            if (derivedMeta2) newNode.markdownMeta = { ...derivedMeta2, lineNumber: -1 } as MindMapNode['markdownMeta'];

            state.normalizedData = addSiblingNormalizedNode(state.normalizedData, nodeId, newNode, insertAfter);

            const color = getBranchColor(newNode.id, state.normalizedData);
            newNode.color = color;
            state.normalizedData.nodes[newNode.id] = { ...newNode };
          }

          // Update selection
          state.lastSelectionBeforeInsert = nodeId;
          state.selectedNodeId = newNode.id;
        } catch (error) {
          logger.error('addSiblingNode error:', error);
        }
      });

      // Sync to tree structure
      get().syncToMindMapData();

      // End history group
      if (!pasteInProgress) {
        try { state2.endHistoryGroup?.(true); } catch {}
      }

      // Apply auto layout (debounced to batch multiple rapid operations)
      const { data } = get();
      logger.debug('🔍 Auto layout check (addSiblingNode):', {
        hasData: !!data,
        hasSettings: !!data?.settings,
        autoLayoutEnabled: data?.settings?.autoLayout,
        settingsObject: data?.settings
      });
      if (data?.settings?.autoLayout) {
        logger.debug('✅ Applying auto layout after addSiblingNode');
        const applyAutoLayout = get().applyAutoLayout;
        if (typeof applyAutoLayout === 'function') {
          applyAutoLayout();
        } else {
          logger.error('❌ applyAutoLayout function not found');
        }
      } else {
        logger.debug('❌ Auto layout disabled or settings missing');
      }

      return newNodeId;
    },

    /**
     * Delete a node and select an appropriate fallback
     */
    deleteNode: (nodeId: string) => {
      let nextNodeToSelect: string | null = null;

      const state3 = get() as MindMapStore & { beginHistoryGroup?: (type: string) => void; endHistoryGroup?: (commit: boolean) => void };
      try { state3.beginHistoryGroup?.('delete-node'); } catch {}

      set((state) => {
        if (!state.normalizedData) return;

        try {
          // Find next node to select
          const parentId = state.normalizedData.parentMap[nodeId];
          if (parentId) {
            const siblings = state.normalizedData.childrenMap[parentId] || [];
            const currentIndex = siblings.indexOf(nodeId);

            if (currentIndex !== -1) {
              // Select next sibling
              if (currentIndex < siblings.length - 1) {
                nextNodeToSelect = siblings[currentIndex + 1];
              }
              // Or previous sibling
              else if (currentIndex > 0) {
                nextNodeToSelect = siblings[currentIndex - 1];
              }
              // Or parent
              else if (parentId !== 'root') {
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

      // Sync to tree structure
      get().syncToMindMapData();

      // End history group
      try { state3.endHistoryGroup?.(true); } catch {}

      // Apply auto layout
      const { data } = get();
      logger.debug('🔍 Auto layout check (deleteNode):', {
        hasData: !!data,
        hasSettings: !!data?.settings,
        autoLayoutEnabled: data?.settings?.autoLayout
      });
      if (data?.settings?.autoLayout) {
        logger.debug('✅ Applying auto layout after deleteNode');
        get().applyAutoLayout();
      } else {
        logger.debug('❌ Auto layout disabled or settings missing');
      }
    },
  };
}
