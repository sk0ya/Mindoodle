import type { StateCreator } from 'zustand';
import type { MindMapNode, NodeLink } from '@shared/types';
import { logger } from '@shared/utils';
import {
  addLinkToNodeInTree,
  updateLinkInNodeTree,
  removeLinkFromNodeTree
} from '../../utils';
import {
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  addSiblingNormalizedNode,
  addRootSiblingNode,
  moveNormalizedNode,
  moveNodeWithPositionNormalized,
  changeSiblingOrderNormalized
} from '@core/data/normalizedStore';
import { generateNodeId } from '@shared/utils';
import { COLORS } from '@shared/constants';
import { getBranchColor, calculateNodeSize, getDynamicNodeSpacing, calculateChildNodeX } from '../../utils';
import type { MindMapStore } from './types';

// Helper function to create new node
const createNewNode = (text: string, _parentNode?: MindMapNode, _settings?: any): MindMapNode => ({
  id: generateNodeId(),
  text,
  x: 0,
  y: 0,
  children: [],
  fontSize: 14,
  fontWeight: 'normal'
});

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
  
  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
}

export const createNodeSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  NodeSlice
> = (set, get) => ({
  // Node operations
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
        state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, updates);
      } catch (error) {
        logger.error('updateNode error:', error);
      }
    });
    
    // Sync to tree structure and add to history
    get().syncToMindMapData();
  },

  addChildNode: (parentId: string, text: string = 'New Node') => {
    let newNodeId: string | undefined;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const parentNode = state.normalizedData.nodes[parentId];
        if (!parentNode) return;

        // Disallow adding children to table nodes
        if ((parentNode as any)?.kind === 'table') {
          return;
        }
        
        // 設定を取得してノード作成時に適用
        const settings = state.settings;
        const newNode = createNewNode(text, parentNode, settings);
        newNodeId = newNode.id;
        
        const childIds = state.normalizedData.childrenMap[parentId] || [];
        const childNodes = childIds.map((id: string) => state.normalizedData?.nodes[id]).filter(Boolean);
        
        // Initial position: place relative to parent uniformly for all depths (root is just another parent)
        try {
          const fontSize = state.settings?.fontSize;
          const parentSize = calculateNodeSize(parentNode as any, undefined, false, fontSize);
          const childSize = calculateNodeSize(newNode as any, undefined, false, fontSize);
          const edge = getDynamicNodeSpacing(parentSize as any, childSize as any, false);
          newNode.x = calculateChildNodeX(parentNode as any, childSize as any, edge);
          newNode.y = parentNode.y; // Y is refined by autoLayout later
        } catch (_e) {
          // Fallback: overlap parent if anything goes wrong
          newNode.x = parentNode.x;
          newNode.y = parentNode.y;
        }

        // Set markdownMeta based on siblings (excluding table nodes) or parent
        const nonTableSiblings = childNodes.filter((s: any) => s && s.kind !== 'table');
        if (nonTableSiblings.length > 0) {
          const lastSibling = nonTableSiblings[nonTableSiblings.length - 1];
          if (lastSibling && lastSibling.markdownMeta) {
            newNode.markdownMeta = {
              type: lastSibling.markdownMeta.type,
              level: lastSibling.markdownMeta.level,
              originalFormat: lastSibling.markdownMeta.originalFormat,
              indentLevel: lastSibling.markdownMeta.indentLevel,
              lineNumber: -1
            };
          }
        } else if (parentNode.markdownMeta) {
          // No siblings, determine child type based on parent
          if (parentNode.markdownMeta.type === 'heading') {
            const childLevel = (parentNode.markdownMeta.level || 1) + 1;

            // レベル7以上になる場合はリストに変更
            if (childLevel >= 7) {
              newNode.markdownMeta = {
                type: 'unordered-list',
                level: 1,
                originalFormat: '-',
                indentLevel: 0,
                lineNumber: -1
              };
            } else {
              // 見出しの子は見出し（レベル+1）
              newNode.markdownMeta = {
                type: 'heading',
                level: childLevel,
                originalFormat: '#'.repeat(childLevel),
                indentLevel: 0,
                lineNumber: -1
              };
            }
          } else {
            // 親がリストの場合は同じタイプで一段深いインデント
            newNode.markdownMeta = {
              type: parentNode.markdownMeta.type,
              level: (parentNode.markdownMeta.level || 1) + 1,
              originalFormat: parentNode.markdownMeta.originalFormat,
              indentLevel: (parentNode.markdownMeta.indentLevel || 0) + 2,
              lineNumber: -1
            };
          }
        }

        // Add node to normalized data first to establish parent-child relationship
        state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);
        
        // Color assignment - ブランチベースの色割り当て
        // ルートノードかどうかは親がいるかどうかで判定
        const isRootNode = state.normalizedData.parentMap[parentId] === undefined;
        const color = isRootNode
          ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length]
          : getBranchColor(newNode.id, state.normalizedData);
        
        // Update color after establishing relationship
        newNode.color = color;
        state.normalizedData.nodes[newNode.id] = { ...newNode };
        
        // Remember previous selection to restore on cancel/empty edit
        state.lastSelectionBeforeInsert = parentId;
        // Select the new node
        state.selectedNodeId = newNode.id;
      } catch (error) {
        logger.error('addChildNode error:', error);
      }
    });
    
    // Sync to tree structure and add to history
    get().syncToMindMapData();
    
    // Apply auto layout if enabled
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

  addSiblingNode: (nodeId: string, text: string = 'New Node', insertAfter: boolean = true) => {
    let newNodeId: string | undefined;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const currentNode = state.normalizedData.nodes[nodeId];
        if (!currentNode) return;
        
        const parentId = state.normalizedData.parentMap[nodeId];

        // Helper to derive markdownMeta for a new sibling when current is a table node
        const deriveSiblingMarkdownMeta = (): Partial<MindMapNode['markdownMeta']> | undefined => {
          const nd = state.normalizedData!;
          const isTable = (currentNode as any)?.kind === 'table';
          const getNearestNonTableSiblingMeta = (siblings: string[], currentIdx: number) => {
            // search left then right for nearest non-table sibling having markdownMeta
            const n = siblings.length;
            for (let offset = 1; offset < n; offset++) {
              const left = currentIdx - offset;
              const right = currentIdx + offset;
              if (left >= 0) {
                const sib = nd.nodes[siblings[left]] as any;
                if (sib && sib.kind !== 'table' && sib.markdownMeta) return sib.markdownMeta;
              }
              if (right < n) {
                const sib = nd.nodes[siblings[right]] as any;
                if (sib && sib.kind !== 'table' && sib.markdownMeta) return sib.markdownMeta;
              }
            }
            return undefined;
          };

          if (!isTable) {
            return currentNode.markdownMeta;
          }

          if (!parentId) {
            // Root-level siblings
            const roots = nd.rootNodeIds || [];
            const idx = roots.indexOf(nodeId);
            const meta = getNearestNonTableSiblingMeta(roots, idx);
            if (meta) return meta;
            // Default to heading level 1 at root
            return { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 } as any;
          } else {
            const siblings = nd.childrenMap[parentId] || [];
            const idx = siblings.indexOf(nodeId);
            const meta = getNearestNonTableSiblingMeta(siblings, idx);
            if (meta) return meta;
            const parentNode = nd.nodes[parentId] as any;
            const pMeta = parentNode?.markdownMeta;
            if (pMeta) {
              if (pMeta.type === 'heading') {
                // Under heading: children are headings with level+1 (as in addChildNode)
                const lvl = Math.min((pMeta.level || 1) + 1, 6);
                return { type: 'heading', level: lvl, originalFormat: '#'.repeat(lvl), indentLevel: 0, lineNumber: -1 } as any;
              } else if (pMeta.type === 'unordered-list' || pMeta.type === 'ordered-list') {
                // Sibling under list: one deeper than parent list container
                return {
                  type: pMeta.type,
                  level: (pMeta.level || 1) + 1,
                  originalFormat: pMeta.originalFormat,
                  indentLevel: (pMeta.indentLevel || 0) + 2,
                  lineNumber: -1
                } as any;
              }
            }
            // Fallback: heading level 1 (safer than forcing list)
            return { type: 'heading', level: 1, originalFormat: '#', indentLevel: 0, lineNumber: -1 } as any;
          }
        };
        
        // 設定を取得してノード作成時に適用
        const settings = state.settings;
        let newNode: MindMapNode;

        if (!parentId) {
          // ルートノードの兄弟ノードを追加（新しいルートノード）
          newNode = createNewNode(text, currentNode, settings);
          newNodeId = newNode.id;
          
          // Skip initial position calculation - let autoLayout handle it
          // This prevents the visual "jump" when autoLayout is enabled
          newNode.x = currentNode.x;
          newNode.y = currentNode.y;

          // Set markdownMeta same as current root sibling node (skip if current is table)
          // markdownMeta inheritance / fallback
          const derivedMeta = deriveSiblingMarkdownMeta();
          if (derivedMeta) newNode.markdownMeta = { ...(derivedMeta as any), lineNumber: -1 } as any;

          // 新しいルートノードを追加
          state.normalizedData = addRootSiblingNode(state.normalizedData, nodeId, newNode, true);

          // ルートノードはブランチベースの色割り当て
          const color = getBranchColor(newNode.id, state.normalizedData);
          newNode.color = color;
          state.normalizedData.nodes[newNode.id] = { ...newNode };
          
        } else {
          // 通常の兄弟ノード追加
          const parentNode = state.normalizedData.nodes[parentId];
          if (!parentNode) return;
          
          newNode = createNewNode(text, parentNode, settings);
          newNodeId = newNode.id;
          
          // Initial position relative to the same parent (consistent for all depths)
          try {
            const fontSize = state.settings?.fontSize;
            const pNode = state.normalizedData.nodes[parentId];
            const parentSize = calculateNodeSize(pNode as any, undefined, false, fontSize);
            const childSize = calculateNodeSize(newNode as any, undefined, false, fontSize);
            const edge = getDynamicNodeSpacing(parentSize as any, childSize as any, false);
            newNode.x = calculateChildNodeX(pNode as any, childSize as any, edge);
            newNode.y = pNode.y; // Y refined later by autoLayout
          } catch (_e) {
            newNode.x = currentNode.x;
            newNode.y = currentNode.y;
          }

          // Set markdownMeta same as current sibling node (skip if current is table)
          // markdownMeta inheritance / fallback
          const derivedMeta2 = deriveSiblingMarkdownMeta();
          if (derivedMeta2) newNode.markdownMeta = { ...(derivedMeta2 as any), lineNumber: -1 } as any;

          // Add sibling node first to establish parent-child relationship
          state.normalizedData = addSiblingNormalizedNode(state.normalizedData, nodeId, newNode, insertAfter);
          
          // 兄弟ノードはブランチベースの色割り当て
          const color = getBranchColor(newNode.id, state.normalizedData);
          newNode.color = color;
          state.normalizedData.nodes[newNode.id] = { ...newNode };
        }
        
        // Remember previous selection to restore on cancel/empty edit
        state.lastSelectionBeforeInsert = nodeId;
        // 新しいノードを選択
        state.selectedNodeId = newNode.id;
      } catch (error) {
        logger.error('addSiblingNode error:', error);
      }
    });
    
    // Sync to tree structure and add to history
    get().syncToMindMapData();
    
    // Apply auto layout if enabled
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

  deleteNode: (nodeId: string) => {
    let nextNodeToSelect: string | null = null;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        // Before deleting, find the next node to select based on the node being removed
        const parentId = state.normalizedData.parentMap[nodeId];
        if (parentId) {
          const siblings = state.normalizedData.childrenMap[parentId] || [];
          const currentIndex = siblings.indexOf(nodeId);

          if (currentIndex !== -1) {
            // Prefer next sibling
            if (currentIndex < siblings.length - 1) {
              nextNodeToSelect = siblings[currentIndex + 1];
            }
            // Fallback to previous sibling
            else if (currentIndex > 0) {
              nextNodeToSelect = siblings[currentIndex - 1];
            }
            // If no siblings remain, fallback to parent (unless parent is the artificial 'root')
            else if (parentId !== 'root') {
              nextNodeToSelect = parentId;
            }
          }
        }
        
        state.normalizedData = deleteNormalizedNode(state.normalizedData, nodeId);
        
        // Set new selection: if the deleted node was selected, or nothing is selected, choose a reasonable next
        if (state.selectedNodeId === nodeId || !state.selectedNodeId) {
          // If our precomputed next is still null, try pick first available root node
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
      // Sync to tree structure and add to history
      get().syncToMindMapData();

      // Apply auto layout if enabled
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
      // Sync to tree structure and add to history
      get().syncToMindMapData();

      // Apply auto layout if enabled
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
        
        // Check if there were changes
        const hasChanged = JSON.stringify(originalData.childrenMap) !== JSON.stringify(state.normalizedData.childrenMap);
        logger.debug('🔄 変更チェック:', { hasChanged });
        
        logger.debug('🔄 データ更新完了');
        logger.debug('✅ changeSiblingOrder完了');
      } catch (error) {
        logger.error('❌ changeSiblingOrder error:', error);
      }
    });
    
    // Sync to tree structure and add to history
    get().syncToMindMapData();
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      logger.debug('🔄 自動レイアウト適用中...');
      get().applyAutoLayout();
    }
  },

  // Selection & Editing
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
        state.editingMode = 'select-all'; // テキスト選択モード
      }
    });
  },

  startEditingWithCursorAtEnd: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-end'; // カーソル末尾モード
      }
    });
  },

  startEditingWithCursorAtStart: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-start'; // カーソル先頭モード
      }
    });
  },

  finishEditing: (nodeId: string, text: string) => {
    const trimmedText = text.trim();
    
    // If text is empty, delete the node and select parent
    if (!trimmedText) {
      // Get parent info before deleting
      let parentId: string | null = null;
      const { normalizedData } = get();
      if (normalizedData) {
        parentId = normalizedData.parentMap[nodeId] || null;
      }
      
      // Delete the empty node
      get().deleteNode(nodeId);
      
      // Prefer restoring selection to the node that triggered the insert (o/O/Enter/Tab)
      const { normalizedData: nd2 } = get();
      set((state) => {
        const fallbackRef = state.lastSelectionBeforeInsert || null;
        // Clear editing state
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
        // Clear the fallback reference once used
        state.lastSelectionBeforeInsert = null;
      });
      
      return;
    }
    
    // Normal text update flow
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
    get().updateNode(nodeId, { text: trimmedText });
    
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
        applyAutoLayout();
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
  },

  setEditText: (text: string) => {
    set((state) => {
      state.editText = text;
    });
  },

  toggleNodeCollapse: (nodeId: string) => {
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const node = state.normalizedData.nodes[nodeId];
        if (!node) return;
        
        // Toggle collapsed state
        const newCollapsedState = !node.collapsed;
        state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, { 
          collapsed: newCollapsedState 
        });
      } catch (error) {
        logger.error('toggleNodeCollapse error:', error);
      }
    });
    
    // Sync to tree structure and add to history
    get().syncToMindMapData();
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
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
  },
});;
