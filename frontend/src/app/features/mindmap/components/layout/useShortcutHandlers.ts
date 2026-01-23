import { useMemo } from 'react';
import { findNodeById, findNodeInRoots } from '@mindmap/utils';
import { findParentNode as selFindParentNode } from '@mindmap/selectors/mindMapSelectors';
import { getStoreState, getRootNodes } from '../../hooks/useStoreSelectors';
import type { MindMapNode, MindMapData } from '@shared/types';
import { navigateToDirection } from './navigationStrategies';
import { extractNodeMarkdown, copyNodeWithMarkdown, copyNodeTextOnly } from './copyNodeUtils';
import { switchMap, withNotification } from './shortcutHandlerUtils';

type WindowWithMindoodle = Window & {
  mindoodleOrderedMaps?: Array<{ mapId: string; workspaceId: string }>;
  mindoodleAllMaps?: MindMapData[];
  mindoodleCurrentMapId?: string;
};

type StoreActions = {
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string, insertAfter?: boolean) => string | undefined;
  setShowMapList: (show: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setShowShortcutHelper: (show: boolean) => void;
  setClipboard: (node: MindMapNode) => void;
  closeAttachmentAndLinkLists?: () => void;
  setShowNotesPanel?: (show: boolean) => void;
  toggleNotesPanel?: () => void;
  setShowNodeNotePanel?: (show: boolean) => void;
  toggleNodeNotePanel?: () => void;
  setShowKnowledgeGraph?: (show: boolean) => void;
  toggleKnowledgeGraph?: () => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  moveNodeWithPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => { success: boolean; reason?: string };
};

type ShortcutLogger = {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
};

type UIState = {
  zoom: number;
  pan: { x: number; y: number };
  showMapList: boolean;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  showShortcutHelper: boolean;
  sidebarCollapsed?: boolean;
  showNotesPanel?: boolean;
  markdownPanelWidth?: number;
  showNodeNotePanel?: boolean;
  nodeNotePanelHeight?: number;
  showKnowledgeGraph?: boolean;
};

interface Args {
  data: { rootNode: MindMapNode } | null;
  ui: UIState;
  store: StoreActions;
  logger: ShortcutLogger;
  showNotification: (type: 'success'|'error'|'info'|'warning', message: string) => void;

  centerNodeInView: (nodeId: string, animate?: boolean, mode?: 'center' | 'left' | 'top-left') => void;
  ensureSelectedNodeVisible?: (options?: { force?: boolean }) => void;

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
  pasteImageFromClipboard: (nodeId: string, file?: File) => Promise<void>;
  pasteNodeFromClipboard: (parentId: string) => Promise<void>;
  changeNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  getCurrentMarkdownContent?: () => string;
}

export function useShortcutHandlers(args: Args) {
  const {
    data, ui, store, logger, showNotification,
    centerNodeInView,
    ensureSelectedNodeVisible,
    selectedNodeId, editingNodeId, editText, setEditText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
    getCurrentMarkdownContent,
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
      const state = getStoreState();
      const currentSelectedNodeId = state.selectedNodeId;
      if (!currentSelectedNodeId) return;

      const roots = getRootNodes().length ? getRootNodes() : (data?.rootNode ? [data.rootNode] : []);
      const currentRoot = roots.find(r => !!findNodeById(r, currentSelectedNodeId)) || roots[0];
      if (!currentRoot) return;

      const currentNode = findNodeById(currentRoot, currentSelectedNodeId);
      if (!currentNode) return;

      const nextNodeId = navigateToDirection(direction, {
        currentNodeId: currentSelectedNodeId,
        currentNode,
        currentRoot,
        roots,
        updateNode,
        toggleNodeCollapse: state.toggleNodeCollapse,
      }, count);

      if (nextNodeId) {
        selectNode(nextNodeId);
        try { ensureSelectedNodeVisible?.({ force: true }); } catch {}
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
    copyNode: async (nodeId: string) => {
      const roots = getRootNodes().length ? getRootNodes() : (data?.rootNode ? [data.rootNode] : []);
      const node = findNodeInRoots(roots, nodeId);
      if (!node) return;

      store.setClipboard(node);

      const markdownText = getCurrentMarkdownContent
        ? extractNodeMarkdown(nodeId, roots, node, getCurrentMarkdownContent())
        : '';

      await copyNodeWithMarkdown(node, markdownText, (message) => {
        showNotification('success', message);
      });
    },
    copyNodeText: async (nodeId: string) => {
      const roots = getRootNodes().length ? getRootNodes() : (data?.rootNode ? [data.rootNode] : []);
      const node = findNodeInRoots(roots, nodeId);
      if (!node) {
        logger.error('copyNodeText: node not found', nodeId);
        return;
      }
      await copyNodeTextOnly(node, (message) => showNotification('success', message));
    },
    pasteNode: async (parentId: string) => {
      
      logger.debug('pasteNode: using pasteNodeFromClipboard');
      await pasteNodeFromClipboard(parentId);
    },
    pasteImageFromClipboard,
    findNodeById: (nodeId: string) => {
      const roots = getRootNodes().length ? getRootNodes() : (data?.rootNode ? [data.rootNode] : []);
      return findNodeInRoots(roots, nodeId);
    },
    closeAttachmentAndLinkLists: () => store.closeAttachmentAndLinkLists?.(),

    showNotesPanel: !!getStoreState().ui?.showNotesPanel,
    setShowNotesPanel: (show: boolean) => store.setShowNotesPanel?.(show),
    toggleNotesPanel: () => store.toggleNotesPanel?.(),

    showNodeNotePanel: !!getStoreState().ui?.showNodeNotePanel,
    setShowNodeNotePanel: (show: boolean) => store.setShowNodeNotePanel?.(show),
    toggleNodeNotePanel: () => store.toggleNodeNotePanel?.(),

    showKnowledgeGraph: !!getStoreState().ui?.showKnowledgeGraph,
    setShowKnowledgeGraph: (show: boolean) => store.setShowKnowledgeGraph?.(show),
    toggleKnowledgeGraph: () => store.toggleKnowledgeGraph?.(),
    onMarkdownNodeType: changeNodeType,
    changeSiblingOrder,
    centerNodeInView,
    ensureSelectedNodeVisible,

    switchToPrevMap: () => {
      try {
        const win = window as WindowWithMindoodle;
        const target = switchMap(
          'prev',
          win.mindoodleOrderedMaps || [],
          win.mindoodleAllMaps || [],
          win.mindoodleCurrentMapId || null
        );
        if (target) {
          const ev = new CustomEvent('mindoodle:selectMapById', {
            detail: { ...target, source: 'keyboard', direction: 'prev' }
          });
          window.dispatchEvent(ev);
        }
      } catch {}
    },
    switchToNextMap: () => {
      try {
        const win = window as WindowWithMindoodle;
        const target = switchMap(
          'next',
          win.mindoodleOrderedMaps || [],
          win.mindoodleAllMaps || [],
          win.mindoodleCurrentMapId || null
        );
        if (target) {
          const ev = new CustomEvent('mindoodle:selectMapById', {
            detail: { ...target, source: 'keyboard', direction: 'next' }
          });
          window.dispatchEvent(ev);
        }
      } catch {}
    },


    moveNode: async (nodeId: string, newParentId: string) => {
      withNotification(
        () => store.moveNode(nodeId, newParentId),
        () => showNotification('success', 'ノードを移動しました'),
        (reason) => {
          showNotification('warning', reason || 'ノードの移動ができませんでした');
          logger.warn('moveNode constraint violation:', reason);
        }
      );
    },
    moveNodeWithPosition: async (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
      withNotification(
        () => store.moveNodeWithPosition(nodeId, targetNodeId, position),
        () => showNotification('success', 'ノードを移動しました'),
        (reason) => {
          showNotification('warning', reason || 'ノードの移動ができませんでした');
          logger.warn('moveNodeWithPosition constraint violation:', reason);
        }
      );
    },
    findParentNode: (nodeId: string) => {
      const roots = getRootNodes().length ? getRootNodes() : (data?.rootNode ? [data.rootNode] : []);
      return selFindParentNode(roots, nodeId);
    },
  }), [
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText, setEditText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
  ]);
}
