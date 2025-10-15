import type { StateCreator } from 'zustand';
import type { MindMapNode, NodeLink } from '@shared/types';
import { logger, generateNodeId } from '@shared/utils';
import {
  addLinkToNodeInTree,
  updateLinkInNodeTree,
  removeLinkFromNodeTree,
  getBranchColor,
  calculateNodeSize,
  getDynamicNodeSpacing,
  calculateChildNodeX,
  resolveNodeTextWrapConfig
} from '../../utils';
import {
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  addSiblingNormalizedNode,
  addRootSiblingNode,
  moveNormalizedNode,
  moveNodeWithPositionNormalized,
  changeSiblingOrderNormalized,
  denormalizeTreeData
} from '@core/data/normalizedStore';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import { COLORS } from '@shared/constants';
import type { MindMapStore } from './types';


// Helpers extracted to reduce deep nested function definitions flagged by ESLint (sonarjs)
interface NormalizedDataLike {
  nodes: Record<string, MindMapNode>;
}

function nearestNonTableSiblingMeta(nd: NormalizedDataLike, siblings: string[], currentIdx: number): Partial<MindMapNode['markdownMeta']> | undefined {
  const n = siblings.length;
  for (let offset = 1; offset < n; offset++) {
    const left = currentIdx - offset;
    const right = currentIdx + offset;
    if (left >= 0) {
      const sib = nd.nodes[siblings[left]];
      if (sib && sib.kind !== 'table' && sib.markdownMeta) {
        if (sib.markdownMeta.isCheckbox) {
          return { ...sib.markdownMeta, isChecked: false };
        }
        return sib.markdownMeta;
      }
    }
    if (right < n) {
      const sib = nd.nodes[siblings[right]];
      if (sib && sib.kind !== 'table' && sib.markdownMeta) {
        if (sib.markdownMeta.isCheckbox) {
          return { ...sib.markdownMeta, isChecked: false };
        }
        return sib.markdownMeta;
      }
    }
  }
  return undefined;
}

function updateNodeCheckedInTree(nodes: MindMapNode[], nodeId: string, checked: boolean): MindMapNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      if (node.markdownMeta?.isCheckbox) {
        return { ...node, markdownMeta: { ...node.markdownMeta, isChecked: checked } } as MindMapNode;
      }
      return node;
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateNodeCheckedInTree(node.children, nodeId, checked) } as MindMapNode;
    }
    return node;
  });
}


const createNewNode = (text: string, parentNode?: MindMapNode, settings?: { fontSize?: number; addBlankLineAfterHeading?: boolean }, addBlankLine: boolean = false): MindMapNode => {
  const newNode: MindMapNode = {
    id: generateNodeId(),
    text,
    x: 0,
    y: 0,
    children: [],
    fontSize: 14,
    fontWeight: 'normal',
    lineEnding: parentNode?.lineEnding || LineEndingUtils.LINE_ENDINGS.LF
  };

  
  if (addBlankLine && parentNode?.markdownMeta?.type === 'heading' && settings?.addBlankLineAfterHeading !== false) {
    newNode.note = '';
  }

  return newNode;
};

export interface NodeSlice {
  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  // CRUD operations
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string, insertAfter?: boolean) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  moveNodeWithPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => { success: boolean; reason?: string };
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  
  
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;

  
  toggleNodeCheckbox: (nodeId: string, checked: boolean) => void;
}

export const createNodeSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  NodeSlice
> = (set, get) => ({
  
  findNode: (nodeId: string) => {
    const { normalizedData } = get();
    if (!normalizedData || !nodeId) return null;
    return normalizedData.nodes[nodeId] || null;
  },

  getChildNodes: (nodeId: string) => {
    const { normalizedData } = get();
    if (!normalizedData || !nodeId) return [];
    const childIds = normalizedData.childrenMap[nodeId] || [];
    return childIds.map((childId: string) => normalizedData.nodes[childId]).filter(Boolean);
  },

  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => {
    set((state) => {
      if (!state.normalizedData) return;

      try {
        const existingNode = state.normalizedData.nodes[nodeId];

        
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
  },

  addChildNode: (parentId: string, text: string = 'New Node') => {
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

        // Check if parent is a table node
        if ('kind' in parentNode && (parentNode as MindMapNode & { kind?: string }).kind === 'table') {
          return;
        }

        
        if (parentNode.markdownMeta?.type === 'preface') {
          return;
        }
        
        
        const settings = state.settings;
        const newNode = createNewNode(text, parentNode, settings, true);
        newNodeId = newNode.id;
        
        const childIds = state.normalizedData.childrenMap[parentId] || [];
        const childNodes = childIds.map((id: string) => state.normalizedData?.nodes[id]).filter(Boolean);
        

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
              
              ...(lastSibling.markdownMeta.isCheckbox && {
                isCheckbox: true,
                isChecked: false
              })
            };
          }
        } else if (parentNode.markdownMeta) {
          
          if (parentNode.markdownMeta.type === 'heading') {
            const childLevel = (parentNode.markdownMeta.level || 1) + 1;

            
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
              
              ...(parentNode.markdownMeta.isCheckbox && {
                isCheckbox: true,
                isChecked: false
              })
            };
          }
        }

        
        state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);
        
        
        
        const isRootNode = !(parentId in state.normalizedData.parentMap);
        const color = isRootNode
          ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length]
          : getBranchColor(newNode.id, state.normalizedData);
        
        
        newNode.color = color;
        state.normalizedData.nodes[newNode.id] = { ...newNode };
        
        
        state.lastSelectionBeforeInsert = parentId;
        
        state.selectedNodeId = newNode.id;
      } catch (error) {
        logger.error('addChildNode error:', error);
      }
    });


    get().syncToMindMapData();


    if (!pasteInProgress) {
      try { state.endHistoryGroup?.(true); } catch {}
    }


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
        applyAutoLayout(true); 
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
    }

    return newNodeId;
  },

  addSiblingNode: (nodeId: string, text: string = 'New Node', insertAfter: boolean = true) => {
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

        
        const deriveSiblingMarkdownMeta = (): Partial<MindMapNode['markdownMeta']> | undefined => {
          const nd = state.normalizedData;
          if (!nd) return undefined;
          const isTable = 'kind' in currentNode && (currentNode as MindMapNode & { kind?: string }).kind === 'table';
          // nearestNonTableSiblingMeta extracted at module scope

          if (!isTable) {
            
            if (currentNode.markdownMeta?.isCheckbox) {
              return {
                ...currentNode.markdownMeta,
                isChecked: false
              };
            }
            return currentNode.markdownMeta;
          }

          if (!parentId) {

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
        
        
        const settings = state.settings;
        let newNode: MindMapNode;

        if (!parentId) {
          
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
          
          const parentNode = state.normalizedData.nodes[parentId];
          if (!parentNode) return;

          newNode = createNewNode(text, parentNode, settings, true);
          newNodeId = newNode.id;
          


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
        
        
        state.lastSelectionBeforeInsert = nodeId;
        
        state.selectedNodeId = newNode.id;
      } catch (error) {
        logger.error('addSiblingNode error:', error);
      }
    });


    get().syncToMindMapData();


    if (!pasteInProgress) {
      try { state2.endHistoryGroup?.(true); } catch {}
    }


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
        applyAutoLayout(true); 
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
    }

    return newNodeId;
  },

  deleteNode: (nodeId: string) => {
    let nextNodeToSelect: string | null = null;

    const state3 = get() as MindMapStore & { beginHistoryGroup?: (type: string) => void; endHistoryGroup?: (commit: boolean) => void };
    try { state3.beginHistoryGroup?.('delete-node'); } catch {}

    set((state) => {
      if (!state.normalizedData) return;

      try {
        
        const parentId = state.normalizedData.parentMap[nodeId];
        if (parentId) {
          const siblings = state.normalizedData.childrenMap[parentId] || [];
          const currentIndex = siblings.indexOf(nodeId);

          if (currentIndex !== -1) {
            
            if (currentIndex < siblings.length - 1) {
              nextNodeToSelect = siblings[currentIndex + 1];
            }
            
            else if (currentIndex > 0) {
              nextNodeToSelect = siblings[currentIndex - 1];
            }
            
            else if (parentId !== 'root') {
              nextNodeToSelect = parentId;
            }
          }
        }

        state.normalizedData = deleteNormalizedNode(state.normalizedData, nodeId);
        
        
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

    // Sync to tree structure and add to history
    get().syncToMindMapData();

    // End history group and commit
    try { state3.endHistoryGroup?.(true); } catch {}

    // Apply auto layout if enabled
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

  moveNode: (nodeId: string, newParentId: string) => {
    let moveResult: { success: boolean; reason?: string } = { success: false };

    set((state) => {
      if (!state.normalizedData) return;

      const result = moveNormalizedNode(state.normalizedData, nodeId, newParentId);
      if (result.success) {
        state.normalizedData = result.data;
        moveResult = { success: true };
      } else {
        moveResult = { success: false, reason: result.reason };
        logger.warn('moveNode constraint violation:', result.reason);
      }
    });

    if (moveResult.success) {
      
      get().syncToMindMapData();

      
      const { data } = get();
      if (data?.settings?.autoLayout) {
        get().applyAutoLayout();
      }
    }

    return moveResult;
  },

  moveNodeWithPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
    let moveResult: { success: boolean; reason?: string } = { success: false };

    set((state) => {
      if (!state.normalizedData) return;

      const result = moveNodeWithPositionNormalized(state.normalizedData, nodeId, targetNodeId, position);
      if (result.success) {
        state.normalizedData = result.data;
        moveResult = { success: true };
      } else {
        moveResult = { success: false, reason: result.reason };
        logger.warn('moveNodeWithPosition constraint violation:', result.reason);
      }
    });

    if (moveResult.success) {
      
      get().syncToMindMapData();

      
      const { data } = get();
      if (data?.settings?.autoLayout) {
        get().applyAutoLayout();
      }
    }

    return moveResult;
  },

  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
    logger.debug('🎪 Store changeSiblingOrder開始:', { draggedNodeId, targetNodeId, insertBefore });
    set((state) => {
      if (!state.normalizedData) {
        logger.error('❌ normalizedDataが存在しません');
        return;
      }
      
      try {
        logger.debug('🔄 changeSiblingOrder実行:', { draggedNodeId, targetNodeId, insertBefore });
        const originalData = state.normalizedData;
        state.normalizedData = changeSiblingOrderNormalized(state.normalizedData, draggedNodeId, targetNodeId, insertBefore);
        
        
        const hasChanged = JSON.stringify(originalData.childrenMap) !== JSON.stringify(state.normalizedData.childrenMap);
        logger.debug('🔄 変更チェック:', { hasChanged });
        
        logger.debug('🔄 データ更新完了');
        logger.debug('✅ changeSiblingOrder完了');
      } catch (error) {
        logger.error('❌ changeSiblingOrder error:', error);
      }
    });
    
    
    get().syncToMindMapData();
    
    
    const { data } = get();
    if (data?.settings?.autoLayout) {
      logger.debug('🔄 自動レイアウト適用中...');
      get().applyAutoLayout();
    }
  },

  
  selectNode: (nodeId: string | null) => {
    set((state) => {
      state.selectedNodeId = nodeId;
    });
  },

  startEditing: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'select-all'; 
      }
    });
  },

  startEditingWithCursorAtEnd: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-end'; 
      }
    });
  },

  startEditingWithCursorAtStart: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-start'; 
      }
    });
  },

  finishEditing: (nodeId: string, text: string) => {
    
    if (!text) {
      
      let parentId: string | null = null;
      const { normalizedData } = get();
      if (normalizedData) {
        parentId = normalizedData.parentMap[nodeId] || null;
      }



      get().deleteNode(nodeId);

      const state4 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
      try { state4.endHistoryGroup?.(false); } catch {}
      
      
      const { normalizedData: nd2 } = get();
      set((state) => {
        const fallbackRef = state.lastSelectionBeforeInsert || null;
        
        state.editingNodeId = null;
        state.editText = '';
        state.editingMode = null;
        // Compute selection
        if (fallbackRef && nd2 && nd2.nodes[fallbackRef]) {
          state.selectedNodeId = fallbackRef;
        } else if (parentId && parentId !== 'root') {
          state.selectedNodeId = parentId;
        } else if (parentId === 'root') {
          state.selectedNodeId = 'root';
        }
        
        state.lastSelectionBeforeInsert = null;
      });
      
      return;
    }
    
    
    set((state) => {
      state.editingNodeId = null;
      state.editText = '';
      state.editingMode = null;
      // Keep node selected after editing
      state.selectedNodeId = nodeId;
      // Clear any pending fallback reference on successful edit
      state.lastSelectionBeforeInsert = null;
    });
    
    // Update the node text
    get().updateNode(nodeId, { text: text });
    // End group with commit – treat insert+text as single change
    const state5 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
    try { state5.endHistoryGroup?.(true); } catch {}
    
    // Apply auto layout if enabled
    const { data } = get();
    logger.debug('🔍 Auto layout check (finishEditing):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout,
      settingsObject: data?.settings
    });
    if (data?.settings?.autoLayout) {
      logger.debug('✅ Applying auto layout after finishEditing');
      const applyAutoLayout = get().applyAutoLayout;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout(true); 
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
    }
  },

  cancelEditing: () => {
    set((state) => {
      state.editingNodeId = null;
      state.editText = '';
      state.editingMode = null;
    });
    // End history group without commit if editing was cancelled
    const state6 = get() as MindMapStore & { endHistoryGroup?: (commit: boolean) => void };
    try { state6.endHistoryGroup?.(false); } catch {}
  },

  setEditText: (text: string) => {
    set((state) => {
      state.editText = text;
    });
  },

  toggleNodeCollapse: (nodeId: string) => {
    // Update collapsed state and apply layout atomically
    const wasCollapsed = get().normalizedData?.nodes[nodeId]?.collapsed;

    set((state) => {
      if (!state.normalizedData) return;
      try {
        const node = state.normalizedData.nodes[nodeId];
        if (!node) return;
        const newCollapsedState = !node.collapsed;
        state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, { collapsed: newCollapsedState });
        // Reflect into tree data without emitting history events
        if (state.data) {
          const newRootNodes = denormalizeTreeData(state.normalizedData);
          state.data = { ...state.data, rootNodes: newRootNodes, updatedAt: new Date().toISOString() };
        }
      } catch (error) {
        logger.error('toggleNodeCollapse error:', error);
      }
    });

    // For expanding nodes (wasCollapsed === true), apply layout immediately
    // to ensure child nodes have correct positions before rendering
    const { data } = get();
    if (data?.settings?.autoLayout && wasCollapsed) {
      // Force immediate layout execution for expand operations
      get().applyAutoLayout(true);
    } else if (data?.settings?.autoLayout) {
      // Regular debounced layout for collapse operations
      get().applyAutoLayout();
    }
  },

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure with new link - only use rootNodes
        const rootNodes = state.data.rootNodes || [];
        
        let updatedRootNodes = rootNodes;
        for (let i = 0; i < rootNodes.length; i++) {
          const updatedRootNode = addLinkToNodeInTree(rootNodes[i], nodeId, linkData);
          if (updatedRootNode !== rootNodes[i]) {
            updatedRootNodes = [...rootNodes];
            updatedRootNodes[i] = updatedRootNode;
            break;
          }
        }
        
        state.data = {
          ...state.data,
          rootNodes: updatedRootNodes,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node) {
            const updatedNode = addLinkToNodeInTree(node, nodeId, linkData);
            state.normalizedData.nodes[nodeId] = updatedNode;
          }
        }

        logger.debug('Link added to node:', nodeId, linkData);
      } catch (error) {
        logger.error('addNodeLink error:', error);
      }
    });
    // Commit to tree + history via event bus
    get().syncToMindMapData();
  },

  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure - only use rootNodes
        const rootNodes = state.data.rootNodes || [];
        
        let updatedRootNodes = rootNodes;
        for (let i = 0; i < rootNodes.length; i++) {
          const updatedRootNode = updateLinkInNodeTree(rootNodes[i], nodeId, linkId, updates);
          if (updatedRootNode !== rootNodes[i]) {
            updatedRootNodes = [...rootNodes];
            updatedRootNodes[i] = updatedRootNode;
            break;
          }
        }
        
        state.data = {
          ...state.data,
          rootNodes: updatedRootNodes,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node && node.links) {
            const updatedLinks = node.links.map((link: NodeLink) =>
              link.id === linkId ? { ...link, ...updates, updatedAt: new Date().toISOString() } : link
            );
            state.normalizedData.nodes[nodeId] = { ...node, links: updatedLinks };
          }
        }

        logger.debug('Link updated:', nodeId, linkId, updates);
      } catch (error) {
        logger.error('updateNodeLink error:', error);
      }
    });
    // Commit to tree + history via event bus
    get().syncToMindMapData();
  },

  deleteNodeLink: (nodeId: string, linkId: string) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure - only use rootNodes
        const rootNodes = state.data.rootNodes || [];
        
        let updatedRootNodes = rootNodes;
        for (let i = 0; i < rootNodes.length; i++) {
          const updatedRootNode = removeLinkFromNodeTree(rootNodes[i], nodeId, linkId);
          if (updatedRootNode !== rootNodes[i]) {
            updatedRootNodes = [...rootNodes];
            updatedRootNodes[i] = updatedRootNode;
            break;
          }
        }
        
        state.data = {
          ...state.data,
          rootNodes: updatedRootNodes,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node && node.links) {
            const filteredLinks = node.links.filter((link: NodeLink) => link.id !== linkId);
            state.normalizedData.nodes[nodeId] = { ...node, links: filteredLinks };
          }
        }

        logger.debug('Link deleted from node:', nodeId, linkId);
      } catch (error) {
        logger.error('deleteNodeLink error:', error);
      }
    });
    // Commit to tree + history via event bus
    get().syncToMindMapData();
  },

  toggleNodeCheckbox: (nodeId: string, checked: boolean) => {
    // 1. 正規化データのみ即座に更新（軽い処理、UIが瞬時に反映）
    set((state) => {
      if (state.normalizedData) {
        const node = state.normalizedData.nodes[nodeId];
        if (node && node.markdownMeta?.isCheckbox) {
          state.normalizedData.nodes[nodeId] = {
            ...node,
            markdownMeta: {
              ...node.markdownMeta,
              isChecked: checked
            }
          };
        }
      }
    });

    // 2. 重いツリー構造更新とファイル保存は非同期実行
    requestAnimationFrame(() => {
      set((state) => {
        if (!state.data) return;

        try {
          // Update tree structure - only use rootNodes
          const rootNodes = state.data.rootNodes || [];

          const updatedRootNodes = updateNodeCheckedInTree(rootNodes, nodeId, checked);

          state.data = {
            ...state.data,
            rootNodes: updatedRootNodes,
            updatedAt: new Date().toISOString()
          };

          logger.debug('Checkbox toggled for node:', nodeId, 'checked:', checked);
        } catch (error) {
          logger.error('toggleNodeCheckbox error:', error);
        }
      });

      
      get().syncToMindMapData();
    });
  },
});;
