import { useMemo } from 'react';
import { findNodeById, getFirstVisibleChild, findNodeInRoots, findNodeBySpatialDirection } from '@mindmap/utils';
import { getSiblingNodes as selGetSiblingNodes, findParentNode as selFindParentNode } from '@mindmap/selectors/mindMapSelectors';
import { useMindMapStore } from '../../store';
import type { MindMapNode } from '@shared/types';

import { ensureVisible as ensureNodeVisibleSvc } from '@mindmap/services/ViewportScrollService';

interface Args {
  data: { rootNode: MindMapNode } | null;
  ui: any;
  store: any;
  logger: any;
  showNotification: (type: 'success'|'error'|'info'|'warning', message: string) => void;
  
  centerNodeInView: (nodeId: string, animate?: boolean) => void;
  
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (t: string) => void;
  startEditing: (id: string) => void;
  startEditingWithCursorAtEnd: (id: string) => void;
  startEditingWithCursorAtStart: (id: string) => void;
  finishEditing: (id: string, text?: string) => void;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectNode: (id: string) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  applyAutoLayout?: () => void;
  pasteImageFromClipboard: (nodeId: string, file?: File) => Promise<void>;
  pasteNodeFromClipboard: (parentId: string) => Promise<void>;
  changeNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
}

export function useShortcutHandlers(args: Args) {
  const {
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText, setEditText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
  } = args;

  return useMemo(() => ({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit: startEditing,
    startEditWithCursorAtEnd: startEditingWithCursorAtEnd,
    startEditWithCursorAtStart: startEditingWithCursorAtStart,
    finishEdit: async (nodeId: string, text?: string) => {
      
      const value = (text !== undefined) ? text : editText;
      finishEditing(nodeId, value);
    },
    editText,
    updateNode,
    addChildNode: async (parentId: string, text?: string, autoEdit?: boolean) => {
      try {
        const newNodeId = store.addChildNode(parentId, text);
        if (autoEdit && newNodeId) setTimeout(() => startEditing(newNodeId), 50);
        return newNodeId || null;
      } catch (error) {
        logger.error('子ノード追加に失敗:', error);
        return null;
      }
    },
    addSiblingNode: async (nodeId: string, text?: string, autoEdit?: boolean, insertAfter?: boolean) => {
      try {
        const newNodeId = store.addSiblingNode(nodeId, text, insertAfter);
        if (autoEdit && newNodeId) setTimeout(() => startEditing(newNodeId), 50);
        return newNodeId || null;
      } catch (error) {
        logger.error('兄弟ノード追加に失敗:', error);
        return null;
      }
    },
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectNode,
    setPan,
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right', count: number = 1) => {
      
      const currentSelectedNodeId = useMindMapStore.getState().selectedNodeId;
      if (!currentSelectedNodeId) return;
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      const currentRoot = roots.find(r => !!findNodeById(r, currentSelectedNodeId)) || roots[0];
      if (!currentRoot) return;
      const currentNode = findNodeById(currentRoot, currentSelectedNodeId);
      if (!currentNode) return;
      let nextNodeId: string | null = null;
      switch (direction) {
        case 'left': {
          
          const stack: MindMapNode[] = currentRoot ? [currentRoot] as MindMapNode[] : [];
          while (stack.length) {
            const node = stack.pop()!;
            if (node.children?.some(c => c.id === currentSelectedNodeId)) { nextNodeId = node.id; break; }
            if (node.children) stack.push(...node.children);
          }
          break;
        }
        case 'right': {
          const firstChild = getFirstVisibleChild(currentNode);
          if (firstChild) {
            
            const children = currentNode.children || [];
            if (children.length > 1) {
              let closestChild = children[0];
              let minDistance = Math.abs(children[0].y - currentNode.y);

              for (let i = 1; i < children.length; i++) {
                const distance = Math.abs(children[i].y - currentNode.y);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestChild = children[i];
                }
              }
              nextNodeId = closestChild.id;
            } else {
              nextNodeId = firstChild.id;
            }
          }
          else if (currentNode.children?.length && currentNode.collapsed) {
            updateNode(currentSelectedNodeId, { collapsed: false });
            
            const children = currentNode.children;
            if (children.length > 1) {
              let closestChild = children[0];
              let minDistance = Math.abs(children[0].y - currentNode.y);

              for (let i = 1; i < children.length; i++) {
                const distance = Math.abs(children[i].y - currentNode.y);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestChild = children[i];
                }
              }
              nextNodeId = closestChild.id;
            } else {
              nextNodeId = children[0].id;
            }
          }
          break;
        }
        case 'up':
        case 'down': {
          const { siblings, currentIndex } = selGetSiblingNodes(currentRoot, currentSelectedNodeId);
          if (siblings.length > 1 && currentIndex !== -1) {
            let targetIndex = -1;
            
            if (direction === 'up') {
              targetIndex = Math.max(0, currentIndex - count);
            } else if (direction === 'down') {
              targetIndex = Math.min(siblings.length - 1, currentIndex + count);
            }
            if (targetIndex !== -1 && targetIndex !== currentIndex) {
              nextNodeId = siblings[targetIndex].id;
            }
          }
          
          if (!nextNodeId) {
            const rootIndex = roots.findIndex(r => r.id === currentRoot.id);
            if (rootIndex !== -1) {
              if (direction === 'down' && rootIndex < roots.length - 1) {
                nextNodeId = roots[rootIndex + 1].id;
              } else if (direction === 'up' && rootIndex > 0) {
                nextNodeId = roots[rootIndex - 1].id;
              }
            }
          }
          break;
        }
      }
      if (!nextNodeId) nextNodeId = findNodeBySpatialDirection(currentSelectedNodeId, direction, currentRoot);
      if (nextNodeId) {
        selectNode(nextNodeId);
        
        ensureNodeVisible(nextNodeId);
      }

      
      function ensureNodeVisible(nodeId: string) {
        const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
        ensureNodeVisibleSvc(nodeId, ui, (p: any) => setPan(p), roots);
      }
    },
    showMapList: ui.showMapList,
    setShowMapList: (show: boolean) => store.setShowMapList(show),
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: (show: boolean) => store.setShowLocalStoragePanel(show),
    showTutorial: ui.showTutorial,
    setShowTutorial: (show: boolean) => store.setShowTutorial(show),
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show),
    copyNode: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      const node = findNodeInRoots(roots, nodeId);
      if (!node) {
        logger.error('copyNode: node not found', nodeId);
        return;
      }
      logger.debug('copyNode: setting clipboard', node);
      store.setClipboard(node);
      const convertToMd = (n: MindMapNode, level = 0): string => {
        const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
        let md = `${prefix}${n.text}\n`;
        if (n.note !== null) md += `${n.note}\n`;
        if (n.children?.length) n.children.forEach(c => { md += convertToMd(c, level + 1); });
        return md;
      };
      const markdownText = convertToMd(node);
      navigator.clipboard?.writeText?.(markdownText).catch(() => {});
      showNotification('success', `「${node.text}」をコピーしました`);
    },
    pasteNode: async (parentId: string) => {
      
      logger.debug('pasteNode: using pasteNodeFromClipboard');
      await pasteNodeFromClipboard(parentId);
    },
    pasteImageFromClipboard,
    findNodeById: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      return findNodeInRoots(roots, nodeId);
    },
    closeAttachmentAndLinkLists: () => store.closeAttachmentAndLinkLists?.(),
    
    showNotesPanel: !!useMindMapStore.getState().ui?.showNotesPanel,
    setShowNotesPanel: (show: boolean) => store.setShowNotesPanel?.(show),
    toggleNotesPanel: () => store.toggleNotesPanel?.(),
    
    showNodeNotePanel: !!useMindMapStore.getState().ui?.showNodeNotePanel,
    setShowNodeNotePanel: (show: boolean) => store.setShowNodeNotePanel?.(show),
    toggleNodeNotePanel: () => store.toggleNodeNotePanel?.(),
    
    showKnowledgeGraph: !!useMindMapStore.getState().ui?.showKnowledgeGraph,
    setShowKnowledgeGraph: (show: boolean) => store.setShowKnowledgeGraph?.(show),
    toggleKnowledgeGraph: () => store.toggleKnowledgeGraph?.(),
    onMarkdownNodeType: changeNodeType,
    changeSiblingOrder,
    centerNodeInView,
    
    switchToPrevMap: () => {
      try {
        const order = (window as any).mindoodleOrderedMaps as Array<{ mapId: string; workspaceId: string }> || [];
        const maps = (window as any).mindoodleAllMaps || [];
        const currentId: string | null = (window as any).mindoodleCurrentMapId || null;
        if (!Array.isArray(order) || order.length === 0) return;

        const isEmpty = (m: any): boolean => {
          try {
            const roots = m?.rootNodes || [];
            if (!Array.isArray(roots) || roots.length === 0) return true;
            const onlyRoot = roots.length === 1 && (!roots[0].children || roots[0].children.length === 0);
            return onlyRoot;
          } catch { return false; }
        };

        let idx = order.findIndex((o: any) => o?.mapId === currentId);
        if (idx < 0) idx = 0;
        for (let step = 0; step < order.length; step++) {
          idx = idx <= 0 ? order.length - 1 : idx - 1;
          const cand = order[idx];
          const mapData = maps.find((m: any) => m?.mapIdentifier?.mapId === cand.mapId);
          
          if (!mapData || !isEmpty(mapData)) {
            const ev = new CustomEvent('mindoodle:selectMapById', { detail: { mapId: cand.mapId, workspaceId: cand.workspaceId, source: 'keyboard', direction: 'prev' } });
            window.dispatchEvent(ev);
            break;
          }
        }
      } catch {}
    },
    switchToNextMap: () => {
      try {
        const order = (window as any).mindoodleOrderedMaps as Array<{ mapId: string; workspaceId: string }> || [];
        const maps = (window as any).mindoodleAllMaps || [];
        const currentId: string | null = (window as any).mindoodleCurrentMapId || null;
        if (!Array.isArray(order) || order.length === 0) return;

        const isEmpty = (m: any): boolean => {
          try {
            const roots = m?.rootNodes || [];
            if (!Array.isArray(roots) || roots.length === 0) return true;
            const onlyRoot = roots.length === 1 && (!roots[0].children || roots[0].children.length === 0);
            return onlyRoot;
          } catch { return false; }
        };

        let idx = order.findIndex((o: any) => o?.mapId === currentId);
        if (idx < 0) idx = 0;
        for (let step = 0; step < order.length; step++) {
          idx = idx >= order.length - 1 ? 0 : idx + 1;
          const cand = order[idx];
          const mapData = maps.find((m: any) => m?.mapIdentifier?.mapId === cand.mapId);
          if (!mapData || !isEmpty(mapData)) {
            const ev = new CustomEvent('mindoodle:selectMapById', { detail: { mapId: cand.mapId, workspaceId: cand.workspaceId, source: 'keyboard', direction: 'next' } });
            window.dispatchEvent(ev);
            break;
          }
        }
      } catch {}
    },

    
    moveNode: async (nodeId: string, newParentId: string) => {
      const result = store.moveNode(nodeId, newParentId);
      if (result.success) {
        showNotification('success', 'ノードを移動しました');
      } else {
        showNotification('warning', result.reason || 'ノードの移動ができませんでした');
        logger.warn('moveNode constraint violation:', result.reason);
      }
    },
    moveNodeWithPosition: async (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
      const result = store.moveNodeWithPosition(nodeId, targetNodeId, position);
      if (result.success) {
        showNotification('success', 'ノードを移動しました');
      } else {
        showNotification('warning', result.reason || 'ノードの移動ができませんでした');
        logger.warn('moveNodeWithPosition constraint violation:', result.reason);
      }
    },
    findParentNode: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      return selFindParentNode(roots, nodeId);
    },
  }), [
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
  ]);
}
