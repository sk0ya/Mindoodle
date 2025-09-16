import { useMemo } from 'react';
import { findNodeById, getSiblingNodes, getFirstVisibleChild } from '../../../../shared/utils/nodeTreeUtils';
import { findNodeBySpatialDirection } from '../../../../shared/utils/navigation';
import type { MindMapNode } from '@shared/types';

interface Args {
  data: { rootNode: MindMapNode } | null;
  ui: any;
  store: any;
  logger: any;
  showNotification: (type: 'success'|'error'|'info'|'warning', message: string) => void;
  // viewport control
  centerNodeInView: (nodeId: string, animate?: boolean) => void;
  // mindmap data/actions
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
  applyAutoLayout?: () => void;
  pasteImageFromClipboard: (nodeId: string) => Promise<void>;
  pasteNodeFromClipboard: (parentId: string) => Promise<void>;
  changeNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
}

export function useShortcutHandlers(args: Args) {
  const {
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText, setEditText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType,
  } = args;

  return useMemo(() => ({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit: startEditing,
    startEditWithCursorAtEnd: startEditingWithCursorAtEnd,
    startEditWithCursorAtStart: startEditingWithCursorAtStart,
    finishEdit: async (nodeId: string, text?: string) => {
      if (text !== undefined) finishEditing(nodeId, text);
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
    addSiblingNode: async (nodeId: string, text?: string, autoEdit?: boolean) => {
      try {
        const newNodeId = store.addSiblingNode(nodeId, text);
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
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedNodeId || !data?.rootNode) return;
      const currentNode = findNodeById(data.rootNode, selectedNodeId);
      if (!currentNode) return;
      let nextNodeId: string | null = null;
      switch (direction) {
        case 'left': {
          // Move to parent node
          const stack: MindMapNode[] = [data.rootNode];
          while (stack.length) {
            const node = stack.pop()!;
            if (node.children?.some(c => c.id === selectedNodeId)) { nextNodeId = node.id; break; }
            if (node.children) stack.push(...node.children);
          }
          break;
        }
        case 'right': {
          const firstChild = getFirstVisibleChild(currentNode);
          if (firstChild) nextNodeId = firstChild.id;
          else if (currentNode.children?.length && currentNode.collapsed) {
            updateNode(selectedNodeId, { collapsed: false });
            nextNodeId = currentNode.children[0].id;
          }
          break;
        }
        case 'up':
        case 'down': {
          const { siblings, currentIndex } = getSiblingNodes(data.rootNode, selectedNodeId);
          if (siblings.length > 1 && currentIndex !== -1) {
            let targetIndex = -1;
            if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
            else if (direction === 'down' && currentIndex < siblings.length - 1) targetIndex = currentIndex + 1;
            if (targetIndex !== -1) nextNodeId = siblings[targetIndex].id;
          }
          break;
        }
      }
      if (!nextNodeId) nextNodeId = findNodeBySpatialDirection(selectedNodeId, direction, data.rootNode);
      if (nextNodeId) selectNode(nextNodeId);
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
      const node = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
      if (!node) return;
      store.setClipboard(node);
      const convertToMd = (n: MindMapNode, level = 0): string => {
        const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
        let md = `${prefix}${n.text}\n`;
        if (n.note?.trim()) md += `${n.note}\n`;
        if (n.children?.length) n.children.forEach(c => { md += convertToMd(c, level + 1); });
        return md;
      };
      const markdownText = convertToMd(node);
      navigator.clipboard?.writeText?.(markdownText).catch(() => {});
      showNotification('success', `「${node.text}」をコピーしました`);
    },
    pasteNode: async (parentId: string) => {
      // try image first, then fallback to structured paste
      try {
        await pasteImageFromClipboard(parentId);
        return;
      } catch {}
      await pasteNodeFromClipboard(parentId);
    },
    pasteImageFromClipboard,
    findNodeById: (nodeId: string) => data?.rootNode ? findNodeById(data.rootNode, nodeId) : null,
    closeAttachmentAndLinkLists: () => store.closeAttachmentAndLinkLists?.(),
    onMarkdownNodeType: changeNodeType,
    centerNodeInView,
  }), [
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType,
  ]);
}
